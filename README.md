# PackRank

**PackRank** is a TypeScript/Discord.js app for WARDOGS communities. It tracks linked players over time, ranks only the members of a Discord server, and can compare those players to a wider/global leaderboard when the configured WARDOGS data provider supports it.

## What is included

- `/link player:<identifier>` — associates a Discord member with one WARDOGS identity. With the Steam provider, use a SteamID64, Steam profile URL, or Steam vanity name.
- `/unlink` — removes the guild-specific link.
- `/stats [member]` — level, cash, account worth, K/D, matches, wins, Discord rank, and global rank where available.
- `/leaderboard metric:<...> scope:<server|global>` — community or provider-global rankings.
- `/rank metric:<...> [member]` — side-by-side Discord/global position.
- `/compare member:<...>` — compares your latest stats with another member.
- `/progress [member] [days]` — calculates gains from stored snapshots.
- `/sync` — manually captures a fresh snapshot.
- Automatic snapshot refresh on a configurable interval.
- PostgreSQL + Prisma schema designed so one WARDOGS player can appear in multiple Discord guilds without duplicating their stat history.
- Railway-ready health endpoint and production migration flow.

## Railway deployment

Railway is the recommended initial host for PackRank. Use the existing **`IronSetFree/PackRank` GitHub repository**; you do not need a second repo.

For an unrelated existing Railway app, create a separate Railway project named **PackRank** containing the bot and its PostgreSQL service. See **[RAILWAY.md](./RAILWAY.md)** for the exact build command, pre-deploy migrations, variables, health check, and slash-command deployment steps.

## Important WARDOGS data-source note

At launch, there is not yet a documented BULKHEAD API for third-party player statistics or the global WARDOGS leaderboard. PackRank therefore keeps data access behind providers:

- `mock` — realistic fake data for local development.
- `steam` — uses Valve's documented Steam Web API. It can resolve Steam identities and requests the WARDOGS Steam user-stat feed. Which WARDOGS fields are actually available depends on what BULKHEAD publishes to Steam and on the player's privacy settings.
- `http` — a normalized adapter ready for a future authorized BULKHEAD/community API.

Do **not** put reverse-engineered session tokens, Steam credentials, private game-client endpoints, or scraped third-party tracker data into command handlers. Keep all game-source logic under `src/providers/`.

`wardogs.tools` publicly displays useful WARDOGS progression data, but its current Terms of Service prohibit automated scraping/crawling without prior written permission. PackRank therefore does not scrape it. If its operator grants API access later, add that API as a separate provider.

## Requirements

- Node.js 24.17+
- Docker Desktop (recommended for local PostgreSQL), or another PostgreSQL instance
- A Discord application/bot token
- A Steam Web API user key if you use `WARDOGS_PROVIDER=steam`

The package currently targets discord.js 14.27 and Prisma 7.10. Prisma 7 uses the PostgreSQL driver adapter (`@prisma/adapter-pg`).

## 1. Configure Discord

Create a Discord application in the Discord Developer Portal, add a bot, and invite it with the `bot` and `applications.commands` scopes. The bot only needs the `Guilds` gateway intent for this starter.

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=... # recommended while developing
```

Using a guild ID makes slash-command changes appear almost immediately. Remove it when you want to deploy global Discord commands.

## 2. Start PostgreSQL

```bash
docker compose up -d
```

The included development connection string is:

```text
postgresql://wardogs:wardogs@localhost:5432/wardogs?schema=public
```

## 3. Install and create the database

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate -- --name init
```

## 4. Deploy Discord slash commands

```bash
npm run commands:deploy
```

## 5. Start the bot

```bash
npm run dev
```

With `WARDOGS_PROVIDER=mock`, try:

```text
/link player:Falcon#2839
/stats
/leaderboard metric:Cash scope:Discord server
/leaderboard metric:K/D scope:Global
/rank metric:Wardog Level
```

## Try the documented Steam provider

Create a Steam Web API user key, then set:

```env
WARDOGS_PROVIDER=steam
STEAM_API_KEY=your-server-side-key
WARDOGS_STEAM_APP_ID=1867240
```

Before relying on any WARDOGS stat names, inspect what Steam currently publishes:

```bash
npm run steam:probe
npm run steam:probe -- 7656119XXXXXXXXXX
```

The first command prints WARDOGS' published Steam stat/achievement schema. The second also prints the stats returned for one public Steam account. If the WARDOGS stat names differ from PackRank's common aliases, map them in `.env`, for example:

```env
WARDOGS_STEAM_STAT_KILLS=ExactSteamStatNameHere
WARDOGS_STEAM_STAT_DEATHS=ExactSteamStatNameHere
WARDOGS_STEAM_STAT_CASH=ExactSteamStatNameHere
```

With the Steam provider, `/link` accepts a 17-digit SteamID64, a `steamcommunity.com/profiles/...` URL, a `steamcommunity.com/id/...` URL, or a plain Steam vanity name.

The documented Steam Web API does **not** give PackRank a general WARDOGS global player leaderboard. Server-scoped PackRank leaderboards can still rank the linked members whose stats Steam exposes. Global scope remains disabled until an authorized source exists.

Have a few Discord members link any of these mock players for a richer test:

```text
Falcon#2839
Nathaaaan#0934
BrokenInternet#4410
MedicMike#1177
TacticalTim#5521
JohnDoe#1234
Dave#9001
ReconRick#0412
```

## How the global-vs-Discord ranking works

The database stores a single global WARDOGS identity and a separate `DiscordLink` per guild/member. A stat snapshot belongs to the player, not to a guild.

That means:

```text
WARDOGS player
   ├─ Discord Guild A / User 123
   ├─ Discord Guild B / User 123
   └─ StatSnapshot history
```

A Discord leaderboard loads each guild's linked members, selects their latest snapshot, calculates the requested metric, and ranks that subset. A global leaderboard is delegated to the data provider.

This gives you the output you wanted conceptually:

```text
SERVER CASH LEADERBOARD
1. Falcon#2839        $1,058,186   • Global #234
2. JohnDoe#1234         $428,240   • Global #842
3. TacticalTim#5521     $395,291   • Global #917
```

## Authorized WARDOGS API adapter

When BULKHEAD or another authorized provider supplies a supported API, set:

```env
WARDOGS_PROVIDER=http
WARDOGS_API_BASE_URL=https://your-authorized-api.example/
WARDOGS_API_TOKEN=optional-token
```

`src/providers/http.ts` intentionally assumes a small normalized contract:

```text
GET /players/resolve?q=<name>
GET /players/:id/stats
GET /leaderboards/:metric?limit=25
GET /players/:id/rank/:metric
```

If the real API uses different routes or fields, modify only `HttpWardogsProvider`. The Discord commands, database, snapshots, rankings, and embeds can stay unchanged.

## Suggested next provider work

The next production step is to settle the identity/authentication flow. A strong linking flow is:

1. `/link` creates a short-lived verification code.
2. User signs in to the authorized WARDOGS/Steam flow on a small web callback page.
3. Callback receives the stable game player ID.
4. The bot completes `DiscordLink` using that ID.

That prevents people from claiming another player's public name and avoids treating mutable display names as identifiers.

After an API/RCON source supports match data, map these additional fields into `PlayerStats`: kills, deaths, matches, wins, assists, revives, score, weapon kills, and per-role totals. The existing snapshot and progress model is already ready for kills/deaths/KD.
