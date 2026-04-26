/**
 * Route-level loading UI for /admin. Mirrors the four-stat-tile grid in
 * `AdminLandingPage` — see `admin/page.tsx`.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonCard } from '~/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <PageHeader title="Admin" description="Operational view of the system." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
    </div>
  )
}
