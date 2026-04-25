import {
  AuditAction,
  recordAuditEvent,
} from '~/server/modules/audit/audit.service'
import { createTRPCRouter, publicProcedure } from '../../trpc'
import { passkeyAuthRouter } from './auth.passkey.router'

export const authRouter = createTRPCRouter({
  passkey: passkeyAuthRouter,
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.userId
    ctx.session.destroy()
    await recordAuditEvent({
      userId,
      action: AuditAction.AuthLogout,
      headers: ctx.headers,
    })
    return
  }),
})
