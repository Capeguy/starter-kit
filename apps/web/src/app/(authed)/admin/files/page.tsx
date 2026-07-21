import { Suspense } from 'react'

import { AdminFilesPage } from './_components/admin-files-page'

import { SkeletonTable } from '~/components/ui/skeleton'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'

export default async function AdminFilesRoute() {
  await prefetch(trpc.admin.files.list.queryOptions({ q: null, limit: 50 }))

  return (
    <HydrateClient>
      <Suspense fallback={<SkeletonTable rows={6} cols={5} />}>
        <AdminFilesPage />
      </Suspense>
    </HydrateClient>
  )
}
