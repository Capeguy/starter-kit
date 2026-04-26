import z from 'zod'

import {
  isEnabled,
  isEnabledBulk,
} from '~/server/modules/feature-flag/feature-flag.service'
import { createTRPCRouter, protectedProcedure } from '../trpc'

/**
 * Client-facing flag evaluation. Both procedures are `protectedProcedure` —
 * authenticated users can ask "am I in this flag?" but admin CRUD lives
 * under `admin.featureFlags` (capability-gated, see admin.router.ts).
 *
 * Note: we intentionally do NOT 404 on unknown keys. The intended call site
 * is `useFeatureFlag('some.key')` in arbitrary client components, and
 * surfacing a 404 there would be a footgun (any flag key the admin hasn't
 * defined yet would crash the page rather than safely defaulting to false).
 */
export const featureFlagRouter = createTRPCRouter({
  evaluate: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1).max(64),
      }),
    )
    .query(async ({ input, ctx }) => ({
      enabled: await isEnabled({ key: input.key, userId: ctx.user.id }),
    })),

  evaluateBulk: protectedProcedure
    .input(
      z.object({
        keys: z.array(z.string().min(1).max(64)).max(50),
      }),
    )
    .query(async ({ input, ctx }) => ({
      results: await isEnabledBulk({
        keys: input.keys,
        userId: ctx.user.id,
      }),
    })),
})
