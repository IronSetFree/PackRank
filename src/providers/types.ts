import type { Metric } from "../metrics.js";

export interface PlayerIdentity {
  id: string;
  displayName: string;
}

export interface PlayerStats {
  player: PlayerIdentity;
  capturedAt: Date;
  season: string;
  playtimeMinutes?: number;
  wardogLevel?: number;
  totalXp?: number;
  cash?: number;
  accountWorth?: number;
  gold?: number;
  unlocks?: number;
  kills?: number;
  deaths?: number;
  matches?: number;
  wins?: number;
  assaultLevel?: number;
  medicLevel?: number;
  reconLevel?: number;
  supportLevel?: number;
  driverLevel?: number;
  pilotLevel?: number;
  xpPerMinute?: number;
  cashPerMinute?: number;
}

export interface GlobalLeaderboardRow {
  player: PlayerIdentity;
  metric: Metric;
  value: number;
  rank: number;
  totalPlayers?: number;
  asOf: Date;
  source: string;
}

export interface WardogsProvider {
  readonly name: string;
  resolvePlayer(query: string): Promise<PlayerIdentity | null>;
  getPlayerStats(playerId: string): Promise<PlayerStats>;
  getGlobalLeaderboard(metric: Metric, limit: number): Promise<GlobalLeaderboardRow[]>;
  getGlobalRank?(playerId: string, metric: Metric): Promise<GlobalLeaderboardRow | null>;
}
