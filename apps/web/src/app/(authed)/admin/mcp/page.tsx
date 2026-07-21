import { McpSettingsPage } from './_components/mcp-settings-page'

import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function McpRoute() {
  await prefetch(trpc.admin.mcp.getSettings.queryOptions())
  return (
    <HydrateClient>
      <McpSettingsPage />
    </HydrateClient>
  )
}
