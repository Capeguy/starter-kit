/**
 * Separate file from vitest setup due to different execution context
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  CONTAINER_CONFIGURATIONS,
  setup as setupContainers,
} from '~tests/common'

import { PrismaClient } from '@acme/db/client'

type DatabaseContainer = Awaited<ReturnType<typeof startDatabase>>

export const getConnectionString = (
  container: DatabaseContainer,
  internalPort?: boolean,
) => {
  const { host, ports, configuration } = container
  const port = internalPort ? 5432 : (ports.get(5432) ?? 5432)
  const username = configuration.environment?.POSTGRES_USER ?? 'root'
  const password = configuration.environment?.POSTGRES_PASSWORD ?? 'root'
  const databaseId = configuration.environment?.POSTGRES_DB ?? 'test'

  return `postgresql://${username}:${password}@${host}:${port}/${databaseId}?sslmode=disable`
}

export const startDatabase = async () => {
  const [dbContainer] = await setupContainers([
    {
      ...CONTAINER_CONFIGURATIONS.database,
      reuse: true,
      // The host port must be the same as in .env.e2e.
      ports: [{ container: 5432, host: 64321 }],
    },
  ])

  if (!dbContainer) {
    throw new Error('Database container not started')
  }

  return dbContainer
}

export const applyMigrations = async (container: DatabaseContainer) => {
  const connectionString = getConnectionString(container)
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  // Idempotency: when the e2e container is reused across specs (reuse:true on
  // the testcontainer), beforeAll re-invokes us with a DB that already has
  // every migration applied. Migrations like the RBAC one are NOT idempotent
  // (`ALTER TYPE ... RENAME` errors when the type is already gone), so a
  // second pass would partially fail and leave the DB in a half-broken state.
  // Detect prior runs by checking for the User table and short-circuit.
  const existing = await client
    .$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'vibe_stack' AND table_name = 'User'
       ) AS exists`,
    )
    .catch(() => [{ exists: false }])
  if (existing[0]?.exists) {
    // Container survives across runs (and across worktrees on the same dev
    // box). The User-exists short-circuit was historically all-or-nothing,
    // which leaves new feature-branch tables (FeatureFlag, etc.) missing on
    // a parallel worktree's run. Apply just the migrations whose primary
    // table is missing — narrow heuristic that's safe because each new
    // migration in this repo's history adds at most one named table.
    const post = await ensureBranchSpecificTables(client)
    if (post.applied > 0) {
      console.log(`Applied ${post.applied} branch-specific migration(s)`)
    } else {
      console.log('Skipping applyMigrations: schema already migrated')
    }
    return
  }

  const prismaMigrationDir = join(
    fileURLToPath(dirname(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..',
    'packages',
    'db',
    'prisma',
    'migrations',
  )

  // Running migrations manually; if using `dd-trace`, it intercepts `exec` usage and prevents runs
  const directory = readdirSync(prismaMigrationDir).sort()
  for (const file of directory) {
    const name = `${prismaMigrationDir}/${file}`
    if (statSync(name).isDirectory()) {
      const migration = readFileSync(`${name}/migration.sql`, 'utf8')
      await client.$executeRawUnsafe(migration)
      console.log(`Applied migration: ${file}`)
    }
  }
}

/**
 * For the cross-worktree-reuse case: if the persistent container has the
 * baseline schema but is missing tables this branch added, apply those
 * specific migrations + every following migration. Returns the count of
 * migrations applied.
 *
 * Heuristic: scan each migration directory's `migration.sql` for
 * `CREATE TABLE "vibe_stack"."<name>"`. For the first one whose table is
 * missing, apply it AND every subsequent migration in order. This handles
 * the two-step pattern of "table migration" + "data grant migration"
 * shipped together — the grant uses `DISTINCT unnest` to remain idempotent.
 */
const ensureBranchSpecificTables = async (
  client: PrismaClient,
): Promise<{ applied: number }> => {
  const prismaMigrationDir = join(
    fileURLToPath(dirname(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '..',
    'packages',
    'db',
    'prisma',
    'migrations',
  )
  let applied = 0
  let startApplyingFromIndex = -1
  const allFiles = readdirSync(prismaMigrationDir)
    .sort()
    .filter((f) => statSync(`${prismaMigrationDir}/${f}`).isDirectory())

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    if (!file) continue
    const sql = readFileSync(
      `${prismaMigrationDir}/${file}/migration.sql`,
      'utf8',
    )
    const tableMatches = Array.from(
      sql.matchAll(/CREATE TABLE\s+"vibe_stack"\."([^"]+)"/gi),
    )
      .map((m) => m[1])
      .filter((s): s is string => typeof s === 'string')
    if (tableMatches.length === 0) continue

    const checks = await Promise.all(
      tableMatches.map(async (t) => {
        const r = await client.$queryRawUnsafe<{ exists: boolean }[]>(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema='vibe_stack' AND table_name=$1
           ) AS exists`,
          t,
        )
        return r[0]?.exists ?? false
      }),
    )
    if (!checks.every(Boolean)) {
      startApplyingFromIndex = i
      break
    }
  }

  if (startApplyingFromIndex < 0) return { applied: 0 }

  for (let i = startApplyingFromIndex; i < allFiles.length; i++) {
    const file = allFiles[i]
    if (!file) continue
    const sql = readFileSync(
      `${prismaMigrationDir}/${file}/migration.sql`,
      'utf8',
    )
    try {
      await client.$executeRawUnsafe(sql)
      applied++
      console.log(`Applied branch migration: ${file}`)
    } catch (err) {
      // Tolerate "already exists" errors — could happen if part of the
      // migration overlaps something a parallel branch added.
      const msg = (err as Error).message
      if (
        /already exists/i.test(msg) ||
        /duplicate_/i.test(msg) ||
        /relation .* already exists/i.test(msg)
      ) {
        console.log(
          `Skipped already-applied branch migration: ${file} (${msg.split('\n')[0]})`,
        )
        continue
      }
      console.warn(
        `ensureBranchSpecificTables: ${file} failed: ${msg.split('\n')[0]}`,
      )
      // Don't throw — keep going so subsequent migrations can apply.
    }
  }
  return { applied }
}

export const setupTestClient = (connectionString: string) => {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
  return client
}

/**
 * Clear all transactional rows so the snapshot taken next captures a known
 * post-migration state — not whatever leftover rows the previous spec left
 * behind via createTestUser() etc. We deliberately preserve Role: it was
 * seeded by the RBAC migration and the FK on User.role_id needs it.
 */
export async function clearTransactionalData(container: DatabaseContainer) {
  const result = await container.container.exec(
    [
      'sh',
      '-c',
      `psql -d ${getConnectionString(
        container,
        true,
      )} -c 'TRUNCATE TABLE vibe_stack."Account", vibe_stack."AuditLog", vibe_stack."FeatureFlag", vibe_stack."File", vibe_stack."Notification", vibe_stack."Passkey", vibe_stack."PasskeyChallenge", vibe_stack."PasskeyResetToken", vibe_stack."User", vibe_stack."VerificationToken" RESTART IDENTITY CASCADE;'`,
    ],
    { user: 'root' },
  )
  if (result.exitCode !== 0) {
    console.error('Failed to clear transactional data', result)
  }
}

export async function takeDbSnapshot(container: DatabaseContainer) {
  // Saving a snapshot of the database
  const snapshotResult = await container.container.exec(
    [
      'sh',
      '-c',
      `pg_dump -d ${getConnectionString(
        container,
        true,
      )} -Fc -f /tmp/snapshot.dump`,
    ],
    { user: 'root' },
  )

  if (snapshotResult.exitCode !== 0) {
    console.error(
      'Failed when trying to take a snapshot of the db',
      snapshotResult,
    )
  } else {
    console.log('Database snapshot taken')
  }
}

export async function resetDbToSnapshot(container: DatabaseContainer) {
  const resetResult = await container.container.exec([
    'sh',
    '-c',
    `pg_restore --clean --if-exists -d ${getConnectionString(
      container,
      true,
    )} /tmp/snapshot.dump`,
  ])

  if (resetResult.exitCode !== 0) {
    console.error('Failed when trying to reset the db', resetResult)
  } else {
    console.log('Database reset to snapshot')
  }
}
