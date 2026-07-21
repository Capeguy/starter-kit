import { ActivityPage } from './_components/activity-page'

import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function ActivityRoute() {
  await prefetch(trpc.audit.listMine.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <ActivityPage />
    </HydrateClient>
  )
}
