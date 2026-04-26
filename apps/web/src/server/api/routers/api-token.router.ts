import z from 'zod'

import {
  issue,
  listMine,
  revoke,
} from '~/server/modules/api-token/api-token.service'
import {
  AuditAction,
  recordAuditEvent,
} from '~/server/modules/audit/audit.service'
import { createTRPCRouter, protectedProcedure } from '../trpc'

const issueInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(120, 'Name is too long.'),
  /**
   * Token lifetime. Match the spec's allowed presets — short list keeps the
   * UI simple and prevents users from accidentally minting "1 minute" or
   * "10 years" tokens. `null` = no expiry.
   */
  expiresInDays: z
    .union([z.literal(7), z.literal(30), z.literal(90)])
    .nullable(),
})

const revokeInput = z.object({ id: z.string().min(1) })

export const apiTokenRouter = createTRPCRouter({
  issue: protectedProcedure
    .input(issueInput)
    .mutation(async ({ input, ctx }) => {
      const result = await issue({
        userId: ctx.user.id,
        name: input.name,
        expiresInDays: input.expiresInDays,
      })

      await recordAuditEvent({
        userId: ctx.user.id,
        action: AuditAction.ApiTokenIssue,
        // Don't log the plaintext or the hash — only the human-readable
        // name + which token (id) was issued. The id is enough to
        // cross-reference an audit row to a row in the token table.
        metadata: {
          tokenId: result.id,
          tokenName: input.name,
          expiresInDays: input.expiresInDays,
        },
        headers: ctx.headers,
      })

      return {
        plaintext: result.plaintext,
        prefix: result.prefix,
        expiresAt: result.expiresAt,
      }
    }),

  listMine: protectedProcedure.query(({ ctx }) =>
    listMine({ userId: ctx.user.id }),
  ),

  revoke: protectedProcedure
    .input(revokeInput)
    .mutation(async ({ input, ctx }) => {
      // Look up the token first so we can include its name in the audit
      // event (and so we can early-out if it doesn't belong to the caller
      // — the service is owner-scoped via updateMany, so we'd no-op
      // anyway, but the audit row should reflect the user's intent
      // accurately).
      const existing = await listMine({ userId: ctx.user.id })
      const target = existing.find((t) => t.id === input.id)

      await revoke({ id: input.id, userId: ctx.user.id })

      if (target) {
        await recordAuditEvent({
          userId: ctx.user.id,
          action: AuditAction.ApiTokenRevoke,
          metadata: {
            tokenId: input.id,
            tokenName: target.name,
          },
          headers: ctx.headers,
        })
      }

      return undefined
    }),
})
