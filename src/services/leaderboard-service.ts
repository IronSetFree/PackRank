import { prisma } from "../db.js";
import type { Metric } from "../metrics.js";
import { wardogsProvider } from "../providers/index.js";
import { kd, winRate } from "../utils/format.js";

export interface LeaderboardEntry {
  playerId: bigint | null;
  displayName: string;
  discordUserId?: string;
  value: number | bigint;
  rank: number;
  totalPlayers: number;
  globalRank?: number;
  globalTotalPlayers?: number;
  source?: string;
}

function valueForMetric(snapshot: any, metric: Metric): number | bigint | null {
  switch (metric) {
    case "level": return snapshot.wardogLevel;
    case "xp": return snapshot.totalXp;
    case "cash": return snapshot.cash;
    case "worth": return snapshot.accountWorth;
    case "kills": return snapshot.kills;
    case "deaths": return snapshot.deaths;
    case "kd": return kd(snapshot.kills, snapshot.deaths);
    case "wins": return snapshot.wins;
    case "winrate": return winRate(snapshot.wins, snapshot.matches);
    case "unlocks": return snapshot.unlocks;
    case "gold": return snapshot.gold;
    case "assault": return snapshot.assaultLevel;
    case "medic": return snapshot.medicLevel;
    case "recon": return snapshot.reconLevel;
    case "support": return snapshot.supportLevel;
    case "driver": return snapshot.driverLevel;
    case "pilot": return snapshot.pilotLevel;
    case "xpmin": return snapshot.xpPerMinute;
    case "cashmin": return snapshot.cashPerMinute;
  }
}

export async function getServerLeaderboard(guildId: string, metric: Metric, limit = 10): Promise<LeaderboardEntry[]> {
  const links = await prisma.discordLink.findMany({
    where: { guildId },
    include: {
      player: {
        include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } }
      }
    }
  });

  const rows = links.flatMap(link => {
    const snapshot = link.player.snapshots[0];
    if (!snapshot) return [];
    const value = valueForMetric(snapshot, metric);
    if (value === null || value === undefined) return [];
    return [{
      playerId: link.player.id,
      providerPlayerId: link.player.providerPlayerId,
      displayName: link.player.displayName,
      discordUserId: link.discordUserId,
      value
    }];
  });

  rows.sort((a, b) => Number(b.value) - Number(a.value));

  const selected = rows.slice(0, limit);
  const withRanks = await Promise.all(selected.map(async (row, index) => {
    let globalRank: number | undefined;
    let globalTotalPlayers: number | undefined;

    if (wardogsProvider.getGlobalRank) {
      try {
        const global = await wardogsProvider.getGlobalRank(row.providerPlayerId, metric);
        globalRank = global?.rank;
        globalTotalPlayers = global?.totalPlayers;
      } catch {
        // A global rank is useful enrichment, not a requirement for a guild leaderboard.
      }
    }

    return {
      playerId: row.playerId,
      displayName: row.displayName,
      discordUserId: row.discordUserId,
      value: row.value,
      rank: index + 1,
      totalPlayers: rows.length,
      globalRank,
      globalTotalPlayers
    } satisfies LeaderboardEntry;
  }));

  return withRanks;
}

export async function getGlobalLeaderboard(metric: Metric, limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await wardogsProvider.getGlobalLeaderboard(metric, limit);
  const totalPlayers = rows[0]?.totalPlayers ?? rows.length;

  return rows.map(row => ({
    playerId: null,
    displayName: row.player.displayName,
    value: row.value,
    rank: row.rank,
    totalPlayers,
    source: row.source
  }));
}

export async function getServerRank(guildId: string, discordUserId: string, metric: Metric) {
  const all = await getServerLeaderboard(guildId, metric, 10_000);
  return all.find(row => row.discordUserId === discordUserId) ?? null;
}
