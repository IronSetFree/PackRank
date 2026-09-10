import type { Metric } from "../metrics.js";
import type { GlobalLeaderboardRow, PlayerIdentity, PlayerStats, WardogsProvider } from "./types.js";

const STEAM_API_BASE = "https://api.steampowered.com";

export interface SteamStatNameOverrides {
  wardogLevel?: string;
  totalXp?: string;
  cash?: string;
  accountWorth?: string;
  gold?: string;
  unlocks?: string;
  kills?: string;
  deaths?: string;
  matches?: string;
  wins?: string;
  assaultLevel?: string;
  medicLevel?: string;
  reconLevel?: string;
  supportLevel?: string;
  driverLevel?: string;
  pilotLevel?: string;
  xpPerMinute?: string;
  cashPerMinute?: string;
}

export interface SteamWardogsProviderOptions {
  apiKey: string;
  appId?: number;
  season?: string;
  statNames?: SteamStatNameOverrides;
}

interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
}

interface SteamUserStat {
  name: string;
  value: number;
}

interface SteamUserStatsResponse {
  playerstats?: {
    steamID?: string;
    gameName?: string;
    stats?: SteamUserStat[];
  };
}

function normalizeStatName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseSteamIdentity(query: string): { steamId?: string; vanity?: string } {
  const trimmed = query.trim();
  if (/^\d{17}$/.test(trimmed)) return { steamId: trimmed };

  try {
    const url = new URL(trimmed);
    if (url.hostname === "steamcommunity.com" || url.hostname === "www.steamcommunity.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "profiles" && parts[1] && /^\d{17}$/.test(parts[1])) {
        return { steamId: parts[1] };
      }
      if (parts[0] === "id" && parts[1]) return { vanity: parts[1] };
    }
  } catch {
    // A plain Steam vanity name is also accepted.
  }

  return trimmed ? { vanity: trimmed } : {};
}

export class SteamWardogsProvider implements WardogsProvider {
  readonly name = "steam";
  private readonly apiKey: string;
  private readonly appId: number;
  private readonly season: string;
  private readonly statNames: SteamStatNameOverrides;

  constructor(options: SteamWardogsProviderOptions) {
    this.apiKey = options.apiKey;
    this.appId = options.appId ?? 1867240;
    this.season = options.season ?? "Season 01";
    this.statNames = options.statNames ?? {};
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, STEAM_API_BASE);
    url.searchParams.set("key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Steam Web API ${response.status}: ${text.slice(0, 300) || response.statusText}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Steam Web API returned a non-JSON response.");
    }
  }

  private async resolveVanity(vanity: string): Promise<string | null> {
    const data = await this.request<{ response?: { success?: number; steamid?: string } }>(
      "/ISteamUser/ResolveVanityURL/v1/",
      { vanityurl: vanity }
    );
    return data.response?.success === 1 ? data.response.steamid ?? null : null;
  }

  private async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
    const data = await this.request<{ response?: { players?: SteamPlayerSummary[] } }>(
      "/ISteamUser/GetPlayerSummaries/v2/",
      { steamids: steamId }
    );
    return data.response?.players?.[0] ?? null;
  }

  private getStat(stats: SteamUserStat[], override: string | undefined, aliases: string[]): number | undefined {
    const byNormalizedName = new Map(stats.map(stat => [normalizeStatName(stat.name), stat.value]));

    if (override) {
      const explicit = byNormalizedName.get(normalizeStatName(override));
      if (explicit !== undefined) return explicit;
    }

    for (const alias of aliases) {
      const value = byNormalizedName.get(normalizeStatName(alias));
      if (value !== undefined) return value;
    }

    return undefined;
  }

  async resolvePlayer(query: string): Promise<PlayerIdentity | null> {
    const parsed = parseSteamIdentity(query);
    const steamId = parsed.steamId ?? (parsed.vanity ? await this.resolveVanity(parsed.vanity) : null);
    if (!steamId) return null;

    const summary = await this.getPlayerSummary(steamId);
    if (!summary) return null;
    return { id: summary.steamid, displayName: summary.personaname };
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const [summary, response] = await Promise.all([
      this.getPlayerSummary(playerId),
      this.request<SteamUserStatsResponse>("/ISteamUserStats/GetUserStatsForGame/v2/", {
        steamid: playerId,
        appid: this.appId
      })
    ]);

    if (!summary) throw new Error(`Steam user ${playerId} could not be resolved.`);

    const stats = response.playerstats?.stats ?? [];
    if (stats.length === 0) {
      throw new Error(
        "Steam returned no published WARDOGS user stats. The player's Game Details may be private, " +
        "or WARDOGS may not publish progression/combat stats through Steam yet."
      );
    }

    const mapped: Omit<PlayerStats, "player" | "capturedAt" | "season"> = {
      wardogLevel: this.getStat(stats, this.statNames.wardogLevel, ["wardog_level", "wardoglevel", "player_level"]),
      totalXp: this.getStat(stats, this.statNames.totalXp, ["total_xp", "wardog_xp", "wardogxp", "player_xp"]),
      cash: this.getStat(stats, this.statNames.cash, ["cash", "player_cash", "balance"]),
      accountWorth: this.getStat(stats, this.statNames.accountWorth, ["account_worth", "accountworth", "net_worth"]),
      gold: this.getStat(stats, this.statNames.gold, ["gold", "player_gold"]),
      unlocks: this.getStat(stats, this.statNames.unlocks, ["unlocks", "unlocks_count", "unlock_count"]),
      kills: this.getStat(stats, this.statNames.kills, ["kills", "total_kills", "player_kills"]),
      deaths: this.getStat(stats, this.statNames.deaths, ["deaths", "total_deaths", "player_deaths"]),
      matches: this.getStat(stats, this.statNames.matches, ["matches", "matches_played", "games_played"]),
      wins: this.getStat(stats, this.statNames.wins, ["wins", "matches_won", "games_won"]),
      assaultLevel: this.getStat(stats, this.statNames.assaultLevel, ["assault_level", "assaultlevel"]),
      medicLevel: this.getStat(stats, this.statNames.medicLevel, ["medic_level", "mediclevel"]),
      reconLevel: this.getStat(stats, this.statNames.reconLevel, ["recon_level", "reconlevel"]),
      supportLevel: this.getStat(stats, this.statNames.supportLevel, ["support_level", "supportlevel"]),
      driverLevel: this.getStat(stats, this.statNames.driverLevel, ["driver_level", "driverlevel"]),
      pilotLevel: this.getStat(stats, this.statNames.pilotLevel, ["pilot_level", "pilotlevel"]),
      xpPerMinute: this.getStat(stats, this.statNames.xpPerMinute, ["xp_per_minute", "xpmin"]),
      cashPerMinute: this.getStat(stats, this.statNames.cashPerMinute, ["cash_per_minute", "cashmin"])
    };

    if (!Object.values(mapped).some(value => value !== undefined)) {
      throw new Error(
        `Steam returned ${stats.length} WARDOGS stats, but none match PackRank's configured mappings. ` +
        "Run `npm run steam:probe -- <SteamID64>` and set the WARDOGS_STEAM_STAT_* names in .env."
      );
    }

    return {
      player: { id: summary.steamid, displayName: summary.personaname },
      capturedAt: new Date(),
      season: this.season,
      ...mapped
    };
  }

  async getGlobalLeaderboard(_metric: Metric, _limit: number): Promise<GlobalLeaderboardRow[]> {
    throw new Error(
      "The documented Steam Web API does not expose a WARDOGS global player leaderboard. " +
      "Use the Discord-server leaderboard until BULKHEAD provides an authorized global leaderboard source."
    );
  }
}
