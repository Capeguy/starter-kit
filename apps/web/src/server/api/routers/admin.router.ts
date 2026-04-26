import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TransactionClient } from '@acme/db'
import { db } from '@acme/db'

import { ALL_CAPABILITIES, Capability, SystemRoleId } from '~/lib/rbac'
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
  INVITE_DEFAULT_TTL_SECONDS,
  issueInvite,
  listInvites,
  revokeInvite,
} from '~/server/modules/auth/invite.service'
import {
  list as listFeatureFlags,
  remove as removeFeatureFlag,
  upsert as upsertFeatureFlag,
} from '~/server/modules/feature-flag/feature-flag.service'
import { deleteFile, listAllFiles } from '~/server/modules/file/file.service'
import {
  getMcpSettings,
  MCP_TOOLS,
  setMcpEnabled,
  setToolEnabled,
} from '~/server/modules/mcp/mcp.service'
import { broadcast } from '~/server/modules/notification/notification.service'
import {
  SYSTEM_MESSAGE_SEVERITIES,
  updateSystemMessage,
} from '~/server/modules/system-message/system-message.service'
import { extractIpAddress } from '~/server/utils/request'
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

  invites: createTRPCRouter({
    list: capabilityProcedure(Capability.UserInviteIssue)
      .input(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      )
      .query(({ input }) => listInvites(input)),

    issue: capabilityProcedure(Capability.UserInviteIssue)
      .input(
        z.object({
          name: z.string().trim().max(50).nullish(),
          email: z.string().trim().email().nullish().or(z.literal('')),
          roleId: z.string(),
          // null = no expiry; otherwise seconds. UI exposes presets.
          expiresInSeconds: z
            .number()
            .int()
            .positive()
            .nullable()
            .default(INVITE_DEFAULT_TTL_SECONDS),
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

        // Normalise empty string → null so downstream and audit metadata
        // never carry the literal '' that the schema's `z.literal('')`
        // tolerates from the form.
        const normalisedEmail =
          input.email && input.email.length > 0 ? input.email : null

        const result = await issueInvite({
          name: input.name ?? null,
          email: normalisedEmail,
          roleId: input.roleId,
          expiresInSeconds: input.expiresInSeconds,
          issuedById: ctx.user.id,
          origin,
        })

        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.UserInviteIssue,
          metadata: {
            inviteId: result.id,
            roleId: input.roleId,
            email: normalisedEmail,
            name: input.name ?? null,
            expiresAt: result.expiresAt?.toISOString() ?? null,
          },
          headers: ctx.headers,
        })

        return result
      }),

    revoke: capabilityProcedure(Capability.UserInviteIssue)
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => revokeInvite({ id: input.id })),
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

    // Read-only roster of users in a role; powers the "Users" count modal on
    // /admin/roles. Anyone with a session can call this — same posture as
    // `roles.list` above (role membership is not secret).
    listUsers: protectedProcedure
      .input(z.object({ roleId: z.string() }))
      .query(async ({ input }) => {
        const items = await db.user.findMany({
          where: { roleId: input.roleId },
          select: { id: true, name: true, email: true, lastLogin: true },
          orderBy: { name: 'asc' },
        })
        return { items }
      }),

    // Bulk role change. Mirrors the "last admin" guard from
    // `admin.users.setRole` so an admin can't accidentally empty `role_admin`.
    // Wraps the updateMany + audit fan-out in a single transaction; per-user
    // audit rows are emitted so the existing audit UI surfaces each move.
    reassignUsers: capabilityProcedure(Capability.UserRoleAssign)
      .input(
        z.object({
          fromRoleId: z.string(),
          toRoleId: z.string(),
          userIds: z.array(z.string()).min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (input.fromRoleId === input.toRoleId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Source and target roles must be different.',
          })
        }

        const [fromRole, toRole] = await Promise.all([
          db.role.findUnique({
            where: { id: input.fromRoleId },
            select: { id: true, name: true },
          }),
          db.role.findUnique({
            where: { id: input.toRoleId },
            select: { id: true, name: true },
          }),
        ])
        if (!fromRole) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Source role not found',
          })
        }
        if (!toRole) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target role not found',
          })
        }

        const result = await db.$transaction(async (tx: TransactionClient) => {
          // Defense in depth: the modal only offers users currently in
          // `fromRoleId`, but an outdated client could submit stale ids. Reject
          // before we mutate anything so the audit log isn't polluted with
          // no-op rows.
          const matching = await tx.user.findMany({
            where: { id: { in: input.userIds }, roleId: input.fromRoleId },
            select: { id: true },
          })
          if (matching.length !== input.userIds.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'One or more users no longer belong to the source role. Refresh and try again.',
            })
          }

          // Last-admin guard: count admins after the prospective move.
          if (input.fromRoleId === SystemRoleId.Admin) {
            const totalAdmins = await tx.user.count({
              where: { roleId: SystemRoleId.Admin },
            })
            if (totalAdmins - input.userIds.length < 1) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message:
                  'Cannot reassign: the system must always have at least one Admin.',
              })
            }
          }

          const updated = await tx.user.updateMany({
            where: { id: { in: input.userIds }, roleId: input.fromRoleId },
            data: { roleId: input.toRoleId },
          })

          // Inline auditLog inserts (rather than `recordAuditEvent`) so they
          // share the transaction — if the bulk role change rolls back, the
          // audit rows roll back with it.
          const ip = extractIpAddress(ctx.headers)
          const userAgent = ctx.headers.get('user-agent') ?? null
          for (const userId of input.userIds) {
            await tx.auditLog.create({
              data: {
                userId,
                action: AuditAction.UserRoleChange,
                metadata: {
                  actingUserId: ctx.user.id,
                  oldRoleId: input.fromRoleId,
                  newRoleId: input.toRoleId,
                },
                ip,
                userAgent,
              },
            })
          }

          return { count: updated.count }
        })

        return result
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

  mcp: createTRPCRouter({
    // Read the master + per-tool MCP toggles. Capability.AdminAccess (which
    // all admins have) is sufficient — these are operational toggles, not
    // RBAC-class settings.
    getSettings: capabilityProcedure(Capability.AdminAccess).query(() =>
      getMcpSettings(),
    ),

    setEnabled: capabilityProcedure(Capability.AdminAccess)
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        await setMcpEnabled(input.enabled)
        return { enabled: input.enabled }
      }),

    setToolEnabled: capabilityProcedure(Capability.AdminAccess)
      .input(
        z.object({
          name: z.enum(MCP_TOOLS.map((t) => t.name) as [string, ...string[]]),
          enabled: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        await setToolEnabled(input.name, input.enabled)
        return { name: input.name, enabled: input.enabled }
      }),
  }),

  systemMessage: createTRPCRouter({
    update: capabilityProcedure(Capability.SystemMessageManage)
      .input(
        z.object({
          enabled: z.boolean(),
          // Cap matches the textarea hint in the admin UI; banner real estate
          // is limited so anything longer would wrap awkwardly.
          message: z.string().max(500),
          severity: z.enum(SYSTEM_MESSAGE_SEVERITIES),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await updateSystemMessage({
          enabled: input.enabled,
          message: input.message,
          severity: input.severity,
          updatedById: ctx.user.id,
        })
        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.SystemMessageUpdate,
          metadata: {
            enabled: input.enabled,
            severity: input.severity,
            messageLength: input.message.length,
          },
          headers: ctx.headers,
        })
        return result
      }),
  }),
})
