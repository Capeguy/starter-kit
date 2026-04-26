import crypto from 'crypto'
import { TRPCError } from '@trpc/server'

import { db } from '@acme/db'

/**
 * Self-hosted feature flag evaluation + admin CRUD.
 *
 * Resolution order in `isEnabled`:
 *   1. Flag missing OR `enabled === false` → false.
 *   2. `userId` is in `allowedUserIds`     → true (always-on overlay).
 *   3. `rolloutPercent === 100`            → true.
 *   4. `rolloutPercent > 0` AND `userId` provided → bucketed via stable hash.
 *   5. Else                                 → false.
 *
 * The percent rollout is DETERMINISTIC and STABLE: the same `(key, userId)`
 * pair always maps to the same bucket [0, 99]. Implementation: SHA-256 of
 * `${key}:${userId}` → first 4 bytes as a big-endian uint32 → `% 100`. The
 * key is part of the hash input so a user landing in bucket 7 for one flag
 * doesn't correlate with their bucket for another flag (a property worth
 * preserving — it lets you do many independent partial rollouts without
 * always hitting the same long-tail of users).
 */

interface IsEnabledOptions {
  key: string
  userId?: string | null
}

const stableBucket = (key: string, userId: string): number => {
  const digest = crypto.createHash('sha256').update(`${key}:${userId}`).digest()
  // First 4 bytes interpreted as big-endian uint32.
  const uint32 = digest.readUInt32BE(0)
  return uint32 % 100
}

export const isEnabled = async ({
  key,
  userId,
}: IsEnabledOptions): Promise<boolean> => {
  const flag = await db.featureFlag.findUnique({
    where: { key },
    select: {
      enabled: true,
      rolloutPercent: true,
      allowedUserIds: true,
    },
  })

  if (!flag?.enabled) {
    return false
  }

  if (userId && flag.allowedUserIds.includes(userId)) {
    return true
  }

  if (flag.rolloutPercent === 100) {
    return true
  }

  if (flag.rolloutPercent > 0 && userId) {
    return stableBucket(key, userId) < flag.rolloutPercent
  }

  return false
}

/**
 * Bulk evaluation for first-paint / hook prefetching. Hits the DB once and
 * resolves each key independently. Order of returned entries is not
 * guaranteed; callers should look up by key.
 */
export const isEnabledBulk = async ({
  keys,
  userId,
}: {
  keys: string[]
  userId?: string | null
}): Promise<Record<string, boolean>> => {
  if (keys.length === 0) return {}

  const flags = await db.featureFlag.findMany({
    where: { key: { in: keys } },
    select: {
      key: true,
      enabled: true,
      rolloutPercent: true,
      allowedUserIds: true,
    },
  })

  const byKey = new Map(flags.map((f) => [f.key, f] as const))
  const out: Record<string, boolean> = {}
  for (const k of keys) {
    const flag = byKey.get(k)
    if (!flag?.enabled) {
      out[k] = false
      continue
    }
    if (userId && flag.allowedUserIds.includes(userId)) {
      out[k] = true
      continue
    }
    if (flag.rolloutPercent === 100) {
      out[k] = true
      continue
    }
    if (flag.rolloutPercent > 0 && userId) {
      out[k] = stableBucket(k, userId) < flag.rolloutPercent
      continue
    }
    out[k] = false
  }
  return out
}

export const list = async () => {
  const items = await db.featureFlag.findMany({
    orderBy: { key: 'asc' },
  })
  return { items }
}

interface UpsertInput {
  key: string
  name: string
  description?: string | null
  enabled: boolean
  rolloutPercent: number
  allowedUserIds: string[]
}

export const upsert = async (input: UpsertInput) => {
  if (input.rolloutPercent < 0 || input.rolloutPercent > 100) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'rolloutPercent must be between 0 and 100.',
    })
  }
  // Defense in depth — the Zod schema on the router already enforces this,
  // but if a caller bypasses it (server-side caller, future internal use),
  // the DB constraint is varchar(64) and silently truncating would be bad.
  if (input.key.length === 0 || input.key.length > 64) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'key must be 1-64 characters.',
    })
  }

  return db.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      rolloutPercent: input.rolloutPercent,
      allowedUserIds: input.allowedUserIds,
    },
    update: {
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
      rolloutPercent: input.rolloutPercent,
      allowedUserIds: input.allowedUserIds,
    },
  })
}

export const remove = async ({ key }: { key: string }) => {
  // Soft "missing is fine" — return a stable result regardless. A 404 here
  // would race with the admin UI's own delete-confirm flow if someone else
  // deleted the flag between list and delete.
  await db.featureFlag.deleteMany({ where: { key } })
  return { key, deleted: true as const }
}
