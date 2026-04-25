import { Suspense } from 'react'

import { LoadingState } from '~/components/ui/loading-state'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { UsersListPage } from './_components/users-list-page'

export default async function AdminUsersRoute() {
  // Match the client component's query key exactly — including q:null —
  // otherwise the client refetches on mount.
  await prefetch(trpc.admin.users.list.queryOptions({ q: null, limit: 50 }))

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <UsersListPage />
      </Suspense>
    </HydrateClient>
  )
}
