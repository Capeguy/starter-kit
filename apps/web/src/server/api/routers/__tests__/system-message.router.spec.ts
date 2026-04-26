import { TRPCError } from '@trpc/server'
import { resetTables } from '~tests/db/utils'
import { createTestCaller, createTestContext } from '~tests/trpc'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@acme/db'

import { Capability, SystemRoleId } from '~/lib/rbac'

const ADMIN_CAPS = Object.values(Capability)

const seedSystemRoles = async () => {
  await db.role.upsert({
    where: { id: SystemRoleId.Admin },
    update: { capabilities: ADMIN_CAPS },
    create: {
      id: SystemRoleId.Admin,
      name: 'Admin',
      isSystem: true,
      capabilities: ADMIN_CAPS,
    },
  })
  await db.role.upsert({
    where: { id: SystemRoleId.User },
    update: {},
    create: {
      id: SystemRoleId.User,
      name: 'User',
      isSystem: true,
      capabilities: [],
    },
  })
}

const createUserWithRole = async (name: string, roleId: string) => {
  return db.user.create({
    data: { name, roleId },
    select: { id: true, name: true, roleId: true },
  })
}

describe('systemMessage routers', () => {
  beforeEach(async () => {
    await resetTables(['AuditLog', 'SystemMessage', 'User', 'Account', 'Role'])
    await seedSystemRoles()
  })

  describe('systemMessage.get (public-authed)', () => {
    it('returns the empty default when no row exists', async () => {
      const user = await createUserWithRole('AnyUser', SystemRoleId.User)
      const caller = createTestCaller(
        createTestContext({ session: { userId: user.id } }),
      )

      const result = await caller.systemMessage.get()
      expect(result).toEqual({
        enabled: false,
        message: '',
        severity: 'INFO',
      })
    })

    it('returns the singleton row contents when present', async () => {
      const user = await createUserWithRole('AnyUser', SystemRoleId.User)
      await db.systemMessage.create({
        data: {
          id: 'singleton',
          enabled: true,
          message: 'Heads up: maintenance Sunday 02:00 UTC',
          severity: 'WARNING',
        },
      })
      const caller = createTestCaller(
        createTestContext({ session: { userId: user.id } }),
      )

      const result = await caller.systemMessage.get()
      expect(result).toEqual({
        enabled: true,
        message: 'Heads up: maintenance Sunday 02:00 UTC',
        severity: 'WARNING',
      })
    })

    it('rejects unauthenticated callers', async () => {
      const caller = createTestCaller(createTestContext(undefined))
      await expect(caller.systemMessage.get()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      })
    })
  })

  describe('admin.systemMessage.update', () => {
    it('upserts the singleton, stamps updatedById, and writes an audit row', async () => {
      const admin = await createUserWithRole('AdminCaller', SystemRoleId.Admin)
      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      const result = await caller.admin.systemMessage.update({
        enabled: true,
        message: 'All systems nominal.',
        severity: 'INFO',
      })

      expect(result).toMatchObject({
        enabled: true,
        message: 'All systems nominal.',
        severity: 'INFO',
        updatedById: admin.id,
      })

      // Underlying row was upserted with the singleton id.
      const row = await db.systemMessage.findUnique({
        where: { id: 'singleton' },
      })
      expect(row?.message).toBe('All systems nominal.')

      // One audit row landed with the right metadata shape.
      const audits = await db.auditLog.findMany({
        where: { action: 'system_message.update' },
      })
      expect(audits).toHaveLength(1)
      expect(audits[0]?.metadata).toMatchObject({
        enabled: true,
        severity: 'INFO',
        messageLength: 'All systems nominal.'.length,
      })
      expect(audits[0]?.userId).toBe(admin.id)
    })

    it('rejects callers without the system.message.manage capability', async () => {
      const userOnly = await createUserWithRole('PlainUser', SystemRoleId.User)
      const caller = createTestCaller(
        createTestContext({ session: { userId: userOnly.id } }),
      )

      try {
        await caller.admin.systemMessage.update({
          enabled: true,
          message: 'should fail',
          severity: 'INFO',
        })
        throw new Error('expected throw')
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError)
        expect((error as TRPCError).code).toEqual('FORBIDDEN')
      }
    })

    it('rejects messages longer than 500 chars', async () => {
      const admin = await createUserWithRole('AdminCaller', SystemRoleId.Admin)
      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      await expect(
        caller.admin.systemMessage.update({
          enabled: true,
          message: 'x'.repeat(501),
          severity: 'INFO',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })
  })
})
