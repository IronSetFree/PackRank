import { config } from "../config.js";
import { HttpWardogsProvider } from "./http.js";
import { MockWardogsProvider } from "./mock.js";
import { SteamWardogsProvider } from "./steam.js";
import type { WardogsProvider } from "./types.js";

export function createProvider(): WardogsProvider {
  if (config.WARDOGS_PROVIDER === "steam") {
    if (!config.STEAM_API_KEY) {
      throw new Error("STEAM_API_KEY is required when WARDOGS_PROVIDER=steam");
    }

    return new SteamWardogsProvider({
      apiKey: config.STEAM_API_KEY,
      appId: config.WARDOGS_STEAM_APP_ID,
      season: config.WARDOGS_SEASON,
      statNames: {
        wardogLevel: config.WARDOGS_STEAM_STAT_LEVEL,
        totalXp: config.WARDOGS_STEAM_STAT_XP,
        cash: config.WARDOGS_STEAM_STAT_CASH,
        accountWorth: config.WARDOGS_STEAM_STAT_WORTH,
        gold: config.WARDOGS_STEAM_STAT_GOLD,
        unlocks: config.WARDOGS_STEAM_STAT_UNLOCKS,
        kills: config.WARDOGS_STEAM_STAT_KILLS,
        deaths: config.WARDOGS_STEAM_STAT_DEATHS,
        matches: config.WARDOGS_STEAM_STAT_MATCHES,
        wins: config.WARDOGS_STEAM_STAT_WINS,
        assaultLevel: config.WARDOGS_STEAM_STAT_ASSAULT,
        medicLevel: config.WARDOGS_STEAM_STAT_MEDIC,
        reconLevel: config.WARDOGS_STEAM_STAT_RECON,
        supportLevel: config.WARDOGS_STEAM_STAT_SUPPORT,
        driverLevel: config.WARDOGS_STEAM_STAT_DRIVER,
        pilotLevel: config.WARDOGS_STEAM_STAT_PILOT,
        xpPerMinute: config.WARDOGS_STEAM_STAT_XPMIN,
        cashPerMinute: config.WARDOGS_STEAM_STAT_CASHMIN
      }
    });
  }

  if (config.WARDOGS_PROVIDER === "http") {
    if (!config.WARDOGS_API_BASE_URL) {
      throw new Error("WARDOGS_API_BASE_URL is required when WARDOGS_PROVIDER=http");
    }
    return new HttpWardogsProvider(config.WARDOGS_API_BASE_URL, config.WARDOGS_API_TOKEN);
  }

  return new MockWardogsProvider();
}

export const wardogsProvider = createProvider();
