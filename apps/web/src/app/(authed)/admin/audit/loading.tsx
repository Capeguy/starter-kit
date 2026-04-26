/**
 * Route-level loading UI for /admin/audit. Mirrors the layout of
 * `AuditLogPage`: header + two filter fields + Clear button + table.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonTable } from '~/components/ui/skeleton'

export default function AdminAuditLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Security-relevant events: passkey registrations, authentications, resets, role changes, and account deletions."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="flex items-end">
          <Skeleton className="h-10 w-20 rounded-md" />
        </div>
      </div>
      <SkeletonTable rows={6} cols={4} />
    </div>
  )
}
