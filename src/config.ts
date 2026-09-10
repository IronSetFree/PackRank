import "dotenv/config";
import { z } from "zod";

const optionalString = z.string().optional().transform(v => v?.trim() || undefined);

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: optionalString,
  DATABASE_URL: z.string().min(1),
  WARDOGS_PROVIDER: z.enum(["mock", "steam", "http"]).default("mock"),
  WARDOGS_API_BASE_URL: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  WARDOGS_API_TOKEN: optionalString,
  STEAM_API_KEY: optionalString,
  WARDOGS_STEAM_APP_ID: z.coerce.number().int().positive().default(1867240),
  WARDOGS_STEAM_STAT_LEVEL: optionalString,
  WARDOGS_STEAM_STAT_XP: optionalString,
  WARDOGS_STEAM_STAT_CASH: optionalString,
  WARDOGS_STEAM_STAT_WORTH: optionalString,
  WARDOGS_STEAM_STAT_GOLD: optionalString,
  WARDOGS_STEAM_STAT_UNLOCKS: optionalString,
  WARDOGS_STEAM_STAT_KILLS: optionalString,
  WARDOGS_STEAM_STAT_DEATHS: optionalString,
  WARDOGS_STEAM_STAT_MATCHES: optionalString,
  WARDOGS_STEAM_STAT_WINS: optionalString,
  WARDOGS_STEAM_STAT_ASSAULT: optionalString,
  WARDOGS_STEAM_STAT_MEDIC: optionalString,
  WARDOGS_STEAM_STAT_RECON: optionalString,
  WARDOGS_STEAM_STAT_SUPPORT: optionalString,
  WARDOGS_STEAM_STAT_DRIVER: optionalString,
  WARDOGS_STEAM_STAT_PILOT: optionalString,
  WARDOGS_STEAM_STAT_XPMIN: optionalString,
  WARDOGS_STEAM_STAT_CASHMIN: optionalString,
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(15),
  WARDOGS_SEASON: z.string().default("Season 01")
});

export const config = schema.parse(process.env);
