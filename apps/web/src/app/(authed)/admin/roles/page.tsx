import { Suspense } from 'react'

import { LoadingState } from '~/components/ui/loading-state'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { RolesListPage } from './_components/roles-list-page'

export default async function AdminRolesRoute() {
  await prefetch(trpc.admin.roles.list.queryOptions())

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <RolesListPage />
      </Suspense>
    </HydrateClient>
  )
}
