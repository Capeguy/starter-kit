/**
 * Route-level loading UI for /dashboard. Renders a header skeleton plus two
 * Card-shaped skeletons that mirror the Profile + Summary cards on the
 * Overview tab — see `dashboard/_components/dashboard-page.tsx`.
 */
import { PageHeader } from '~/components/ui/page-header'
import { SkeletonCard, SkeletonText } from '~/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonText lines={1} />
    </div>
  )
}
