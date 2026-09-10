# Deploying PackRank on Railway

PackRank is a good fit for Railway: one long-running Discord bot service plus one PostgreSQL service.

## Recommended Railway layout

For an unrelated existing Railway app, create a **separate Railway project named `PackRank`**. This keeps PackRank's variables, database, deploy history, usage, and failures isolated.

If your existing Railway project is already part of the same WARDOGS/PackRank stack, PackRank can live in that project as another service. It does not require a separate GitHub repository.

Recommended layout:

```text
PackRank (Railway project)
├── packrank-bot   -> GitHub: IronSetFree/PackRank
└── Postgres       -> Railway PostgreSQL
```

Keep the bot at **one replica** for now. PackRank runs its own periodic stat sync, so multiple replicas would duplicate that work unless distributed locking/sharding is added later.

## 1. Create the Railway project

1. Create a Railway project named `PackRank`.
2. Add a PostgreSQL database service.
3. Add a service from GitHub and select `IronSetFree/PackRank`.
4. Rename the application service to `packrank-bot` if desired.

The Discord bot does not need a public domain. It maintains an outbound Discord Gateway connection. PackRank does expose `/health` on Railway's injected `PORT` so Railway can validate deployments.

## 2. Configure variables

In the `packrank-bot` service, add a Railway reference variable for the PostgreSQL service's `DATABASE_URL` rather than copying database credentials manually.

Add these application variables:

```env
NODE_ENV=production

DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-id
# Recommended while testing slash-command changes in one server.
DISCORD_GUILD_ID=your-test-guild-id

WARDOGS_PROVIDER=steam
STEAM_API_KEY=your-steam-web-api-key
WARDOGS_STEAM_APP_ID=1867240

SYNC_INTERVAL_MINUTES=15
WARDOGS_SEASON=Season 01
```

If the Steam probe identifies exact WARDOGS stat names, also add the relevant `WARDOGS_STEAM_STAT_*` variables documented in `.env.example`.

Never commit Discord or Steam secrets to GitHub. Keep them in Railway Variables.

## 3. Configure build and deploy commands

In `packrank-bot` -> **Settings** -> deployment/build settings, use:

**Build command**

```bash
npm run railway:build
```

**Pre-deploy command**

```bash
npm run railway:predeploy
```

**Start command**

```bash
npm start
```

The build command generates the Prisma client and compiles TypeScript. The pre-deploy command runs committed Prisma migrations against Railway PostgreSQL before the new bot process starts.

## 4. Configure health and restart behavior

Set:

```text
Healthcheck path: /health
Restart policy: ON_FAILURE
Replicas: 1
```

The health endpoint returns HTTP 200 only after the bot is connected to Discord and PostgreSQL is reachable.

## 5. Deploy slash commands

Slash commands are registered separately from starting the bot. After the Railway variables exist, run the command once from a local clone using the Railway CLI:

```bash
railway login
railway link
railway service packrank-bot
railway run npm run commands:deploy
```

Keep `DISCORD_GUILD_ID` set during development so command changes appear quickly in that guild. Remove it later and run `npm run commands:deploy` again when you are ready to register the commands globally.

## 6. Verify the deployment

In Railway logs, look for messages similar to:

```text
Health server listening on port ...
Logged in as PackRank#....
WARDOGS provider: steam
```

Railway should then report the deployment healthy.

If the deployment fails before the bot starts, check the **pre-deploy logs** first. Database migration or missing-variable errors happen there before `npm start` runs.

## Database migrations

The repository includes an initial Prisma migration under `prisma/migrations/`. Do not use `prisma migrate dev` in Railway production. Production deployments use:

```bash
npm run db:deploy
```

When the Prisma schema changes later, generate a migration during development, commit the new migration folder, and let Railway apply it during the next pre-deploy phase.

## About Railway configuration files

Railway's legacy `railway.json` / `railway.toml` Config-as-Code flow is being retired for new services. For a new PackRank service, use the Railway dashboard settings above. If you later want the entire Railway project represented as code, use Railway's current Infrastructure-as-Code workflow (`railway config init`) rather than adding a new legacy `railway.json` file.
