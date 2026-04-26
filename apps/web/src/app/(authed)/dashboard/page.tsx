import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { DashboardPage } from './_components/dashboard-page'

export default async function DashboardRoute() {
  await Promise.all([
    prefetch(trpc.me.get.queryOptions()),
    prefetch(trpc.apiToken.listMine.queryOptions()),
  ])

  return (
    <HydrateClient>
      <DashboardPage />
    </HydrateClient>
  )
}
