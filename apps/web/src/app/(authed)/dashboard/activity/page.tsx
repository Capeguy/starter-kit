import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { ActivityPage } from './_components/activity-page'

export default async function ActivityRoute() {
  await prefetch(trpc.audit.listMine.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <ActivityPage />
    </HydrateClient>
  )
}
