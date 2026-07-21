import { SettingsPage } from './_components/settings-page'

import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function SettingsRoute() {
  await prefetch(trpc.apiToken.listMine.queryOptions())

  return (
    <HydrateClient>
      <SettingsPage />
    </HydrateClient>
  )
}
