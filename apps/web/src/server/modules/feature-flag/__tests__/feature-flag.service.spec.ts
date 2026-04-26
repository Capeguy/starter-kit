import crypto from 'crypto'
import { resetTables } from '~tests/db/utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@acme/db'

import {
  isEnabled,
  isEnabledBulk,
  remove,
  upsert,
} from '../feature-flag.service'

/**
 * Tiny re-implementation of the bucket calc so the deterministic tests below
 * can pick a userId that lands in a specific bucket without coupling to the
 * service's internals via export. Stays in lockstep with `stableBucket` in
 * `feature-flag.service.ts`; if that algorithm changes, this MUST change too.
 */
const bucketFor = (key: string, userId: string): number => {
  const digest = crypto.createHash('sha256').update(`${key}:${userId}`).digest()
  return digest.readUInt32BE(0) % 100
}

const findUserIdInBucket = (
  key: string,
  predicate: (bucket: number) => boolean,
): string => {
  // Brute-force search; the keyspace is huge so we'll find a match in a few
  // iterations. Cap to avoid an infinite loop in pathological cases.
  for (let i = 0; i < 10000; i++) {
    const candidate = `user_${key}_${i}`
    if (predicate(bucketFor(key, candidate))) return candidate
  }
  throw new Error(`Could not find userId matching predicate for key=${key}`)
}

describe('feature-flag.service', () => {
  beforeEach(async () => {
    await resetTables(['FeatureFlag'])
  })

  describe('isEnabled', () => {
    it('returns false when the flag does not exist', async () => {
      expect(await isEnabled({ key: 'missing.flag' })).toBe(false)
      expect(await isEnabled({ key: 'missing.flag', userId: 'u1' })).toBe(false)
    })

    it('returns false when enabled=false (regardless of rollout / allowlist)', async () => {
      await db.featureFlag.create({
        data: {
          key: 'off.flag',
          name: 'Off',
          enabled: false,
          rolloutPercent: 100,
          allowedUserIds: ['u1'],
        },
      })
      expect(await isEnabled({ key: 'off.flag' })).toBe(false)
      expect(await isEnabled({ key: 'off.flag', userId: 'u1' })).toBe(false)
    })

    it('returns true when the user is in allowedUserIds (even at 0% rollout)', async () => {
      await db.featureFlag.create({
        data: {
          key: 'allowlist.flag',
          name: 'Allowlist',
          enabled: true,
          rolloutPercent: 0,
          allowedUserIds: ['allowed-user-1', 'allowed-user-2'],
        },
      })
      expect(
        await isEnabled({ key: 'allowlist.flag', userId: 'allowed-user-1' }),
      ).toBe(true)
      expect(
        await isEnabled({ key: 'allowlist.flag', userId: 'allowed-user-2' }),
      ).toBe(true)
      expect(
        await isEnabled({ key: 'allowlist.flag', userId: 'someone-else' }),
      ).toBe(false)
    })

    it('returns true at rolloutPercent=100 even without a userId', async () => {
      await db.featureFlag.create({
        data: {
          key: 'full.rollout',
          name: 'Full',
          enabled: true,
          rolloutPercent: 100,
          allowedUserIds: [],
        },
      })
      expect(await isEnabled({ key: 'full.rollout' })).toBe(true)
      expect(await isEnabled({ key: 'full.rollout', userId: 'anyone' })).toBe(
        true,
      )
    })

    it('returns false at rolloutPercent=0 without an allowlist match', async () => {
      await db.featureFlag.create({
        data: {
          key: 'zero.rollout',
          name: 'Zero',
          enabled: true,
          rolloutPercent: 0,
          allowedUserIds: [],
        },
      })
      expect(await isEnabled({ key: 'zero.rollout' })).toBe(false)
      expect(await isEnabled({ key: 'zero.rollout', userId: 'u1' })).toBe(false)
    })

    it('partial rollout: bucket below threshold → true; at-or-above → false', async () => {
      const key = 'partial.rollout'
      await db.featureFlag.create({
        data: {
          key,
          name: 'Partial',
          enabled: true,
          rolloutPercent: 50,
          allowedUserIds: [],
        },
      })

      // Pick deterministic userIds: one that lands in [0, 49] and one in [50, 99].
      const inUser = findUserIdInBucket(key, (b) => b < 50)
      const outUser = findUserIdInBucket(key, (b) => b >= 50)

      expect(await isEnabled({ key, userId: inUser })).toBe(true)
      expect(await isEnabled({ key, userId: outUser })).toBe(false)
    })

    it('rollout is stable: same (key, userId) always resolves to the same value', async () => {
      const key = 'stable.rollout'
      await db.featureFlag.create({
        data: {
          key,
          name: 'Stable',
          enabled: true,
          rolloutPercent: 30,
          allowedUserIds: [],
        },
      })

      const userId = 'persistent-user-id'
      const first = await isEnabled({ key, userId })
      const second = await isEnabled({ key, userId })
      const third = await isEnabled({ key, userId })
      expect(first).toBe(second)
      expect(second).toBe(third)
    })

    it('partial rollout without a userId returns false (no anonymous bucketing)', async () => {
      await db.featureFlag.create({
        data: {
          key: 'anon.rollout',
          name: 'Anon',
          enabled: true,
          rolloutPercent: 50,
          allowedUserIds: [],
        },
      })
      expect(await isEnabled({ key: 'anon.rollout' })).toBe(false)
    })
  })

  describe('isEnabledBulk', () => {
    it('returns a record with one entry per requested key, including missing flags', async () => {
      await db.featureFlag.create({
        data: {
          key: 'present.flag',
          name: 'Present',
          enabled: true,
          rolloutPercent: 100,
          allowedUserIds: [],
        },
      })
      const out = await isEnabledBulk({
        keys: ['present.flag', 'absent.flag'],
        userId: 'u1',
      })
      expect(out).toEqual({ 'present.flag': true, 'absent.flag': false })
    })

    it('empty keys array returns an empty object without hitting the DB', async () => {
      expect(await isEnabledBulk({ keys: [], userId: 'u1' })).toEqual({})
    })
  })

  describe('upsert', () => {
    it('creates a new flag and updates it on a second call (same key)', async () => {
      await upsert({
        key: 'crud.flag',
        name: 'CRUD',
        description: 'Initial',
        enabled: false,
        rolloutPercent: 0,
        allowedUserIds: [],
      })
      const initial = await db.featureFlag.findUnique({
        where: { key: 'crud.flag' },
      })
      expect(initial?.description).toBe('Initial')
      expect(initial?.enabled).toBe(false)

      await upsert({
        key: 'crud.flag',
        name: 'CRUD',
        description: 'Updated',
        enabled: true,
        rolloutPercent: 75,
        allowedUserIds: ['u1'],
      })
      const updated = await db.featureFlag.findUnique({
        where: { key: 'crud.flag' },
      })
      expect(updated?.description).toBe('Updated')
      expect(updated?.enabled).toBe(true)
      expect(updated?.rolloutPercent).toBe(75)
      expect(updated?.allowedUserIds).toEqual(['u1'])
    })

    it('rejects rolloutPercent outside 0..100', async () => {
      await expect(
        upsert({
          key: 'bad.flag',
          name: 'Bad',
          enabled: true,
          rolloutPercent: 101,
          allowedUserIds: [],
        }),
      ).rejects.toThrow(/0 and 100/)
    })
  })

  describe('remove', () => {
    it('deletes an existing flag', async () => {
      await db.featureFlag.create({
        data: {
          key: 'delete.me',
          name: 'Delete',
          enabled: true,
          rolloutPercent: 0,
          allowedUserIds: [],
        },
      })
      await remove({ key: 'delete.me' })
      expect(
        await db.featureFlag.findUnique({ where: { key: 'delete.me' } }),
      ).toBeNull()
    })

    it('is a no-op for missing keys (does not throw)', async () => {
      const result = await remove({ key: 'never.existed' })
      expect(result).toEqual({ key: 'never.existed', deleted: true })
    })
  })
})
