/**
 * Personal-API-token-gated `GET /api/v1/me` — returns the calling user's
 * identity, role, and effective capabilities. Same-origin scope
 * (no CORS headers).
 */
import { db } from '@acme/db'

import { authenticateApiRequest } from '~/lib/api-auth'

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { id: true, name: true, capabilities: true } },
    },
  })

  if (!user) {
    // Token verified but the user has been deleted in the same request —
    // verifyAndTouch's user check would normally catch this, but guard
    // against the race anyway.
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  return Response.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: {
      id: user.role.id,
      name: user.role.name,
      capabilities: user.role.capabilities,
    },
  })
}
