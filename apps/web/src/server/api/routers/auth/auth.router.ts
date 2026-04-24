import { createTRPCRouter, publicProcedure } from '../../trpc'
import { passkeyAuthRouter } from './auth.passkey.router'

export const authRouter = createTRPCRouter({
  passkey: passkeyAuthRouter,
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.session.destroy()
    return
  }),
})
