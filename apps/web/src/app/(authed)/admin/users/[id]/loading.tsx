/**
 * Route-level loading UI for /admin/users/[id]. Mirrors the layout of
 * `UserDetailPage`: breadcrumbs row + page header + tabs strip + profile
 * card.
 */
import { Skeleton, SkeletonCard } from '~/components/ui/skeleton'

export default function UserDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Breadcrumbs row stand-in */}
      <Skeleton className="h-4 w-64" />
      {/* PageHeader stand-in (title + description) */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {/* Tabs strip stand-in */}
      <div className="flex gap-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
      {/* Profile card */}
      <SkeletonCard lines={4} />
    </div>
  )
}
