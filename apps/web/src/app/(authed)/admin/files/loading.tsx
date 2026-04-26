/**
 * Route-level loading UI for /admin/files. Mirrors the layout of
 * `AdminFilesPage`: header + search field + table.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonTable } from '~/components/ui/skeleton'

export default function AdminFilesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <PageHeader
        title="All files"
        description="Files uploaded by all users."
      />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  )
}
