import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { AuditLogPage } from './_components/audit-log-page'

export default async function AdminAuditRoute() {
  await prefetch(trpc.audit.list.queryOptions({ limit: 50 }))

  return (
    <HydrateClient>
      <AuditLogPage />
    </HydrateClient>
  )
}
