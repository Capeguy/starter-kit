import { Suspense } from 'react'

import { SkeletonTable } from '~/components/ui/skeleton'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { UsersListPage } from './_components/users-list-page'

export default async function AdminUsersRoute() {
  // Match the client component's query key exactly — including q:null —
  // otherwise the client refetches on mount.
  await prefetch(trpc.admin.users.list.queryOptions({ q: null, limit: 50 }))

  return (
    <HydrateClient>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <UsersListPage />
      </Suspense>
    </HydrateClient>
  )
}
