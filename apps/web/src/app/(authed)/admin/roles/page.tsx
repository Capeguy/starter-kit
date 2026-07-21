import { Suspense } from 'react'

import { RolesListPage } from './_components/roles-list-page'

import { SkeletonTable } from '~/components/ui/skeleton'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'

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
