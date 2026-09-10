import type { Metric } from "../metrics.js";
import type { GlobalLeaderboardRow, PlayerIdentity, PlayerStats, WardogsProvider } from "./types.js";

/**
 * Adapter for a future authorized WARDOGS API.
 *
 * Expected contract:
 *   GET /players/resolve?q=<name>                -> PlayerIdentity | null
 *   GET /players/:id/stats                      -> PlayerStats-shaped JSON
 *   GET /leaderboards/:metric?limit=25          -> GlobalLeaderboardRow[]
 *   GET /players/:id/rank/:metric               -> GlobalLeaderboardRow | null
 *
 * Keep all game-specific endpoint changes in this file.
 */
export class HttpWardogsProvider implements WardogsProvider {
  readonly name = "http";

  constructor(
    private readonly baseUrl: string,
    private readonly token?: string
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined
    });

    if (!response.ok) {
      throw new Error(`WARDOGS API ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async resolvePlayer(query: string): Promise<PlayerIdentity | null> {
    return this.request<PlayerIdentity | null>(`/players/resolve?q=${encodeURIComponent(query)}`);
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const data = await this.request<Omit<PlayerStats, "capturedAt"> & { capturedAt: string }>(
      `/players/${encodeURIComponent(playerId)}/stats`
    );
    return { ...data, capturedAt: new Date(data.capturedAt) };
  }

  async getGlobalLeaderboard(metric: Metric, limit: number): Promise<GlobalLeaderboardRow[]> {
    const rows = await this.request<Array<Omit<GlobalLeaderboardRow, "asOf"> & { asOf: string }>>(
      `/leaderboards/${metric}?limit=${limit}`
    );
    return rows.map(row => ({ ...row, asOf: new Date(row.asOf) }));
  }

  async getGlobalRank(playerId: string, metric: Metric): Promise<GlobalLeaderboardRow | null> {
    const row = await this.request<(Omit<GlobalLeaderboardRow, "asOf"> & { asOf: string }) | null>(
      `/players/${encodeURIComponent(playerId)}/rank/${metric}`
    );
    return row ? { ...row, asOf: new Date(row.asOf) } : null;
  }
}
