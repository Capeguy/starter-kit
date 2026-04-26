/**
 * Minimal MCP (Model Context Protocol) server over HTTP.
 *
 * Implements a strict subset of https://modelcontextprotocol.io/specification:
 * - JSON-RPC 2.0 dispatch
 * - `initialize`, `tools/list`, `tools/call`
 * - Three tools backed by existing services: `get_my_profile`,
 *   `list_my_files`, `list_my_notifications`
 *
 * Auth is Bearer-token only (same surface as `/api/v1/*`). Same-origin
 * scope; no CORS headers.
 *
 * We deliberately don't pull in `@modelcontextprotocol/sdk` — it targets
 * stdio/SSE transports and would need a server adapter we don't need.
 * JSON-RPC over a single POST is ~80 lines.
 */
import { db } from '@acme/db'

import type { AuthenticatedRequestUser } from '~/lib/api-auth'
import { authenticateApiRequest } from '~/lib/api-auth'
import { listMyFiles } from '~/server/modules/file/file.service'
import { listMine as listMyNotifications } from '~/server/modules/notification/notification.service'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = { name: 'vibe-stack-mcp', version: '0.1.0' } as const

interface JsonRpcRequest {
  jsonrpc?: '2.0'
  id?: number | string | null
  method?: string
  params?: unknown
}

const ok = (id: JsonRpcRequest['id'] | undefined, result: unknown) =>
  Response.json({ jsonrpc: '2.0', id: id ?? null, result })

const err = (
  id: JsonRpcRequest['id'] | undefined,
  code: number,
  message: string,
  status = 200,
) =>
  Response.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    { status },
  )

// MCP tool registry. Keep the inputSchemas in sync with the dispatcher's
// argument parsing below.
const TOOLS = [
  {
    name: 'get_my_profile',
    description: "Get the authenticated user's profile",
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_my_files',
    description: 'List files uploaded by the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', maximum: 50 },
      },
    },
  },
  {
    name: 'list_my_notifications',
    description: "List the authenticated user's notifications",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', maximum: 50 },
        unreadOnly: { type: 'boolean' },
      },
    },
  },
] as const

const clampLimit = (raw: unknown): number => {
  const n = typeof raw === 'number' ? raw : 20
  if (!Number.isFinite(n) || n <= 0) return 20
  return Math.min(50, Math.floor(n))
}

const dispatchTool = async (
  name: string,
  args: Record<string, unknown>,
  auth: AuthenticatedRequestUser,
): Promise<unknown> => {
  switch (name) {
    case 'get_my_profile': {
      const user = await db.user.findUnique({
        where: { id: auth.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { id: true, name: true, capabilities: true } },
        },
      })
      if (!user) throw new Error('user not found')
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }
    case 'list_my_files': {
      const limit = clampLimit(args.limit)
      return listMyFiles({ userId: auth.userId, cursor: null, limit })
    }
    case 'list_my_notifications': {
      const limit = clampLimit(args.limit)
      const unreadOnly = Boolean(args.unreadOnly)
      const result = await listMyNotifications({
        userId: auth.userId,
        cursor: null,
        limit,
      })
      const items = unreadOnly
        ? result.items.filter((n) => n.readAt === null)
        : result.items
      return { items, nextCursor: result.nextCursor }
    }
    default:
      // Defensive: caller already validated the name against TOOLS, but
      // signal "unknown tool" via the same -32601 path the dispatcher uses.
      throw new Error(`unknown tool: ${name}`)
  }
}

export async function POST(request: Request) {
  // Auth is checked first — if the request is unauthenticated we never
  // even peek at the body, which keeps the MCP-error surface uniform with
  // the REST routes.
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: JsonRpcRequest
  try {
    body = (await request.json()) as JsonRpcRequest
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { method, params, id } = body
  if (typeof method !== 'string') {
    return err(id, -32600, 'Invalid Request: method must be a string')
  }

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })

    case 'tools/list':
      return ok(id, { tools: TOOLS })

    case 'tools/call': {
      const p = (params ?? {}) as { name?: unknown; arguments?: unknown }
      const toolName = typeof p.name === 'string' ? p.name : null
      const toolArgs =
        p.arguments && typeof p.arguments === 'object'
          ? (p.arguments as Record<string, unknown>)
          : {}
      if (!toolName || !TOOLS.some((t) => t.name === toolName)) {
        return err(id, -32601, `Method not found: ${toolName ?? '(missing)'}`)
      }
      try {
        const result = await dispatchTool(toolName, toolArgs, auth)
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })
      } catch (e) {
        return err(
          id,
          -32603,
          `Internal error: ${e instanceof Error ? e.message : 'unknown'}`,
        )
      }
    }

    default:
      return err(id, -32601, `Method not found: ${method}`)
  }
}
