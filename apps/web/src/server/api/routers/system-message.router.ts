import { getSystemMessage } from '~/server/modules/system-message/system-message.service'
import { createTRPCRouter, protectedProcedure } from '../trpc'

/**
 * Public read of the singleton system message banner. Returns `enabled`,
 * `message`, and `severity`; the banner component renders nothing when
 * `enabled === false`. Authed-only because the banner only shows on authed
 * pages — exposing it to unauthenticated callers would needlessly leak
 * the configured message.
 */
export const systemMessageRouter = createTRPCRouter({
  get: protectedProcedure.query(async () => {
    const state = await getSystemMessage()
    return {
      enabled: state.enabled,
      message: state.message,
      severity: state.severity,
    }
  }),
})
