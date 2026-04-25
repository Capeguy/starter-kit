import { Suspense } from 'react'

import { LoadingState } from '~/components/ui/loading-state'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { AuditLogPage } from './_components/audit-log-page'

export default async function AdminAuditRoute() {
  await prefetch(
    trpc.audit.list.queryOptions({
      limit: 50,
      action: null,
      userId: null,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <AuditLogPage />
      </Suspense>
    </HydrateClient>
  )
}
