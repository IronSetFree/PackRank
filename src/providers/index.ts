import { config } from "../config.js";
import { HttpWardogsProvider } from "./http.js";
import { MockWardogsProvider } from "./mock.js";
import type { WardogsProvider } from "./types.js";

export function createProvider(): WardogsProvider {
  if (config.WARDOGS_PROVIDER === "http") {
    if (!config.WARDOGS_API_BASE_URL) {
      throw new Error("WARDOGS_API_BASE_URL is required when WARDOGS_PROVIDER=http");
    }
    return new HttpWardogsProvider(config.WARDOGS_API_BASE_URL, config.WARDOGS_API_TOKEN);
  }

  return new MockWardogsProvider();
}

export const wardogsProvider = createProvider();
