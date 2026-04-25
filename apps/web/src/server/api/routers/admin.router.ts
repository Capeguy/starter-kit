import z from 'zod'

import { Role } from '@acme/db/enums'

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
import { broadcast } from '~/server/modules/notification/notification.service'
import { adminProcedure, createTRPCRouter } from '../trpc'

const roleEnum = z.enum([Role.USER, Role.ADMIN])

export const adminRouter = createTRPCRouter({
  users: createTRPCRouter({
    list: adminProcedure
      .input(
        z.object({
          q: z.string().nullish(),
          role: roleEnum.nullish(),
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(100).default(50),
        }),
      )
      .query(({ input }) => listUsers(input)),

    get: adminProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => getUser(input)),

    setRole: adminProcedure
      .input(z.object({ userId: z.string(), role: roleEnum }))
      .mutation(async ({ input, ctx }) => {
        const result = await setUserRole({
          userId: input.userId,
          role: input.role,
          actingUserId: ctx.user.id,
        })
        if (result.changed) {
          await recordAuditEvent({
            userId: input.userId,
            action: AuditAction.UserRoleChange,
            metadata: {
              newRole: input.role,
              actingUserId: ctx.user.id,
            },
            headers: ctx.headers,
          })
        }
        return result
      }),

    delete: adminProcedure
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

    issuePasskeyReset: adminProcedure
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

  notifications: createTRPCRouter({
    broadcast: adminProcedure
      .input(
        z.object({
          audience: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('all') }),
            z.object({ kind: z.literal('role'), role: roleEnum }),
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
})
