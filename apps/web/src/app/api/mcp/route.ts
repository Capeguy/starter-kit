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
 * Default-disabled: when an admin hasn't turned on `mcp.enabled` in
 * /admin/mcp, every method returns 404 — same surface a non-existent
 * route would present. Per-tool toggles further hide individual tools
 * from `tools/list` and reject `tools/call`.
 *
 * We deliberately don't pull in `@modelcontextprotocol/sdk` — it targets
 * stdio/SSE transports and would need a server adapter we don't need.
 * JSON-RPC over a single POST is ~80 lines.
 */
import { db } from '@acme/db'

import type { AuthenticatedRequestUser } from '~/lib/api-auth'
import { authenticateApiRequest } from '~/lib/api-auth'
import { listMyFiles } from '~/server/modules/file/file.service'
import {
  isMcpEnabled,
  isToolEnabled,
  MCP_TOOLS,
} from '~/server/modules/mcp/mcp.service'
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

// Tool registry. Defines `inputSchema` for `tools/list`; the registry
// itself (names/descriptions) lives in mcp.service.ts so the admin
// settings page can iterate it without depending on this route file.
const TOOL_INPUT_SCHEMAS: Record<string, unknown> = {
  get_my_profile: { type: 'object', properties: {}, required: [] },
  list_my_files: {
    type: 'object',
    properties: { limit: { type: 'integer', maximum: 50 } },
  },
  list_my_notifications: {
    type: 'object',
    properties: {
      limit: { type: 'integer', maximum: 50 },
      unreadOnly: { type: 'boolean' },
    },
  },
}

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

const notFound = () => new Response(null, { status: 404 })

// GET probes (curl, link previewers, etc.) get the same 404 as POST when
// MCP is off, so the endpoint indistinguishably "doesn't exist".
export async function GET() {
  if (!(await isMcpEnabled())) return notFound()
  return new Response(null, { status: 405 })
}

export async function POST(request: Request) {
  if (!(await isMcpEnabled())) {
    return notFound()
  }

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

    case 'tools/list': {
      // Filter the static registry by the per-tool flag so admins can
      // hide individual tools without restarting / redeploying.
      const enabled = await Promise.all(
        MCP_TOOLS.map(async (t) => ({
          tool: t,
          on: await isToolEnabled(t.name),
        })),
      )
      const tools = enabled
        .filter((e) => e.on)
        .map((e) => ({
          name: e.tool.name,
          description: e.tool.description,
          inputSchema: TOOL_INPUT_SCHEMAS[e.tool.name] ?? {
            type: 'object',
            properties: {},
          },
        }))
      return ok(id, { tools })
    }

    case 'tools/call': {
      const p = (params ?? {}) as { name?: unknown; arguments?: unknown }
      const toolName = typeof p.name === 'string' ? p.name : null
      const toolArgs =
        p.arguments && typeof p.arguments === 'object'
          ? (p.arguments as Record<string, unknown>)
          : {}
      if (!toolName || !MCP_TOOLS.some((t) => t.name === toolName)) {
        return err(id, -32601, `Method not found: ${toolName ?? '(missing)'}`)
      }
      // Admin-disabled tools look indistinguishable from non-existent
      // tools to the client (same -32601), so callers can't probe which
      // tools have been turned off.
      if (!(await isToolEnabled(toolName))) {
        return err(id, -32601, `Method not found: ${toolName}`)
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
