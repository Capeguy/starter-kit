import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import z from 'zod'

import {
  finishResetWithToken,
  startResetWithToken,
} from '~/server/modules/admin/admin.service'
import {
  AuditAction,
  recordAuditEvent,
} from '~/server/modules/audit/audit.service'
import {
  finishInviteWithToken,
  startInviteWithToken,
} from '~/server/modules/auth/invite.service'
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

      await recordAuditEvent({
        userId: verification.userId,
        action: AuditAction.AuthPasskeyRegister,
        metadata: { name: input.name },
        headers: ctx.headers,
      })

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

      await recordAuditEvent({
        userId: verification.userId,
        action: AuditAction.AuthPasskeyAuthenticate,
        headers: ctx.headers,
      })

      return verification
    }),

  // Public reset flow gated by an admin-issued one-time token.
  resetWithToken: createTRPCRouter({
    start: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input, ctx }) =>
        startResetWithToken({ token: input.token, headers: ctx.headers }),
      ),

    finish: publicProcedure
      .input(
        z.object({
          token: z.string(),
          response: z.any() as z.ZodType<RegistrationResponseJSON>,
          expectedChallenge: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await finishResetWithToken({
          token: input.token,
          response: input.response,
          expectedChallenge: input.expectedChallenge,
          headers: ctx.headers,
        })

        ctx.session.userId = result.userId
        await ctx.session.save()

        await recordAuditEvent({
          userId: result.userId,
          action: AuditAction.AuthPasskeyResetClaim,
          metadata: { token: input.token },
          headers: ctx.headers,
        })

        return result
      }),
  }),

  // Public invite-claim flow gated by an admin-issued one-time token. Mirrors
  // resetWithToken but provisions a *new* user under the pre-assigned role
  // instead of replacing an existing user's passkey.
  inviteWithToken: createTRPCRouter({
    start: publicProcedure
      .input(
        z.object({
          token: z.string(),
          name: z.string().trim().min(1, 'Name is required').max(50),
        }),
      )
      .mutation(({ input, ctx }) =>
        startInviteWithToken({
          token: input.token,
          name: input.name,
          headers: ctx.headers,
        }),
      ),

    finish: publicProcedure
      .input(
        z.object({
          token: z.string(),
          name: z.string().trim().min(1, 'Name is required').max(50),
          response: z.any() as z.ZodType<RegistrationResponseJSON>,
          expectedChallenge: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await finishInviteWithToken({
          token: input.token,
          name: input.name,
          response: input.response,
          expectedChallenge: input.expectedChallenge,
          headers: ctx.headers,
        })

        ctx.session.userId = result.userId
        await ctx.session.save()

        await recordAuditEvent({
          userId: result.userId,
          action: AuditAction.UserInviteClaim,
          metadata: { inviteId: result.inviteId },
          headers: ctx.headers,
        })

        return result
      }),
  }),
})
