# PackRank Architecture

```text
Discord interactions
       |
       v
 command handlers
       |
       +---- player-service -------- PostgreSQL / Prisma
       |          |
       |          +---- StatSnapshot history
       |
       +---- leaderboard-service --- guild subset rankings
       |          |
       |          +---- global rank enrichment
       |
       v
 WardogsProvider
       |
       +---- MockWardogsProvider (development)
       +---- HttpWardogsProvider (authorized future API)
```

## Provider boundary

Game-specific networking belongs behind `WardogsProvider`. The rest of the application should never know whether the data came from an official API, an authorized community API, or RCON-derived aggregation.

## Identity rule

Never make display name the database primary identifier. Use the provider's stable player/account ID. Display names can change.

## Snapshot rule

Append snapshots rather than overwriting current stats. This enables weekly gains, season charts, Discord-only competitions, and auditability when an upstream source changes values.
