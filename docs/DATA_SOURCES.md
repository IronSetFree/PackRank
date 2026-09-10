# PackRank data sources

## Current supported paths

### Steam Web API

PackRank's `steam` provider uses Valve's documented public Web API host (`api.steampowered.com`) and a normal Steam Web API user key.

Used interfaces:

- `ISteamUser/ResolveVanityURL/v1` — resolve a Steam vanity name to SteamID64.
- `ISteamUser/GetPlayerSummaries/v2` — obtain the public Steam persona/display name.
- `ISteamUserStats/GetSchemaForGame/v2` — inspect the stats and achievements WARDOGS publishes to Steam.
- `ISteamUserStats/GetUserStatsForGame/v2` — obtain WARDOGS stats Steam exposes for a player.

WARDOGS release App ID: `1867240`.

A Steam user key is not a BULKHEAD publisher key. It does not grant access to private WARDOGS backend data. Player/game privacy and Steam's own API rules still apply.

### WARDOGS global leaderboard

No documented third-party BULKHEAD endpoint is currently configured in PackRank for the global player leaderboard. The Steam provider intentionally returns an unsupported error for global scope rather than pretending a Discord-only or tracker-only population is global.

### wardogs.tools

Do not scrape `wardogs.tools`. Its Terms of Service (last updated September 9, 2026) prohibit automated scraping, crawling, mass-download, or extraction without prior written permission except through public interfaces expressly provided for that purpose.

If the operator grants PackRank API permission later, implement a dedicated provider using the authorized contract instead of parsing website HTML.

## Discovering Steam stat names

Run:

```bash
npm run steam:probe
```

To also inspect the stats returned for a public player:

```bash
npm run steam:probe -- 7656119XXXXXXXXXX
```

If WARDOGS publishes useful stats but uses unexpected API names, configure the exact names in `.env` with the `WARDOGS_STEAM_STAT_*` variables. Exact configured names take priority over PackRank's built-in common aliases.
