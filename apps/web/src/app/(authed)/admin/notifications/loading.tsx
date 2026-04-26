/**
 * Route-level loading UI for /admin/notifications. Mirrors the layout of
 * `BroadcastForm`: stacked field skeletons inside a max-w-xl form column.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton } from '~/components/ui/skeleton'

const FieldSkeleton = ({ width = 'w-32' }: { width?: string }) => (
  <div className="flex flex-col gap-1.5">
    <Skeleton className={`h-4 ${width}`} />
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
)

export default function AdminNotificationsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Broadcast notification"
        description="Send an in-app notification to all users, all admins, or a single user."
      />
      <div className="flex max-w-xl flex-col gap-4">
        <FieldSkeleton width="w-24" />
        <FieldSkeleton width="w-12" />
        <FieldSkeleton width="w-12" />
        <FieldSkeleton width="w-20" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  )
}
