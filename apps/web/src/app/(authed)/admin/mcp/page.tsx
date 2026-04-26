import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { McpSettingsPage } from './_components/mcp-settings-page'

export default async function McpRoute() {
  await prefetch(trpc.admin.mcp.getSettings.queryOptions())
  return (
    <HydrateClient>
      <McpSettingsPage />
    </HydrateClient>
  )
}
