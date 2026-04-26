import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { DashboardPage } from './_components/dashboard-page'

export default async function DashboardRoute() {
  await Promise.all([
    prefetch(trpc.me.get.queryOptions()),
    prefetch(trpc.file.listMine.queryOptions({ limit: 5 })),
    prefetch(trpc.audit.listMine.queryOptions({ limit: 5 })),
  ])

  return (
    <HydrateClient>
      <DashboardPage />
    </HydrateClient>
  )
}
