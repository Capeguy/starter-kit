import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { DashboardPage } from './_components/dashboard-page'

export default async function DashboardRoute() {
  await prefetch(trpc.me.get.queryOptions())

  return (
    <HydrateClient>
      <DashboardPage />
    </HydrateClient>
  )
}
