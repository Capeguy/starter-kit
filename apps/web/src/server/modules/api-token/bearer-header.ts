/**
 * Extracts the Bearer token from a request's `Authorization` header.
 *
 * Returns null unless:
 * - The header exists.
 * - It starts with `Bearer ` (case-insensitive).
 * - The token portion is non-empty AND begins with the personal-access-token
 *   namespace `vibe_pat_`. Anything else is silently ignored so that a stray
 *   third-party Bearer header (e.g. from a misconfigured proxy or browser
 *   extension) doesn't get fed into the token-hash lookup.
 */
const TOKEN_NAMESPACE = 'vibe_pat_'

export const extractBearerToken = (headers: Headers): string | null => {
  const authHeader = headers.get('authorization')
  if (!authHeader) return null
  const [scheme, ...rest] = authHeader.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null
  const token = rest.join(' ').trim()
  if (!token) return null
  if (!token.startsWith(TOKEN_NAMESPACE)) return null
  return token
}
