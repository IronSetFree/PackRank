import { EmbedBuilder } from "discord.js";
import type { Metric } from "../metrics.js";
import { metricLabel } from "../metrics.js";
import type { LeaderboardEntry } from "../services/leaderboard-service.js";
import { formatHours, formatMetric, formatMoney, formatNumber, kd, winRate } from "./format.js";

export function statsEmbed(displayName: string, snapshot: any, serverRank?: LeaderboardEntry | null, globalRank?: number | null) {
  const kdr = kd(snapshot.kills, snapshot.deaths);
  const wr = winRate(snapshot.wins, snapshot.matches);

  const embed = new EmbedBuilder()
    .setTitle(`🐕 WARDOGS — ${displayName}`)
    .setTimestamp(snapshot.capturedAt)
    .addFields(
      { name: "Hours Played", value: formatHours(snapshot.playtimeMinutes), inline: true },
      { name: "Wardog", value: formatNumber(snapshot.wardogLevel), inline: true },
      { name: "Cash", value: formatMoney(snapshot.cash), inline: true },
      { name: "Account Worth", value: formatMoney(snapshot.accountWorth), inline: true },
      { name: "Kills", value: formatNumber(snapshot.kills), inline: true },
      { name: "Deaths", value: formatNumber(snapshot.deaths), inline: true },
      { name: "K/D", value: kdr === null ? "—" : kdr.toFixed(2), inline: true },
      { name: "Matches", value: formatNumber(snapshot.matches), inline: true },
      { name: "Wins", value: formatNumber(snapshot.wins), inline: true },
      { name: "Win Rate", value: wr === null ? "—" : `${wr.toFixed(1)}%`, inline: true }
    );

  if (serverRank) {
    embed.addFields({ name: "Discord Rank", value: `#${serverRank.rank} / ${serverRank.totalPlayers}`, inline: true });
  }
  if (globalRank) {
    embed.addFields({ name: "Global Rank", value: `#${globalRank}`, inline: true });
  }

  return embed;
}

export function leaderboardEmbed(title: string, metric: Metric, rows: LeaderboardEntry[]) {
  const lines = rows.map(row => {
    const global = row.globalRank ? ` • Global #${row.globalRank}` : "";
    return `**${row.rank}.** ${row.displayName} — **${formatMetric(metric, row.value)}**${global}`;
  });

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join("\n") || "No ranked players yet.")
    .setFooter({ text: `${metricLabel(metric)} • ${rows.length ? `${rows[0]?.totalPlayers ?? rows.length} ranked` : "no data"}` })
    .setTimestamp();
}
