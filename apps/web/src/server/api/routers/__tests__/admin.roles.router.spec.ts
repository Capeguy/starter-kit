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

describe('admin.roles router', () => {
  beforeEach(async () => {
    await resetTables(['AuditLog', 'User', 'Account', 'Role'])
    await seedSystemRoles()
  })

  describe('reassignUsers', () => {
    it('happy path: bulk-moves 5 users from a custom role to User and emits one audit row each', async () => {
      const admin = await createUserWithRole('AdminCaller', SystemRoleId.Admin)
      const customRole = await db.role.create({
        data: {
          id: 'role_custom_x',
          name: 'CustomX',
          isSystem: false,
          capabilities: [],
        },
      })
      const movees = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          createUserWithRole(`Movee${i}`, customRole.id),
        ),
      )

      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      const result = await caller.admin.roles.reassignUsers({
        fromRoleId: customRole.id,
        toRoleId: SystemRoleId.User,
        userIds: movees.map((u) => u.id),
      })

      expect(result.count).toBe(5)

      // All 5 users now belong to role_user.
      const moved = await db.user.findMany({
        where: { id: { in: movees.map((u) => u.id) } },
        select: { roleId: true },
      })
      expect(moved.every((u) => u.roleId === SystemRoleId.User)).toBe(true)

      // 5 audit rows landed, all with the right metadata shape.
      const audits = await db.auditLog.findMany({
        where: {
          userId: { in: movees.map((u) => u.id) },
          action: 'user.role.change',
        },
      })
      expect(audits).toHaveLength(5)
      for (const a of audits) {
        expect(a.metadata).toMatchObject({
          actingUserId: admin.id,
          oldRoleId: customRole.id,
          newRoleId: SystemRoleId.User,
        })
      }
    })

    it('last-admin guard: refuses to reassign all admins out of role_admin', async () => {
      // Two admins exist; reassigning both must fail.
      const adminCaller = await createUserWithRole(
        'AdminCaller2',
        SystemRoleId.Admin,
      )
      const otherAdmin = await createUserWithRole(
        'OtherAdmin',
        SystemRoleId.Admin,
      )

      const caller = createTestCaller(
        createTestContext({ session: { userId: adminCaller.id } }),
      )

      await expect(
        caller.admin.roles.reassignUsers({
          fromRoleId: SystemRoleId.Admin,
          toRoleId: SystemRoleId.User,
          userIds: [adminCaller.id, otherAdmin.id],
        }),
      ).rejects.toThrowError(/at least one Admin/i)

      // Roles unchanged — full transactional rollback.
      const stillAdmins = await db.user.count({
        where: {
          id: { in: [adminCaller.id, otherAdmin.id] },
          roleId: SystemRoleId.Admin,
        },
      })
      expect(stillAdmins).toBe(2)

      // No audit rows committed.
      const audits = await db.auditLog.count({
        where: { action: 'user.role.change' },
      })
      expect(audits).toBe(0)
    })

    it('rejects userIds that no longer belong to fromRoleId (race-condition guard)', async () => {
      const admin = await createUserWithRole('AdminCaller3', SystemRoleId.Admin)
      const customRole = await db.role.create({
        data: {
          id: 'role_stale',
          name: 'StaleRole',
          isSystem: false,
          capabilities: [],
        },
      })
      // u1 is in customRole; u2 is NOT — but the client thinks both are.
      const u1 = await createUserWithRole('StaleU1', customRole.id)
      const u2 = await createUserWithRole('StaleU2', SystemRoleId.User)

      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      await expect(
        caller.admin.roles.reassignUsers({
          fromRoleId: customRole.id,
          toRoleId: SystemRoleId.User,
          userIds: [u1.id, u2.id],
        }),
      ).rejects.toThrowError(/no longer belong/i)

      // u1 is still in customRole — the rejection rolled back any partial moves.
      const u1Now = await db.user.findUnique({
        where: { id: u1.id },
        select: { roleId: true },
      })
      expect(u1Now?.roleId).toBe(customRole.id)

      // No audit rows committed.
      const audits = await db.auditLog.count({
        where: { action: 'user.role.change' },
      })
      expect(audits).toBe(0)
    })

    it('rejects when fromRoleId === toRoleId', async () => {
      const admin = await createUserWithRole('AdminCaller4', SystemRoleId.Admin)
      const u1 = await createUserWithRole('NoOpUser', SystemRoleId.User)

      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      await expect(
        caller.admin.roles.reassignUsers({
          fromRoleId: SystemRoleId.User,
          toRoleId: SystemRoleId.User,
          userIds: [u1.id],
        }),
      ).rejects.toThrowError(TRPCError)
    })

    it('requires the user.role.assign capability', async () => {
      const plainUser = await createUserWithRole('PlainUser', SystemRoleId.User)
      const u1 = await createUserWithRole('Target', SystemRoleId.User)

      const caller = createTestCaller(
        createTestContext({ session: { userId: plainUser.id } }),
      )

      await expect(
        caller.admin.roles.reassignUsers({
          fromRoleId: SystemRoleId.User,
          toRoleId: SystemRoleId.Admin,
          userIds: [u1.id],
        }),
      ).rejects.toThrow(/FORBIDDEN|Missing capability/i)
    })
  })

  describe('listUsers', () => {
    it('returns users in a role ordered by name', async () => {
      const admin = await createUserWithRole(
        'ListUsersCaller',
        SystemRoleId.Admin,
      )
      const role = await db.role.create({
        data: {
          id: 'role_listusers',
          name: 'ListMe',
          isSystem: false,
          capabilities: [],
        },
      })
      await createUserWithRole('Charlie', role.id)
      await createUserWithRole('Alice', role.id)
      await createUserWithRole('Bob', role.id)

      const caller = createTestCaller(
        createTestContext({ session: { userId: admin.id } }),
      )

      const result = await caller.admin.roles.listUsers({ roleId: role.id })
      expect(result.items.map((u) => u.name)).toEqual([
        'Alice',
        'Bob',
        'Charlie',
      ])
    })
  })
})
