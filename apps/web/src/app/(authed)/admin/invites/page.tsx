import { Suspense } from 'react'

import { LoadingState } from '~/components/ui/loading-state'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { InvitesPage } from './_components/invites-page'

export default async function AdminInvitesRoute() {
  await Promise.all([
    prefetch(trpc.admin.invites.list.queryOptions({ limit: 50 })),
    prefetch(trpc.admin.roles.list.queryOptions()),
  ])

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <InvitesPage />
      </Suspense>
    </HydrateClient>
  )
}
