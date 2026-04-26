import { TRPCError } from '@trpc/server'
import z from 'zod'

import { db } from '@acme/db'

import { Capability } from '~/lib/rbac'
import {
  AuditAction,
  recordAuditEvent,
} from '~/server/modules/audit/audit.service'
import { getSession } from '~/server/session'
import {
  capabilityProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '../trpc'

export const impersonationRouter = createTRPCRouter({
  /**
   * Start impersonating another user. Requires the `user.impersonate`
   * capability. Cannot impersonate yourself; cannot stack (must stop
   * the existing impersonation first).
   *
   * On success, the session's `userId` becomes the target's id and the
   * original admin's id is held in `impersonatedById` for the revert.
   */
  start: capabilityProcedure(Capability.UserImpersonate)
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // The session passed through tRPC middleware is a spread copy that
      // has lost iron-session's `save()` prototype method. Re-acquire the
      // real session instance to mutate + persist.
      const session = await getSession()
      if (session.impersonatedById) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Already impersonating. Stop the current impersonation first.',
        })
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot impersonate yourself.',
        })
      }
      const target = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true },
      })
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' })
      }

      const originalUserId = ctx.user.id
      session.impersonatedById = originalUserId
      session.userId = target.id
      await session.save()

      await recordAuditEvent({
        userId: originalUserId,
        action: AuditAction.UserImpersonateStart,
        metadata: { targetUserId: target.id },
        headers: ctx.headers,
      })

      return { targetUserId: target.id, targetName: target.name }
    }),

  /**
   * Stop impersonating. Reverts session.userId to the original admin id.
   * Available to any session that's currently impersonating — no capability
   * required (the user might have been demoted mid-impersonation but still
   * needs to be able to stop).
   */
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const session = await getSession()
    const originalUserId = session.impersonatedById
    if (!originalUserId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Not currently impersonating.',
      })
    }
    const impersonatedUserId = session.userId

    session.userId = originalUserId
    delete session.impersonatedById
    await session.save()

    await recordAuditEvent({
      userId: originalUserId,
      action: AuditAction.UserImpersonateStop,
      metadata: { impersonatedUserId },
      headers: ctx.headers,
    })

    return { restoredUserId: originalUserId }
  }),
})
