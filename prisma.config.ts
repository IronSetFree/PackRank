import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` does not connect to the database, but Prisma still loads
// this config during the build. Railway may not expose DATABASE_URL to the
// build environment even though it is available at pre-deploy/runtime.
// A syntactically valid fallback lets client generation succeed. Actual
// migrations/runtime database access still use DATABASE_URL when present.
const databaseUrl = process.env.DATABASE_URL
  ?? "postgresql://packrank:packrank@127.0.0.1:5432/packrank?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});
