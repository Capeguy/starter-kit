import { resetTables } from '~tests/db/utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@acme/db'

import { issue, listMine, revoke, verifyAndTouch } from '../api-token.service'

const TOKEN_PREFIX = 'vibe_pat_'

const createUser = async (suffix: string) =>
  db.user.create({
    data: {
      email: `apitoken-${suffix}@example.com`,
      name: `ApiTokenUser-${suffix}`,
      roleId: 'role_user',
    },
  })

describe('apiToken.service', () => {
  beforeEach(async () => {
    await resetTables(['ApiToken', 'User'])
  })

  describe('issue', () => {
    it('returns plaintext + prefix + persists a hashed row', async () => {
      const user = await createUser('issue')

      const result = await issue({ userId: user.id, name: 'CLI' })

      expect(result.plaintext).toMatch(/^vibe_pat_[A-Za-z0-9_-]{24}$/)
      expect(result.prefix).toBe(
        result.plaintext.slice(0, TOKEN_PREFIX.length + 8),
      )
      expect(result.expiresAt).toBeNull()
      expect(result.id).toBeTruthy()

      const row = await db.apiToken.findUnique({ where: { id: result.id } })
      expect(row).toMatchObject({
        userId: user.id,
        name: 'CLI',
        prefix: result.prefix,
        revokedAt: null,
        expiresAt: null,
      })
      // Plaintext is NEVER persisted; only the SHA-256 hash is stored.
      expect(row?.tokenHash).not.toContain(result.plaintext)
      expect(row?.tokenHash).toHaveLength(64) // SHA-256 hex
    })

    it('respects expiresInDays', async () => {
      const user = await createUser('expires')
      const before = Date.now()
      const result = await issue({
        userId: user.id,
        name: '7d',
        expiresInDays: 7,
      })
      const after = Date.now()

      expect(result.expiresAt).toBeInstanceOf(Date)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const expiresMs = result.expiresAt!.getTime()
      // Allow ~1s wiggle for slow CI.
      expect(expiresMs).toBeGreaterThanOrEqual(
        before + 7 * 24 * 60 * 60 * 1000 - 1000,
      )
      expect(expiresMs).toBeLessThanOrEqual(
        after + 7 * 24 * 60 * 60 * 1000 + 1000,
      )
    })
  })

  describe('verifyAndTouch', () => {
    it('returns userId + capabilities for a valid token', async () => {
      const user = await createUser('verify')
      const issued = await issue({ userId: user.id, name: 'verify' })

      const verified = await verifyAndTouch(issued.plaintext)

      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe(user.id)
      expect(verified?.role.name).toBe('User')
      expect(verified?.capabilities).toEqual([])
    })

    it('updates lastUsedAt on each successful verify', async () => {
      const user = await createUser('lastused')
      const issued = await issue({ userId: user.id, name: 'lastused' })

      const before = await db.apiToken.findUnique({ where: { id: issued.id } })
      expect(before?.lastUsedAt).toBeNull()

      await verifyAndTouch(issued.plaintext)
      // verifyAndTouch fires the update without await; poll briefly.
      await new Promise((r) => setTimeout(r, 50))

      const after = await db.apiToken.findUnique({ where: { id: issued.id } })
      expect(after?.lastUsedAt).toBeInstanceOf(Date)
    })

    it('returns null for unknown tokens', async () => {
      // Same shape, totally fabricated — not in the DB.
      const fake = `${TOKEN_PREFIX}AAAAAAAAAAAAAAAAAAAAAAAA`
      const verified = await verifyAndTouch(fake)
      expect(verified).toBeNull()
    })

    it('returns null for non-namespace tokens', async () => {
      const verified = await verifyAndTouch('Bearer something_else')
      expect(verified).toBeNull()
    })

    it('returns null for revoked tokens', async () => {
      const user = await createUser('revoked')
      const issued = await issue({ userId: user.id, name: 'revoked' })
      await revoke({ id: issued.id, userId: user.id })

      const verified = await verifyAndTouch(issued.plaintext)
      expect(verified).toBeNull()
    })

    it('returns null for expired tokens', async () => {
      const user = await createUser('expired')
      const issued = await issue({ userId: user.id, name: 'expired' })
      // Force-expire via direct DB write (the issue() flow only accepts
      // future expiries by design).
      await db.apiToken.update({
        where: { id: issued.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })

      const verified = await verifyAndTouch(issued.plaintext)
      expect(verified).toBeNull()
    })
  })

  describe('listMine', () => {
    it('returns active + revoked rows scoped to the user', async () => {
      const u1 = await createUser('list-1')
      const u2 = await createUser('list-2')

      const t1 = await issue({ userId: u1.id, name: 'a' })
      await issue({ userId: u1.id, name: 'b' })
      await issue({ userId: u2.id, name: 'other-user' })
      await revoke({ id: t1.id, userId: u1.id })

      const result = await listMine({ userId: u1.id })

      expect(result).toHaveLength(2)
      expect(result.map((t) => t.name).sort()).toEqual(['a', 'b'])
      const revokedRow = result.find((t) => t.name === 'a')
      expect(revokedRow?.revokedAt).toBeInstanceOf(Date)
    })
  })

  describe('revoke', () => {
    it('only revokes tokens owned by the caller', async () => {
      const owner = await createUser('owner')
      const stranger = await createUser('stranger')
      const issued = await issue({ userId: owner.id, name: 'owned' })

      // Stranger calling revoke is a no-op (owner-scoped via updateMany).
      await revoke({ id: issued.id, userId: stranger.id })

      const verified = await verifyAndTouch(issued.plaintext)
      expect(verified).not.toBeNull()
      expect(verified?.userId).toBe(owner.id)

      // Owner can revoke.
      await revoke({ id: issued.id, userId: owner.id })

      const afterOwnerRevoke = await verifyAndTouch(issued.plaintext)
      expect(afterOwnerRevoke).toBeNull()
    })
  })
})
