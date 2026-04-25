/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-empty-pattern */
import { test as baseTest } from '@playwright/test'

import {
  applyMigrations,
  clearTransactionalData,
  resetDbToSnapshot,
  startDatabase,
  takeDbSnapshot,
} from './setup/db-setup'
import { flushRedis as flushRedisFn, startRedis } from './setup/redis-setup'

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

test.beforeAll(async ({ databaseContainer }) => {
  await applyMigrations(databaseContainer)
  // The container is reused across specs (`reuse: true`), so when we run
  // the suite end-to-end the DB still has rows that previous specs created.
  // Clear them here so the snapshot we take next captures only the seeded
  // role rows and an otherwise-empty schema.
  await clearTransactionalData(databaseContainer)
  await takeDbSnapshot(databaseContainer)
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
