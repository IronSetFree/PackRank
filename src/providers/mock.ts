import type { Metric } from "../metrics.js";
import type { GlobalLeaderboardRow, PlayerIdentity, PlayerStats, WardogsProvider } from "./types.js";

const names = [
  "Falcon#2839",
  "Nathaaaan#0934",
  "BrokenInternet#4410",
  "MedicMike#1177",
  "TacticalTim#5521",
  "JohnDoe#1234",
  "Dave#9001",
  "ReconRick#0412"
];

const identities: PlayerIdentity[] = names.map((displayName, i) => ({
  id: `mock-${i + 1}`,
  displayName
}));

function seedNumber(id: string): number {
  return [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function makeStats(player: PlayerIdentity): PlayerStats {
  const seed = seedNumber(player.id);
  const kills = 900 + seed * 7;
  const deaths = 500 + seed * 3;
  const matches = 50 + (seed % 80);
  const wins = Math.floor(matches * (0.42 + (seed % 20) / 100));

  return {
    player,
    capturedAt: new Date(),
    season: "Season 01",
    wardogLevel: 25 + (seed % 90),
    totalXp: 50_000 + seed * 333,
    cash: 50_000 + seed * 1_250,
    accountWorth: 450_000 + seed * 4_100,
    gold: seed % 140,
    unlocks: 20 + (seed % 45),
    kills,
    deaths,
    matches,
    wins,
    assaultLevel: seed % 30,
    medicLevel: (seed + 4) % 30,
    reconLevel: (seed + 8) % 30,
    supportLevel: (seed + 12) % 30,
    driverLevel: (seed + 16) % 30,
    pilotLevel: (seed + 20) % 30,
    xpPerMinute: 180 + (seed % 260),
    cashPerMinute: 800 + (seed % 2500)
  };
}

function metricValue(stats: PlayerStats, metric: Metric): number {
  switch (metric) {
    case "level": return stats.wardogLevel ?? 0;
    case "xp": return stats.totalXp ?? 0;
    case "cash": return stats.cash ?? 0;
    case "worth": return stats.accountWorth ?? 0;
    case "kills": return stats.kills ?? 0;
    case "deaths": return stats.deaths ?? 0;
    case "kd": return (stats.kills ?? 0) / Math.max(stats.deaths ?? 0, 1);
    case "wins": return stats.wins ?? 0;
    case "winrate": return ((stats.wins ?? 0) / Math.max(stats.matches ?? 0, 1)) * 100;
    case "unlocks": return stats.unlocks ?? 0;
    case "gold": return stats.gold ?? 0;
    case "assault": return stats.assaultLevel ?? 0;
    case "medic": return stats.medicLevel ?? 0;
    case "recon": return stats.reconLevel ?? 0;
    case "support": return stats.supportLevel ?? 0;
    case "driver": return stats.driverLevel ?? 0;
    case "pilot": return stats.pilotLevel ?? 0;
    case "xpmin": return stats.xpPerMinute ?? 0;
    case "cashmin": return stats.cashPerMinute ?? 0;
  }
}

export class MockWardogsProvider implements WardogsProvider {
  readonly name = "mock";

  async resolvePlayer(query: string): Promise<PlayerIdentity | null> {
    const normalized = query.toLowerCase();
    const exact = identities.find(p => p.displayName.toLowerCase() === normalized);
    if (exact) return exact;

    const partial = identities.find(p => p.displayName.toLowerCase().includes(normalized));
    if (partial) return partial;

    // Lets you link arbitrary names during development.
    return { id: `mock-custom-${normalized.replace(/[^a-z0-9]/g, "-")}`, displayName: query };
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const player = identities.find(p => p.id === playerId) ?? {
      id: playerId,
      displayName: playerId.replace(/^mock-custom-/, "")
    };
    return makeStats(player);
  }

  async getGlobalLeaderboard(metric: Metric, limit: number): Promise<GlobalLeaderboardRow[]> {
    const rows = identities
      .map(player => ({ player, stats: makeStats(player) }))
      .sort((a, b) => metricValue(b.stats, metric) - metricValue(a.stats, metric));

    return rows.slice(0, limit).map((row, index) => ({
      player: row.player,
      metric,
      value: metricValue(row.stats, metric),
      rank: index + 1,
      totalPlayers: rows.length,
      asOf: new Date(),
      source: this.name
    }));
  }

  async getGlobalRank(playerId: string, metric: Metric): Promise<GlobalLeaderboardRow | null> {
    const rows = await this.getGlobalLeaderboard(metric, identities.length);
    return rows.find(r => r.player.id === playerId) ?? null;
  }
}
