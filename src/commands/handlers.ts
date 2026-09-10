import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import type { Metric } from "../metrics.js";
import { metricLabel } from "../metrics.js";
import { wardogsProvider } from "../providers/index.js";
import { getGlobalLeaderboard, getServerLeaderboard, getServerRank } from "../services/leaderboard-service.js";
import { getLinkedPlayer, getPlayerProgress, linkPlayer, syncPlayer, unlinkPlayer } from "../services/player-service.js";
import { leaderboardEmbed, statsEmbed } from "../utils/embeds.js";
import { formatMoney, formatNumber, kd } from "../utils/format.js";

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
      const player = await linkPlayer(guildId, interaction.user.id, query);
      if (!player) return interaction.editReply(`I couldn't find a WARDOGS player matching **${query}**.`);
      return interaction.editReply(`Linked you to **${player.displayName}** and captured the first stats snapshot.`);
    }

    case "unlink": {
      const removed = await unlinkPlayer(guildId, interaction.user.id);
      return interaction.reply({ content: removed ? "Your WARDOGS link was removed from this server." : "You aren't linked in this server.", ephemeral: true });
    }

    case "stats": {
      await interaction.deferReply();
      const user = interaction.options.getUser("member") ?? interaction.user;
      const link = await getLinkedPlayer(guildId, user.id);
      const snapshot = link?.player.snapshots[0];
      if (!link || !snapshot) return interaction.editReply(`${user} hasn't linked a WARDOGS account yet.`);

      const [serverRank, global] = await Promise.all([
        getServerRank(guildId, user.id, "level"),
        wardogsProvider.getGlobalRank?.(link.player.providerPlayerId, "level").catch(() => null)
      ]);

      return interaction.editReply({ embeds: [statsEmbed(link.player.displayName, snapshot, serverRank, global?.rank)] });
    }

    case "leaderboard": {
      await interaction.deferReply();
      const metric = interaction.options.getString("metric", true) as Metric;
      const scope = interaction.options.getString("scope", true);
      const limit = interaction.options.getInteger("limit") ?? 10;
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
      const sa = a?.player.snapshots[0];
      const sb = b?.player.snapshots[0];
      if (!a || !sa) return interaction.editReply("Link your account first with `/link`. ");
      if (!b || !sb) return interaction.editReply(`${other} hasn't linked a WARDOGS account yet.`);

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
