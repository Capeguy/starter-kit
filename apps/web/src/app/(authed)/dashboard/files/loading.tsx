/**
 * Route-level loading UI for /dashboard/files. Mirrors the layout of
 * `MyFilesPage`: header + upload Infobox + table.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonTable } from '~/components/ui/skeleton'

export default function MyFilesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <Skeleton className="h-4 w-40" />
      <PageHeader title="My files" />
      {/* upload-box stand-in */}
      <Skeleton className="h-16 w-full rounded-md" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  )
}
