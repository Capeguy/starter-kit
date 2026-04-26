/**
 * Bearer-token auth helper for non-tRPC HTTP routes (REST `/api/v1/*` and
 * MCP `/api/mcp`). Wraps `apiTokenService.verifyAndTouch` so route handlers
 * stay short.
 *
 * Returns `{ userId, capabilities, role }` on success, `null` on any
 * failure (no/invalid header, unknown/expired/revoked token, missing user).
 * Intentionally does not throw — callers map null to a 401 response.
 *
 * Cookie-session fallback: this helper does NOT read the iron-session
 * cookie. The /api/v1 + /api/mcp surfaces are intentionally Bearer-only
 * to keep token-issuance auditable and to avoid CSRF concerns on
 * cross-origin curl/browser-extension traffic.
 */
import { verifyAndTouch } from '~/server/modules/api-token/api-token.service'
import { extractBearerToken } from '~/server/modules/api-token/bearer-header'

export interface AuthenticatedRequestUser {
  userId: string
  capabilities: readonly string[]
  role: { id: string; name: string }
}

export const authenticateApiRequest = async (
  request: Request,
): Promise<AuthenticatedRequestUser | null> => {
  const token = extractBearerToken(request.headers)
  if (!token) return null
  const verified = await verifyAndTouch(token)
  if (!verified) return null
  return {
    userId: verified.userId,
    capabilities: verified.capabilities,
    role: verified.role,
  }
}
