import type { DynamicLayoutProps } from '~/types/nextjs'
import { NavSidebar } from '~/components/nav-sidebar'
import { USER_NAV } from '~/lib/nav'

export default function DashboardLayout({ children }: DynamicLayoutProps) {
  // Session check is in the parent (authed)/layout. The dashboard is open to
  // every authenticated user regardless of role, so no extra capability gate
  // is needed here.
  return (
    <div className="flex flex-1 flex-col gap-3 md:flex-row md:gap-0">
      <NavSidebar nav={USER_NAV} mobileLabel="Menu" />
      <div className="min-w-0 flex-1 md:pl-4">{children}</div>
    </div>
  )
}
