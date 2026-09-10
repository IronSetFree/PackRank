import "dotenv/config";

const apiKey = process.env.STEAM_API_KEY?.trim();
const appId = Number(process.env.WARDOGS_STEAM_APP_ID || 1867240);
const steamId = process.argv[2]?.trim();

if (!apiKey) {
  console.error("STEAM_API_KEY is required. Add it to .env before running the Steam probe.");
  process.exit(1);
}

async function request<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, "https://api.steampowered.com");
  url.searchParams.set("key", apiKey!);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Steam Web API ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}

async function main() {
  console.log(`WARDOGS Steam App ID: ${appId}`);
  console.log("Fetching the published Steam stat/achievement schema...\n");

  const schema = await request<{
    game?: {
      gameName?: string;
      availableGameStats?: {
        stats?: Array<{ name: string; defaultvalue?: number; displayName?: string }>;
        achievements?: Array<{ name: string; displayName?: string }>;
      };
    };
  }>("/ISteamUserStats/GetSchemaForGame/v2/", { appid: appId });

  const publishedStats = schema.game?.availableGameStats?.stats ?? [];
  const achievements = schema.game?.availableGameStats?.achievements ?? [];

  console.log(`Game: ${schema.game?.gameName ?? "WARDOGS"}`);
  console.log(`Published stats: ${publishedStats.length}`);
  for (const stat of publishedStats) {
    console.log(`  ${stat.name}${stat.displayName ? ` — ${stat.displayName}` : ""}`);
  }
  console.log(`Published achievements: ${achievements.length}`);

  if (!steamId) {
    console.log("\nPass a SteamID64 to also inspect the stats Steam exposes for that player:");
    console.log("  npm run steam:probe -- 7656119XXXXXXXXXX");
    return;
  }

  if (!/^\d{17}$/.test(steamId)) {
    throw new Error("The probe argument must be a 17-digit SteamID64.");
  }

  console.log(`\nFetching user stats for ${steamId}...`);
  const user = await request<{
    playerstats?: { gameName?: string; stats?: Array<{ name: string; value: number }> };
  }>("/ISteamUserStats/GetUserStatsForGame/v2/", { appid: appId, steamid: steamId });

  const userStats = user.playerstats?.stats ?? [];
  console.log(`User stats returned: ${userStats.length}`);
  for (const stat of userStats) console.log(`  ${stat.name} = ${stat.value}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
