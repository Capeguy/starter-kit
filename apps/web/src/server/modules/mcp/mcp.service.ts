/**
 * MCP server settings & tool registry.
 *
 * The MCP server at `/api/mcp` is **opt-in**: admins must explicitly turn
 * `mcp.enabled` on. While off, the route returns 404 — same surface a
 * non-existent endpoint would present, no leaking of "MCP is here but
 * disabled" to unauthenticated probes.
 *
 * Per-tool toggles let admins disable individual tools without taking the
 * whole server down. Tools default-enabled when no flag row exists, so
 * adding a new tool to MCP_TOOLS doesn't require a migration or seed.
 *
 * Storage piggybacks on the existing FeatureFlag table to avoid introducing
 * a generic settings model just for two booleans.
 */
import { db } from '@acme/db'

export interface McpToolDefinition {
  name: string
  description: string
}

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: 'get_my_profile',
    description: "Get the authenticated user's profile",
  },
  {
    name: 'list_my_files',
    description: 'List files uploaded by the authenticated user',
  },
  {
    name: 'list_my_notifications',
    description: "List the authenticated user's notifications",
  },
] as const

export type McpToolName = (typeof MCP_TOOLS)[number]['name']

const KEY_ENABLED = 'mcp.enabled'
const toolKey = (name: string) => `mcp.tool.${name}`

const ENABLED_FLAG_NAME = 'MCP server'
const ENABLED_FLAG_DESC =
  'Whether the MCP JSON-RPC server at /api/mcp accepts requests. When off, the endpoint returns 404.'

/** True iff the master MCP switch is on. Defaults to false (no row). */
export const isMcpEnabled = async (): Promise<boolean> => {
  const row = await db.featureFlag.findUnique({
    where: { key: KEY_ENABLED },
    select: { enabled: true },
  })
  return row?.enabled ?? false
}

/**
 * True iff a specific tool is enabled. Tools are default-enabled when no
 * flag row exists, so this only returns false when an admin has explicitly
 * turned the tool off in the settings UI.
 */
export const isToolEnabled = async (name: string): Promise<boolean> => {
  const row = await db.featureFlag.findUnique({
    where: { key: toolKey(name) },
    select: { enabled: true },
  })
  return row?.enabled ?? true
}

export interface McpSettings {
  enabled: boolean
  tools: {
    name: string
    description: string
    enabled: boolean
  }[]
}

export const getMcpSettings = async (): Promise<McpSettings> => {
  const enabled = await isMcpEnabled()
  const rows = await db.featureFlag.findMany({
    where: { key: { in: MCP_TOOLS.map((t) => toolKey(t.name)) } },
    select: { key: true, enabled: true },
  })
  const enabledByKey = new Map(rows.map((r) => [r.key, r.enabled] as const))
  return {
    enabled,
    tools: MCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      // Default to enabled when no row exists.
      enabled: enabledByKey.get(toolKey(t.name)) ?? true,
    })),
  }
}

export const setMcpEnabled = async (enabled: boolean): Promise<void> => {
  await db.featureFlag.upsert({
    where: { key: KEY_ENABLED },
    update: { enabled },
    create: {
      key: KEY_ENABLED,
      enabled,
      name: ENABLED_FLAG_NAME,
      description: ENABLED_FLAG_DESC,
      rolloutPercent: 100,
      allowedUserIds: [],
    },
  })
}

export const setToolEnabled = async (
  name: string,
  enabled: boolean,
): Promise<void> => {
  const tool = MCP_TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`Unknown MCP tool: ${name}`)
  await db.featureFlag.upsert({
    where: { key: toolKey(name) },
    update: { enabled },
    create: {
      key: toolKey(name),
      enabled,
      name: `MCP tool: ${name}`,
      description: tool.description,
      rolloutPercent: 100,
      allowedUserIds: [],
    },
  })
}
