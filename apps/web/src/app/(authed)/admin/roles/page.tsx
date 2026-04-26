import { Suspense } from 'react'

import { SkeletonTable } from '~/components/ui/skeleton'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { RolesListPage } from './_components/roles-list-page'

export default async function AdminRolesRoute() {
  await prefetch(trpc.admin.roles.list.queryOptions())

  return (
    <HydrateClient>
      <Suspense fallback={<SkeletonTable rows={4} cols={5} />}>
        <RolesListPage />
      </Suspense>
    </HydrateClient>
  )
}
