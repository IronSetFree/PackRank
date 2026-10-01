export interface WardogsNowCombatStats {
  displayName?: string;
  kills?: number;
  deaths?: number;
  matches?: number;
  wins?: number;
  playtimeMinutes?: number;
  generatedAt: Date;
}

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  meta?: { generated_at?: string; cache_seconds?: number };
  error?: { code?: string; message?: string };
};

type PlayerTotals = {
  steam_id?: string;
  name?: string;
  kills?: number | null;
  deaths?: number | null;
  hours?: number | null;
  matches?: number | null;
  wins?: number | null;
};

/**
 * Optional combat-stat enrichment from WARDOGS NOW's documented public API.
 * A community server owner must explicitly enable Public API + player stat tracking.
 * Docs: https://wardogsnow.com/developers/stats-api
 */
export class WardogsNowClient {
  private readonly cache = new Map<string, { expires: number; value: WardogsNowCombatStats | null }>();

  constructor(
    private readonly serverId: number,
    private readonly baseUrl = "https://wardogsnow.com/api/public/v1/"
  ) {}

  async getPlayerCombatStats(steamId: string): Promise<WardogsNowCombatStats | null> {
    if (!/^\d{17}$/.test(steamId)) return null;
    const path = `servers/${this.serverId}/players/${steamId}`;
    const url = new URL(path, this.baseUrl).toString();
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.value;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PackRank/0.1 (+https://github.com/IronSetFree/PackRank)"
      }
    });

    if (response.status === 404) {
      this.cache.set(url, { expires: Date.now() + 60_000, value: null });
      return null;
    }
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      const detail = response.status === 429 && retry ? ` Retry after ${retry}s.` : "";
      throw new Error(`WARDOGS NOW API ${response.status}.${detail}`);
    }

    const body = await response.json() as ApiEnvelope<PlayerTotals>;
    if (!body.ok || !body.data) return null;

    const data = body.data;
    const value: WardogsNowCombatStats = {
      displayName: data.name ?? undefined,
      kills: data.kills ?? undefined,
      deaths: data.deaths ?? undefined,
      matches: data.matches ?? undefined,
      wins: data.wins ?? undefined,
      playtimeMinutes: data.hours == null ? undefined : Math.round(data.hours * 60),
      generatedAt: body.meta?.generated_at ? new Date(body.meta.generated_at) : new Date()
    };
    const cacheSeconds = Math.max(30, Math.min(300, body.meta?.cache_seconds ?? 60));
    this.cache.set(url, { expires: Date.now() + cacheSeconds * 1000, value });
    return value;
  }
}
