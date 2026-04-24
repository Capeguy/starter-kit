import {
  generatePasskeyAuthenticationOptions,
  generatePasskeyRegistrationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from '~/server/modules/auth/passkey.service'
import {
  passkeyAuthenticationVerificationSchema,
  passkeyRegistrationOptionsSchema,
  passkeyRegistrationVerificationSchema,
} from '~/validators/passkey'
import { createTRPCRouter, publicProcedure } from '../../trpc'

export const passkeyAuthRouter = createTRPCRouter({
  generateRegistrationOptions: publicProcedure
    .input(passkeyRegistrationOptionsSchema)
    .mutation(({ input, ctx }) =>
      generatePasskeyRegistrationOptions({
        name: input.name,
        headers: ctx.headers,
      }),
    ),

  verifyRegistration: publicProcedure
    .input(passkeyRegistrationVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const verification = await verifyPasskeyRegistration({
        name: input.name,
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        headers: ctx.headers,
      })

      ctx.session.userId = verification.userId
      await ctx.session.save()

      return verification
    }),

  generateAuthenticationOptions: publicProcedure.mutation(({ ctx }) =>
    generatePasskeyAuthenticationOptions({ headers: ctx.headers }),
  ),

  verifyAuthentication: publicProcedure
    .input(passkeyAuthenticationVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const verification = await verifyPasskeyAuthentication({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        headers: ctx.headers,
      })

      ctx.session.userId = verification.userId
      await ctx.session.save()

      return verification
    }),
})
