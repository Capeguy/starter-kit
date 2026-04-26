/**
 * Personal-API-token-gated `GET /api/v1/files?cursor=&limit=` — returns the
 * caller's own File rows. Delegates to `fileService.listMyFiles` so this
 * route stays a thin transport adapter.
 */
import { authenticateApiRequest } from '~/lib/api-auth'
import { listMyFiles } from '~/server/modules/file/file.service'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

const parseLimit = (raw: string | null): number => {
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = parseLimit(url.searchParams.get('limit'))

  const result = await listMyFiles({
    userId: auth.userId,
    cursor,
    limit,
  })

  return Response.json(result)
}
