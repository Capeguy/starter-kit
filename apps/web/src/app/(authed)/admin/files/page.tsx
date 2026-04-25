import { Suspense } from 'react'

import { LoadingState } from '~/components/ui/loading-state'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { AdminFilesPage } from './_components/admin-files-page'

export default async function AdminFilesRoute() {
  await prefetch(trpc.admin.files.list.queryOptions({ q: null, limit: 50 }))

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <AdminFilesPage />
      </Suspense>
    </HydrateClient>
  )
}
