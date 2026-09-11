import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import type { Metric } from "../metrics.js";
import { metricLabel } from "../metrics.js";
import { wardogsProvider } from "../providers/index.js";
import { getGlobalLeaderboard, getServerLeaderboard, getServerRank, getTrackingListLeaderboard } from "../services/leaderboard-service.js";
import { getLinkedPlayer, getPlayerProgress, linkPlayer, syncPlayer, unlinkPlayer } from "../services/player-service.js";
import {
  addPlayerToTrackingList,
  createTrackingList,
  deleteTrackingList,
  getTrackingList,
  listTrackingLists,
  removePlayerFromTrackingList,
  syncTrackingList
} from "../services/tracking-list-service.js";
import { leaderboardEmbed, statsEmbed } from "../utils/embeds.js";
import { formatHours, formatMoney, formatNumber, kd } from "../utils/format.js";

function requireGuild(interaction: ChatInputCommandInteraction): string {
  if (!interaction.guildId) throw new Error("This command must be used inside a Discord server.");
  return interaction.guildId;
}

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  const guildId = requireGuild(interaction);

  switch (interaction.commandName) {
    case "link": {
      await interaction.deferReply({ ephemeral: true });
      const query = interaction.options.getString("player", true);
      const result = await linkPlayer(guildId, interaction.user.id, query);
      if (!result) return interaction.editReply(`I couldn't find a WARDOGS player matching **${query}**.`);
      if (result.statsCaptured) {
        return interaction.editReply(`Linked you to **${result.player.displayName}** and captured the first stats snapshot.`);
      }
      return interaction.editReply(
        `Linked you to **${result.player.displayName}**. WARDOGS stats are not currently available through Steam, so no stats snapshot was captured yet.`
      );
    }

    case "unlink": {
      const removed = await unlinkPlayer(guildId, interaction.user.id);
      return interaction.reply({ content: removed ? "Your WARDOGS link was removed from this server." : "You aren't linked in this server.", ephemeral: true });
    }

    case "stats": {
      await interaction.deferReply();
      const listName = interaction.options.getString("list");

      if (listName) {
        const list = await getTrackingList(guildId, interaction.user.id, listName);
        if (!list) return interaction.editReply(`You don't have a tracking list named **${listName.toLowerCase()}**.`);

        const visible = list.members.slice(0, 25);
        const lines = visible.map(member => {
          const snapshot = member.player.snapshots[0];
          if (!snapshot) return `**${member.player.displayName}** — No snapshot yet`;

          const parts: string[] = [];
          if (snapshot.playtimeMinutes !== null && snapshot.playtimeMinutes !== undefined) {
            parts.push(`⏱️ ${formatHours(snapshot.playtimeMinutes)}`);
          }
          if (snapshot.wardogLevel !== null && snapshot.wardogLevel !== undefined) {
            parts.push(`Wardog ${formatNumber(snapshot.wardogLevel)}`);
          }
          if (snapshot.kills !== null && snapshot.kills !== undefined) {
            parts.push(`Kills ${formatNumber(snapshot.kills)}`);
          }
          const kdr = kd(snapshot.kills, snapshot.deaths);
          if (kdr !== null) parts.push(`K/D ${kdr.toFixed(2)}`);
          if (snapshot.cash !== null && snapshot.cash !== undefined) {
            parts.push(`Cash ${formatMoney(snapshot.cash)}`);
          }

          return `**${member.player.displayName}** — ${parts.join(" • ") || "No available stats"}`;
        });
        if (list.members.length > visible.length) lines.push(`_…and ${list.members.length - visible.length} more players._`);

        const embed = new EmbedBuilder()
          .setTitle(`📊 ${list.name} — latest stats`)
          .setDescription(lines.join("\n") || "No players are being tracked in this list yet.")
          .setFooter({ text: `${list.members.length} tracked player${list.members.length === 1 ? "" : "s"} • use /list sync to refresh` })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      const user = interaction.options.getUser("member") ?? interaction.user;
      const link = await getLinkedPlayer(guildId, user.id);
      if (!link) return interaction.editReply(`${user} hasn't linked a WARDOGS account yet.`);
      const snapshot = link.player.snapshots[0];
      if (!snapshot) {
        return interaction.editReply(
          `**${link.player.displayName}** is linked, but WARDOGS stats are not currently available through Steam.`
        );
      }

      const [serverRank, global] = await Promise.all([
        getServerRank(guildId, user.id, "level"),
        wardogsProvider.getGlobalRank?.(link.player.providerPlayerId, "level").catch(() => null)
      ]);

      return interaction.editReply({ embeds: [statsEmbed(link.player.displayName, snapshot, serverRank, global?.rank)] });
    }

    case "hours": {
      await interaction.deferReply();
      const user = interaction.options.getUser("member") ?? interaction.user;
      const link = await getLinkedPlayer(guildId, user.id);
      if (!link) return interaction.editReply(`${user} hasn't linked a WARDOGS account yet.`);

      try {
        const stats = await syncPlayer(link.player.id, link.player.providerPlayerId);
        if (stats.playtimeMinutes === undefined) {
          return interaction.editReply(
            `Steam isn't exposing WARDOGS playtime for **${link.player.displayName}**. Their Steam Game Details may be private.`
          );
        }
        return interaction.editReply(
          `⏱️ **${link.player.displayName}** has **${formatHours(stats.playtimeMinutes)}** played in WARDOGS on Steam.`
        );
      } catch (error) {
        const snapshot = link.player.snapshots[0];
        if (snapshot?.playtimeMinutes !== null && snapshot?.playtimeMinutes !== undefined) {
          return interaction.editReply(
            `⏱️ **${link.player.displayName}** has **${formatHours(snapshot.playtimeMinutes)}** played in WARDOGS on Steam.\n` +
            `_Steam couldn't refresh playtime just now, so this is the latest stored value._`
          );
        }
        throw error;
      }
    }

    case "list": {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "show") await interaction.deferReply();
      else await interaction.deferReply({ ephemeral: true });

      if (subcommand === "create") {
        const name = interaction.options.getString("name", true);
        const list = await createTrackingList(guildId, interaction.user.id, name);
        return interaction.editReply(`Created tracking list **${list.name}**.`);
      }

      if (subcommand === "add") {
        const name = interaction.options.getString("name", true);
        const query = interaction.options.getString("player", true);
        const result = await addPlayerToTrackingList(guildId, interaction.user.id, name, query);
        if (result.alreadyTracked) {
          return interaction.editReply(`**${result.player.displayName}** is already on **${name.toLowerCase()}**.`);
        }
        return interaction.editReply(
          `Added **${result.player.displayName}** to **${name.toLowerCase()}**.${result.synced ? " Steam playtime was refreshed." : " The player is tracked, but Steam data was not available right now."}`
        );
      }

      if (subcommand === "remove") {
        const name = interaction.options.getString("name", true);
        const query = interaction.options.getString("player", true);
        const removedName = await removePlayerFromTrackingList(guildId, interaction.user.id, name, query);
        return interaction.editReply(
          removedName
            ? `Removed **${removedName}** from **${name.toLowerCase()}**.`
            : `I couldn't find **${query}** on **${name.toLowerCase()}**.`
        );
      }

      if (subcommand === "show") {
        const name = interaction.options.getString("name", true);
        const list = await getTrackingList(guildId, interaction.user.id, name);
        if (!list) return interaction.editReply(`You don't have a tracking list named **${name.toLowerCase()}**.`);

        const sorted = [...list.members].sort((a, b) => {
          const aMinutes = a.player.snapshots[0]?.playtimeMinutes ?? -1;
          const bMinutes = b.player.snapshots[0]?.playtimeMinutes ?? -1;
          return bMinutes - aMinutes;
        });
        const visible = sorted.slice(0, 25);
        const lines = visible.map((member, index) => {
          const minutes = member.player.snapshots[0]?.playtimeMinutes;
          const hours = minutes === null || minutes === undefined ? "—" : formatHours(minutes);
          return `**${index + 1}. ${member.player.displayName}** — ${hours}`;
        });
        if (sorted.length > visible.length) lines.push(`_…and ${sorted.length - visible.length} more players._`);

        const embed = new EmbedBuilder()
          .setTitle(`📋 ${list.name}`)
          .setDescription(lines.join("\n") || "No players are being tracked in this list yet.")
          .setFooter({ text: `${list.members.length} tracked player${list.members.length === 1 ? "" : "s"} • ranked by Steam hours` })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "sync") {
        const name = interaction.options.getString("name", true);
        const result = await syncTrackingList(guildId, interaction.user.id, name);
        return interaction.editReply(
          `Refreshed **${result.listName}**: **${result.synced}/${result.total}** players synced${result.failed ? `, **${result.failed}** unavailable` : ""}.`
        );
      }

      if (subcommand === "delete") {
        const name = interaction.options.getString("name", true);
        const deleted = await deleteTrackingList(guildId, interaction.user.id, name);
        return interaction.editReply(
          deleted ? `Deleted tracking list **${name.toLowerCase()}**.` : `You don't have a tracking list named **${name.toLowerCase()}**.`
        );
      }

      if (subcommand === "all") {
        const lists = await listTrackingLists(guildId, interaction.user.id);
        if (!lists.length) return interaction.editReply("You don't have any tracking lists yet. Use `/list create` to make one.");
        return interaction.editReply(
          lists.map(list => `**${list.name}** — ${list._count.members} player${list._count.members === 1 ? "" : "s"}`).join("\n")
        );
      }

      return interaction.editReply("Unknown list command.");
    }

    case "leaderboard": {
      await interaction.deferReply();
      const metric = interaction.options.getString("metric", true) as Metric;
      const scope = interaction.options.getString("scope", true);
      const limit = interaction.options.getInteger("limit") ?? 10;

      if (scope === "list") {
        const listName = interaction.options.getString("list");
        if (!listName) {
          return interaction.editReply("Choose one of your tracking lists with the `list` option when using the Tracking list scope.");
        }
        const result = await getTrackingListLeaderboard(guildId, interaction.user.id, listName, metric, limit);
        if (!result) return interaction.editReply(`You don't have a tracking list named **${listName.toLowerCase()}**.`);
        return interaction.editReply({
          embeds: [leaderboardEmbed(`📋 ${result.listName} — ${metricLabel(metric)}`, metric, result.rows)]
        });
      }

      const rows = scope === "global"
        ? await getGlobalLeaderboard(metric, limit)
        : await getServerLeaderboard(guildId, metric, limit);

      const title = scope === "global"
        ? `🌎 WARDOGS Global — ${metricLabel(metric)}`
        : `🏠 ${interaction.guild?.name ?? "Discord"} — ${metricLabel(metric)}`;
      return interaction.editReply({ embeds: [leaderboardEmbed(title, metric, rows)] });
    }

    case "rank": {
      await interaction.deferReply();
      const metric = interaction.options.getString("metric", true) as Metric;
      const user = interaction.options.getUser("member") ?? interaction.user;
      const link = await getLinkedPlayer(guildId, user.id);
      if (!link) return interaction.editReply(`${user} hasn't linked a WARDOGS account yet.`);

      const [server, global] = await Promise.all([
        getServerRank(guildId, user.id, metric),
        wardogsProvider.getGlobalRank?.(link.player.providerPlayerId, metric).catch(() => null)
      ]);

      const globalText = global
        ? `#${global.rank}${global.totalPlayers ? ` / ${global.totalPlayers}` : ""} (${global.source})`
        : "Unavailable from the current provider";
      return interaction.editReply(
        `**${link.player.displayName} — ${metricLabel(metric)}**\n` +
        `Discord: ${server ? `#${server.rank} / ${server.totalPlayers}` : "Unranked"}\n` +
        `Global: ${globalText}`
      );
    }

    case "compare": {
      await interaction.deferReply();
      const other = interaction.options.getUser("member", true);
      const [a, b] = await Promise.all([
        getLinkedPlayer(guildId, interaction.user.id),
        getLinkedPlayer(guildId, other.id)
      ]);
      if (!a) return interaction.editReply("Link your account first with `/link`.");
      if (!b) return interaction.editReply(`${other} hasn't linked a WARDOGS account yet.`);
      const sa = a.player.snapshots[0];
      const sb = b.player.snapshots[0];
      if (!sa) return interaction.editReply(`**${a.player.displayName}** is linked, but WARDOGS stats are not currently available through Steam.`);
      if (!sb) return interaction.editReply(`**${b.player.displayName}** is linked, but WARDOGS stats are not currently available through Steam.`);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${a.player.displayName} vs ${b.player.displayName}`)
        .addFields(
          { name: "Wardog", value: `${formatNumber(sa.wardogLevel)}  |  ${formatNumber(sb.wardogLevel)}` },
          { name: "Cash", value: `${formatMoney(sa.cash)}  |  ${formatMoney(sb.cash)}` },
          { name: "Kills", value: `${formatNumber(sa.kills)}  |  ${formatNumber(sb.kills)}` },
          { name: "Deaths", value: `${formatNumber(sa.deaths)}  |  ${formatNumber(sb.deaths)}` },
          { name: "K/D", value: `${kd(sa.kills, sa.deaths)?.toFixed(2) ?? "—"}  |  ${kd(sb.kills, sb.deaths)?.toFixed(2) ?? "—"}` }
        )
        .setFooter({ text: `${interaction.user.username} | ${other.username}` });
      return interaction.editReply({ embeds: [embed] });
    }

    case "progress": {
      await interaction.deferReply();
      const user = interaction.options.getUser("member") ?? interaction.user;
      const days = interaction.options.getInteger("days") ?? 7;
      const progress = await getPlayerProgress(guildId, user.id, days);
      if (!progress?.start || !progress.latest) return interaction.editReply(`Not enough snapshot history for ${user} yet.`);

      const { start, latest, player } = progress;
      const delta = (a: bigint | number | null, b: bigint | number | null) => Number(a ?? 0) - Number(b ?? 0);
      const periodKills = delta(latest.kills, start.kills);
      const periodDeaths = delta(latest.deaths, start.deaths);

      const embed = new EmbedBuilder()
        .setTitle(`📈 ${player.displayName} — ${days} day progress`)
        .addFields(
          { name: "Wardog", value: `${formatNumber(start.wardogLevel)} → ${formatNumber(latest.wardogLevel)} (${delta(latest.wardogLevel, start.wardogLevel) >= 0 ? "+" : ""}${delta(latest.wardogLevel, start.wardogLevel)})` },
          { name: "Cash", value: `${formatMoney(start.cash)} → ${formatMoney(latest.cash)} (${formatMoney(delta(latest.cash, start.cash))})` },
          { name: "Kills gained", value: formatNumber(periodKills), inline: true },
          { name: "Deaths gained", value: formatNumber(periodDeaths), inline: true },
          { name: "Period K/D", value: periodDeaths > 0 ? (periodKills / periodDeaths).toFixed(2) : formatNumber(periodKills), inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    case "sync": {
      await interaction.deferReply({ ephemeral: true });
      const link = await getLinkedPlayer(guildId, interaction.user.id);
      if (!link) return interaction.editReply("Link your account first with `/link`.");
      await syncPlayer(link.player.id, link.player.providerPlayerId);
      return interaction.editReply("Stats refreshed and a new snapshot was stored.");
    }
  }
}
