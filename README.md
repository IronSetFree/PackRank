# PackRank

**PackRank** is a TypeScript/Discord.js app for WARDOGS communities. It tracks linked players over time, ranks only the members of a Discord server, and can compare those players to a wider/global leaderboard when the configured WARDOGS data provider supports it.

## What is included

- `/link player:<name>` — associates a Discord member with one WARDOGS identity.
- `/unlink` — removes the guild-specific link.
- `/stats [member]` — level, cash, account worth, K/D, matches, wins, Discord rank, and global rank where available.
- `/leaderboard metric:<...> scope:<server|global>` — community or provider-global rankings.
- `/rank metric:<...> [member]` — side-by-side Discord/global position.
- `/compare member:<...>` — compares your latest stats with another member.
- `/progress [member] [days]` — calculates gains from stored snapshots.
- `/sync` — manually captures a fresh snapshot.
- Automatic snapshot refresh on a configurable interval.
- PostgreSQL + Prisma schema designed so one WARDOGS player can appear in multiple Discord guilds without duplicating their stat history.

## Important WARDOGS data-source note

At launch, there is not yet a documented, stable public WARDOGS player-stat API that this project should hard-code against. The project therefore uses a provider interface:

- `mock` — works immediately and gives you realistic fake data for developing/testing every Discord command.
- `http` — a clean adapter ready for an authorized official/community API once you have its contract.

Do **not** put reverse-engineered session tokens, Steam credentials, or private game-client endpoints directly in command handlers. Add or change only the provider implementation under `src/providers/`.

The public `wardogs.tools` leaderboard currently tracks linked accounts and exposes categories such as Wardog level, cash, account worth, unlocks, role levels, XP/min and $/min. It is useful evidence for what can be tracked, but its population should not be presented as every WARDOGS player unless its data source/API explicitly guarantees that.

## Requirements

- Node.js 24.17+
- Docker Desktop (recommended for local PostgreSQL), or another PostgreSQL instance
- A Discord application/bot token

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

## Real API adapter

When you obtain an authorized API, set:

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
