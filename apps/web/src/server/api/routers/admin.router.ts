import z from 'zod'

import { db } from '@acme/db'

import { ALL_CAPABILITIES, Capability } from '~/lib/rbac'
import {
  deleteUser,
  getUser,
  issuePasskeyReset,
  listUsers,
  RESET_DEFAULT_TTL_SECONDS,
  setUserRole,
} from '~/server/modules/admin/admin.service'
import {
  AuditAction,
  recordAuditEvent,
} from '~/server/modules/audit/audit.service'
import {
  list as listFeatureFlags,
  remove as removeFeatureFlag,
  upsert as upsertFeatureFlag,
} from '~/server/modules/feature-flag/feature-flag.service'
import { deleteFile, listAllFiles } from '~/server/modules/file/file.service'
import { broadcast } from '~/server/modules/notification/notification.service'
import {
  capabilityProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '../trpc'

export const adminRouter = createTRPCRouter({
  users: createTRPCRouter({
    list: capabilityProcedure(Capability.UserList)
      .input(
        z.object({
          q: z.string().nullish(),
          roleId: z.string().nullish(),
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      )
      .query(({ input }) => listUsers(input)),

    get: capabilityProcedure(Capability.UserList)
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => getUser(input)),

    setRole: capabilityProcedure(Capability.UserRoleAssign)
      .input(z.object({ userId: z.string(), roleId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await setUserRole({
          userId: input.userId,
          roleId: input.roleId,
          actingUserId: ctx.user.id,
        })
        if (result.changed) {
          await recordAuditEvent({
            userId: input.userId,
            action: AuditAction.UserRoleChange,
            metadata: {
              newRoleId: input.roleId,
              actingUserId: ctx.user.id,
            },
            headers: ctx.headers,
          })
        }
        return result
      }),

    delete: capabilityProcedure(Capability.UserDelete)
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await deleteUser({
          userId: input.userId,
          actingUserId: ctx.user.id,
        })
        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.UserDelete,
          metadata: { deletedUserId: input.userId },
          headers: ctx.headers,
        })
        return result
      }),

    issuePasskeyReset: capabilityProcedure(Capability.UserUpdate)
      .input(
        z.object({
          userId: z.string(),
          // null = no expiry; otherwise seconds. UI exposes presets.
          expiresInSeconds: z
            .number()
            .int()
            .positive()
            .nullable()
            .default(RESET_DEFAULT_TTL_SECONDS),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const proto =
          ctx.headers.get('x-forwarded-proto') ??
          (ctx.headers.get('host')?.startsWith('localhost') ? 'http' : 'https')
        const host =
          ctx.headers.get('x-forwarded-host') ??
          ctx.headers.get('host') ??
          'localhost:3000'
        const origin = `${proto}://${host}`

        const result = await issuePasskeyReset({
          userId: input.userId,
          expiresInSeconds: input.expiresInSeconds,
          issuedById: ctx.user.id,
          origin,
        })

        await recordAuditEvent({
          userId: input.userId,
          action: AuditAction.AuthPasskeyResetIssue,
          metadata: {
            issuedById: ctx.user.id,
            expiresAt: result.expiresAt?.toISOString() ?? null,
          },
          headers: ctx.headers,
        })

        return result
      }),
  }),

  files: createTRPCRouter({
    list: capabilityProcedure(Capability.FileReadAny)
      .input(
        z.object({
          q: z.string().nullish(),
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      )
      .query(({ input }) => listAllFiles(input)),

    delete: capabilityProcedure(Capability.FileDeleteAny)
      .input(z.object({ fileId: z.string() }))
      .mutation(({ input, ctx }) =>
        deleteFile({
          fileId: input.fileId,
          actingUserId: ctx.user.id,
          actingUserCapabilities: ctx.user.capabilities,
        }),
      ),
  }),

  roles: createTRPCRouter({
    // Anyone with a session can list roles — they're not secrets, and the
    // user-list dropdown needs them to render labels for every assigned role.
    list: protectedProcedure.query(async () => {
      const items = await db.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          capabilities: true,
          _count: { select: { users: true } },
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      })
      return { items, allCapabilities: ALL_CAPABILITIES }
    }),

    create: capabilityProcedure(Capability.RbacRoleCreate)
      .input(
        z.object({
          name: z.string().min(1).max(50),
          description: z.string().max(500).nullish(),
          capabilities: z.array(z.string()).default([]),
        }),
      )
      .mutation(async ({ input }) => {
        // Use slugified name as id; name is also unique (citext).
        const id = `role_${input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')}`
        return db.role.create({
          data: {
            id,
            name: input.name,
            description: input.description ?? null,
            capabilities: input.capabilities,
            isSystem: false,
          },
        })
      }),

    update: capabilityProcedure(Capability.RbacRoleUpdate)
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(50).optional(),
          description: z.string().max(500).nullish(),
          capabilities: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const role = await db.role.findUnique({ where: { id: input.id } })
        if (!role) {
          throw new Error('Role not found')
        }
        // System roles' name is locked (callers depend on the seeded "Admin" /
        // "User" labels). Capabilities and description are still editable.
        return db.role.update({
          where: { id: input.id },
          data: {
            name: role.isSystem ? role.name : (input.name ?? role.name),
            description:
              input.description === undefined
                ? role.description
                : input.description,
            capabilities: input.capabilities ?? role.capabilities,
          },
        })
      }),

    delete: capabilityProcedure(Capability.RbacRoleDelete)
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const role = await db.role.findUnique({
          where: { id: input.id },
          select: { isSystem: true, _count: { select: { users: true } } },
        })
        if (!role) {
          throw new Error('Role not found')
        }
        if (role.isSystem) {
          throw new Error('System roles cannot be deleted.')
        }
        if (role._count.users > 0) {
          throw new Error(
            `Cannot delete: ${role._count.users} user(s) still hold this role. Reassign them first.`,
          )
        }
        return db.role.delete({ where: { id: input.id } })
      }),
  }),

  notifications: createTRPCRouter({
    broadcast: capabilityProcedure(Capability.NotificationBroadcast)
      .input(
        z.object({
          audience: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('all') }),
            z.object({ kind: z.literal('role'), roleId: z.string() }),
            z.object({ kind: z.literal('user'), userId: z.string() }),
          ]),
          title: z.string().min(1).max(120),
          body: z.string().max(2000).nullish(),
          href: z.string().max(500).nullish(),
        }),
      )
      .mutation(({ input }) =>
        broadcast({
          audience: input.audience,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
        }),
      ),
  }),

  featureFlags: createTRPCRouter({
    list: capabilityProcedure(Capability.FeatureFlagManage).query(() =>
      listFeatureFlags(),
    ),

    upsert: capabilityProcedure(Capability.FeatureFlagManage)
      .input(
        z.object({
          // Lowercase dotted slugs only — keeps the keyspace tidy and avoids
          // accidents like "MyFlag" vs "myflag" coexisting.
          key: z
            .string()
            .min(1)
            .max(64)
            .regex(
              /^[a-z0-9][a-z0-9._-]*$/,
              'Use lowercase letters, digits, dots, underscores, or hyphens.',
            ),
          name: z.string().min(1).max(120),
          description: z.string().max(500).nullish(),
          enabled: z.boolean(),
          rolloutPercent: z.number().int().min(0).max(100),
          allowedUserIds: z.array(z.string()).default([]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await upsertFeatureFlag({
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          enabled: input.enabled,
          rolloutPercent: input.rolloutPercent,
          allowedUserIds: input.allowedUserIds,
        })
        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.FeatureFlagUpsert,
          metadata: {
            key: input.key,
            enabled: input.enabled,
            rolloutPercent: input.rolloutPercent,
            allowedUserIdsCount: input.allowedUserIds.length,
          },
          headers: ctx.headers,
        })
        return result
      }),

    delete: capabilityProcedure(Capability.FeatureFlagManage)
      .input(z.object({ key: z.string().min(1).max(64) }))
      .mutation(async ({ input, ctx }) => {
        const result = await removeFeatureFlag({ key: input.key })
        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.FeatureFlagDelete,
          metadata: { key: input.key },
          headers: ctx.headers,
        })
        return result
      }),
  }),
})
