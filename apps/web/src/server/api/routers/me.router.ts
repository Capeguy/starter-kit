import { db } from '@acme/db'

import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { getUserById } from '~/server/modules/user/user.service'

export const meRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const me = await getUserById(ctx.session.userId)
    if (!me) return null
    // Surface the original admin's identity when in impersonation mode so
    // the banner can show "You are impersonating X (as Y)".
    const impersonator = ctx.session.impersonatedById
      ? await db.user.findUnique({
          where: { id: ctx.session.impersonatedById },
          select: { id: true, name: true },
        })
      : null
    return { ...me, impersonator }
  }),
})
