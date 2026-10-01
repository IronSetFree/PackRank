import type { Metric } from "../metrics.js";
import type { GlobalLeaderboardRow, PlayerIdentity, PlayerStats, WardogsProvider } from "./types.js";

type TrackerRole = { level?: number | null; xp?: number | null };
type TrackerPlayer = {
  steamId: string;
  name: string;
  stats?: {
    wardogLevel?: number | null;
    careerXp?: number | null;
    cash?: number | null;
    gold?: number | null;
    unlocks?: number | null;
    roles?: Record<string, TrackerRole | undefined> | null;
    syncedAt?: string | null;
  } | null;
  leaderboardRank?: number | null;
};
type PlayerResponse = { player: TrackerPlayer };
type LeaderboardResponse = {
  total: number;
  players: Array<{
    rank: number; steamId: string; name: string; wardogLevel?: number | null;
    careerXp?: number | null; cash?: number | null; gold?: number | null;
    unlocks?: number | null; syncedAt?: string | null;
  }>;
};

const GLOBAL_SORT: Partial<Record<Metric, string>> = {
  level: "level", xp: "xp", cash: "cash", gold: "gold", unlocks: "unlocks"
};

function steamIdFromQuery(query: string): string | null {
  const value = query.trim();
  if (/^\d{17}$/.test(value)) return value;
  const match = value.match(/steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i);
  return match?.[1] ?? null;
}

function valueFor(row: LeaderboardResponse["players"][number], metric: Metric): number | null {
  switch (metric) {
    case "level": return row.wardogLevel ?? null;
    case "xp": return row.careerXp ?? null;
    case "cash": return row.cash ?? null;
    case "gold": return row.gold ?? null;
    case "unlocks": return row.unlocks ?? null;
    default: return null;
  }
}

/** Documented, read-only WARDOGS Tracker API: https://wardogstracker.gg/developers */
export class WardogsTrackerProvider implements WardogsProvider {
  readonly name = "wardogs-tracker";
  private readonly cache = new Map<string, { expires: number; value: unknown }>();

  constructor(
    private readonly baseUrl = "https://wardogstracker.gg/api/v1/",
    private readonly cacheMs = 60_000
  ) {}

  private async request<T>(path: string): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), this.baseUrl).toString();
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.value as T;

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PackRank/0.1 (+https://github.com/IronSetFree/PackRank)" }
    });
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      const detail = response.status === 429 && retry ? ` Retry after ${retry}s.` : "";
      throw new Error(`WARDOGS Tracker API ${response.status}.${detail}`);
    }
    const value = await response.json() as T;
    this.cache.set(url, { expires: Date.now() + this.cacheMs, value });
    return value;
  }

  async resolvePlayer(query: string): Promise<PlayerIdentity | null> {
    const steamId = steamIdFromQuery(query);
    if (!steamId) return null;
    try {
      const { player } = await this.request<PlayerResponse>(`players/${steamId}`);
      return { id: player.steamId, displayName: player.name };
    } catch (error) {
      if (error instanceof Error && error.message.includes(" 404")) return null;
      throw error;
    }
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const { player } = await this.request<PlayerResponse>(`players/${encodeURIComponent(playerId)}`);
    if (!player.stats) throw new Error("This player has not synced WARDOGS stats with WARDOGS Tracker yet.");
    const roles = player.stats.roles ?? {};
    return {
      player: { id: player.steamId, displayName: player.name },
      capturedAt: player.stats.syncedAt ? new Date(player.stats.syncedAt) : new Date(),
      season: "Season 1",
      wardogLevel: player.stats.wardogLevel ?? undefined,
      totalXp: player.stats.careerXp ?? undefined,
      cash: player.stats.cash ?? undefined,
      gold: player.stats.gold ?? undefined,
      unlocks: player.stats.unlocks ?? undefined,
      assaultLevel: roles.assault?.level ?? undefined,
      medicLevel: roles.medic?.level ?? undefined,
      reconLevel: roles.recon?.level ?? undefined,
      supportLevel: roles.support?.level ?? undefined,
      driverLevel: roles.driver?.level ?? undefined,
      pilotLevel: roles.pilot?.level ?? undefined
    };
  }

  async getGlobalLeaderboard(metric: Metric, limit: number): Promise<GlobalLeaderboardRow[]> {
    const sort = GLOBAL_SORT[metric];
    if (!sort) return [];
    const safeLimit = Math.max(1, Math.min(100, limit));
    const data = await this.request<LeaderboardResponse>(`leaderboard?sort=${sort}&limit=${safeLimit}&offset=0`);
    const asOf = new Date();
    return data.players.flatMap(row => {
      const value = valueFor(row, metric);
      if (value === null) return [];
      return [{
        player: { id: row.steamId, displayName: row.name },
        metric, value, rank: row.rank, totalPlayers: data.total,
        asOf: row.syncedAt ? new Date(row.syncedAt) : asOf,
        source: "WARDOGS Tracker"
      }];
    });
  }

  async getGlobalRank(playerId: string, metric: Metric): Promise<GlobalLeaderboardRow | null> {
    if (metric !== "level") return null;
    try {
      const { player } = await this.request<PlayerResponse>(`players/${encodeURIComponent(playerId)}`);
      if (!player.stats || !player.leaderboardRank || player.stats.wardogLevel == null) return null;
      return {
        player: { id: player.steamId, displayName: player.name },
        metric, value: player.stats.wardogLevel, rank: player.leaderboardRank,
        asOf: player.stats.syncedAt ? new Date(player.stats.syncedAt) : new Date(),
        source: "WARDOGS Tracker"
      };
    } catch {
      return null;
    }
  }
}
