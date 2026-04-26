import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { SettingsPage } from './_components/settings-page'

export default async function SettingsRoute() {
  await prefetch(trpc.apiToken.listMine.queryOptions())

  return (
    <HydrateClient>
      <SettingsPage />
    </HydrateClient>
  )
}
