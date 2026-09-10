import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional().transform(v => v || undefined),
  DATABASE_URL: z.string().min(1),
  WARDOGS_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  WARDOGS_API_BASE_URL: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  WARDOGS_API_TOKEN: z.string().optional().transform(v => v || undefined),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(15),
  WARDOGS_SEASON: z.string().default("Season 01")
});

export const config = schema.parse(process.env);
