import { Suspense } from 'react'

import { SkeletonTable } from '~/components/ui/skeleton'
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
      <Suspense fallback={<SkeletonTable rows={6} cols={4} />}>
        <AuditLogPage />
      </Suspense>
    </HydrateClient>
  )
}
