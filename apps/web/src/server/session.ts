import type { SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'

import { env } from '~/env'

export interface SessionData {
  userId?: string
  /**
   * When set, the session is in impersonation mode: `userId` is the user being
   * impersonated; `impersonatedById` is the original admin who started it. All
   * tRPC ctx.user values reflect the IMPERSONATED user (so admin sees exactly
   * what the user sees). The original admin id is held here for the revert
   * path (`auth.impersonation.stop`).
   */
  impersonatedById?: string
  /**
   * True when this session was authenticated via an `Authorization: Bearer
   * <token>` header rather than the iron-session cookie. Set in
   * `createTRPCContext` and on the synthetic Bearer session attached to
   * REST/MCP routes; downstream middleware uses it to skip impersonation
   * stop/start guards that don't make sense for token-auth callers.
   */
  viaApiToken?: boolean
}

export const sessionOptions: SessionOptions = {
  password: {
    '1': env.SESSION_SECRET,
    // When you provide multiple passwords then all of them will be used to decrypt the cookie.
    // But only the most recent (= highest key, e.g. 2) password will be used to encrypt the cookie.
    // This allows password rotation.
  },
  cookieName: 'auth.session-token',
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    secure: env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test',
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
