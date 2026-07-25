import { defineConfig } from 'prisma/config'

export default defineConfig({
  migrations: {
    seed: 'pnpm dlx tsx prisma/seed.ts',
  },
  datasource: {
    // Not using `env` from 'prisma/config' to prevent errors thrown when
    // DATABASE_URL is not set (e.g. prisma generate).
    // See https://github.com/prisma/prisma/issues/28590
    // DIRECT_URL (unpooled) wins when set: `prisma migrate` needs a direct
    // connection — PgBouncer-style poolers (e.g. Neon's pooled endpoint)
    // break its advisory locks. Runtime clients keep using DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
  schema: 'prisma/schema.prisma',
})
