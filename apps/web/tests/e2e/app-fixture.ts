/* oxlint-disable react-hooks/rules-of-hooks */
/* oxlint-disable no-empty-pattern */
import { test as baseTest } from '@playwright/test'

import { createTestUser, sealSession } from './setup/auth'
import {
  applyMigrations,
  clearTransactionalData,
  resetDbToSnapshot,
  startDatabase,
  takeDbSnapshot,
} from './setup/db-setup'
import { flushRedis as flushRedisFn, startRedis } from './setup/redis-setup'

// oxlint-disable-next-line no-restricted-properties
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3111'

// Every page an e2e spec navigates to. Fetched once per worker before any
// test runs so that (a) `next dev` pays its cold compile cost outside test
// budgets — on CI the webServer is always fresh and the first spec file
// otherwise eats multi-second compiles inside its own 30s timeout — and
// (b) the server's Redis client connects while the request is free to be
// slow (with `rejectIfRedisNotReady`, early requests hard-error until the
// testcontainer accepts connections).
const WARM_PATHS = [
  '/',
  '/sign-in',
  '/dashboard',
  '/dashboard/files',
  '/admin',
  '/admin/users',
  '/admin/audit',
  '/admin/notifications',
  '/admin/files',
  '/admin/roles',
]

let warmed = false

const warmRoutes = async () => {
  const admin = await createTestUser({
    name: `Warmup-${Date.now()}`,
    role: 'ADMIN',
  })
  const sealed = await sealSession(admin.id)
  for (const path of WARM_PATHS) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { cookie: `auth.session-token=${sealed}` },
        redirect: 'manual',
      })
      // Drain the stream so the server finishes rendering before we move on.
      await res.text()
    } catch {
      // Warmup is best-effort — a failed fetch must never fail the suite.
    }
  }
}

interface DatabaseFixture {
  databaseContainer: Awaited<ReturnType<typeof startDatabase>>
  resetDatabase: () => Promise<void>
}

interface RedisFixture {
  redisContainer: Awaited<ReturnType<typeof startRedis>>
  flushRedis: () => Promise<void>
}

const test = baseTest.extend<DatabaseFixture & RedisFixture>({
  databaseContainer: async ({}, use) => {
    const container = await startDatabase()

    await use(container)
  },

  resetDatabase: async ({ databaseContainer }, use) => {
    await use(async () => {
      await resetDbToSnapshot(databaseContainer)
    })
  },

  redisContainer: async ({}, use) => {
    const container = await startRedis()

    await use(container)
  },

  flushRedis: async ({ redisContainer }, use) => {
    await use(async () => {
      await flushRedisFn(redisContainer)
    })
  },
})

test.beforeAll(async ({ databaseContainer, redisContainer }) => {
  await applyMigrations(databaseContainer)
  // The container is reused across specs (`reuse: true`), so when we run
  // the suite end-to-end the DB still has rows that previous specs created.
  // Clear them here so the snapshot we take next captures only the seeded
  // role rows and an otherwise-empty schema.
  await clearTransactionalData(databaseContainer)
  await takeDbSnapshot(databaseContainer)

  // One-time route warmup (see WARM_PATHS). Runs after the snapshot, and the
  // reset below removes the warmup user + rate-limit keys so the first test
  // still starts from the pristine snapshot. Referencing `redisContainer`
  // above also guarantees the Redis testcontainer is up before the warmup
  // requests force the server's client to connect. Compiling every route on
  // a cold CI runner can take minutes — give the hook a generous budget.
  if (!warmed) {
    warmed = true
    test.setTimeout(300_000)
    await warmRoutes()
    await Promise.all([
      resetDbToSnapshot(databaseContainer),
      flushRedisFn(redisContainer),
    ])
  }
})

// Intentionally NOT stopping containers in afterAll. The container fixtures
// use `reuse: true`; stopping between specs forces a fresh container per
// spec, which means applyMigrations re-runs on each beforeAll. The RBAC
// migration is non-idempotent, and a port clash also surfaces when two
// specs race on host port 64321 during teardown/restart. Leaving the
// containers up lets reuse actually reuse them — applyMigrations short-
// circuits via its own idempotency check, and snapshot/reset semantics
// remain correct.

test.afterEach(async ({ resetDatabase, flushRedis }) => {
  await Promise.all([resetDatabase(), flushRedis()])
})

export { test }
