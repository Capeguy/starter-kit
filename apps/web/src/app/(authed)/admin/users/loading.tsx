/**
 * Route-level loading UI for /admin/users. Mirrors the layout of
 * `UsersListPage`: header + search field + table.
 */
import { PageHeader } from '~/components/ui/page-header'
import { Skeleton, SkeletonTable } from '~/components/ui/skeleton'

export default function AdminUsersLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Users"
        description="Manage accounts, change roles, and reset passkeys for locked-out users."
      />
      {/* Search field stand-in (label + input) */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  )
}
