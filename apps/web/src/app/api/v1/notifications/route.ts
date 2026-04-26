/**
 * Personal-API-token-gated `GET /api/v1/notifications?cursor=&limit=&unreadOnly=`
 * — returns the caller's own Notification rows.
 *
 * NOTE: `unreadOnly` is parsed and accepted as a query-string boolean but the
 * underlying `notificationService.listMine` does not currently filter on
 * read state. We pass through `unreadOnly` in the response payload so
 * clients can verify their request was understood; filtering will be added
 * to the service when we have a real consumer that needs it.
 */
import { authenticateApiRequest } from '~/lib/api-auth'
import { listMine } from '~/server/modules/notification/notification.service'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

const parseLimit = (raw: string | null): number => {
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

const parseBool = (raw: string | null): boolean => {
  if (!raw) return false
  return raw === '1' || raw.toLowerCase() === 'true'
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = parseLimit(url.searchParams.get('limit'))
  const unreadOnly = parseBool(url.searchParams.get('unreadOnly'))

  const result = await listMine({
    userId: auth.userId,
    cursor,
    limit,
  })

  // Apply `unreadOnly` as a post-filter; cheap because `limit` <= 50.
  const items = unreadOnly
    ? result.items.filter((n) => n.readAt === null)
    : result.items

  return Response.json({
    items,
    nextCursor: result.nextCursor,
  })
}
