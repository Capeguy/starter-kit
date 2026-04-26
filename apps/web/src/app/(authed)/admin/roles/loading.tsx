/**
 * Route-level loading UI for /admin/roles. Mirrors the layout of
 * `RolesListPage`: header + "New role" button stand-in + table.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonTable } from '~/components/ui/skeleton'

export default function AdminRolesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <PageHeader
        title="Roles"
        description="Define which users can do what."
        actions={<Skeleton className="h-10 w-24 rounded-md" />}
      />
      <SkeletonTable rows={4} cols={5} />
    </div>
  )
}
