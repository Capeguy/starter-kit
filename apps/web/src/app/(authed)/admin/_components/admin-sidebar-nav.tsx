'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarItem, SidebarRoot } from '@opengovsg/oui'
import { useQuery } from '@tanstack/react-query'
import {
  BiBell,
  BiEnvelope,
  BiFile,
  BiHistory,
  BiMenu,
  BiShield,
  BiToggleRight,
  BiUser,
  BiX,
} from 'react-icons/bi'

import type { CapabilityCode } from '~/lib/rbac'
import { Capability, hasCapability } from '~/lib/rbac'
import { useTRPC } from '~/trpc/react'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
  tooltip: string
  /** Optional capability gate — item is hidden when the user lacks it. */
  requires?: CapabilityCode
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/admin/users',
    label: 'Users',
    icon: <BiUser size={20} />,
    tooltip: 'Users',
  },
  {
    href: '/admin/invites',
    label: 'Invites',
    icon: <BiEnvelope size={20} />,
    tooltip: 'Invites',
    requires: Capability.UserInviteIssue,
  },
  {
    href: '/admin/audit',
    label: 'Audit log',
    icon: <BiHistory size={20} />,
    tooltip: 'Audit log',
  },
  {
    href: '/admin/notifications',
    label: 'Send notification',
    icon: <BiBell size={20} />,
    tooltip: 'Send notification',
  },
  {
    href: '/admin/files',
    label: 'All files',
    icon: <BiFile size={20} />,
    tooltip: 'All files',
  },
  {
    href: '/admin/roles',
    label: 'Roles & capabilities',
    icon: <BiShield size={20} />,
    tooltip: 'Roles & capabilities',
  },
  {
    href: '/admin/feature-flags',
    label: 'Feature flags',
    icon: <BiToggleRight size={20} />,
    tooltip: 'Feature flags',
    requires: Capability.FeatureFlagManage,
  },
] as const

export function AdminSidebarNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const trpc = useTRPC()
  // Source the user's capabilities for client-side gating. Server-side
  // enforcement still lives in `capabilityProcedure(...)` on the routers
  // — this is purely cosmetic so users without the capability don't see
  // a nav item that would 403 on click.
  const { data: me } = useQuery(trpc.me.get.queryOptions())
  const capabilities = me?.role.capabilities ?? []
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requires || hasCapability(capabilities, item.requires),
  )

  return (
    <>
      {/* Mobile hamburger — inline at the top of the page content, not
          floating. Hidden on md+ where the sidebar is always visible.
          `self-start` prevents the parent flex from stretching the
          button to full content height. */}
      <button
        type="button"
        className="border-base-divider-medium bg-base-canvas-default text-base-content-strong inline-flex w-fit items-center gap-2 self-start rounded-md border px-3 py-2 text-sm shadow-sm md:hidden"
        aria-label={mobileOpen ? 'Close admin menu' : 'Open admin menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <BiX size={18} /> : <BiMenu size={18} />}
        <span>{mobileOpen ? 'Close menu' : 'Admin menu'}</span>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar drawer (mobile) / static column (md+). The wrapping div
          owns the surface bg + shadow so the drawer is opaque against the
          backdrop; SidebarRoot itself sits transparently on top. */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 md:static md:z-auto md:w-auto',
          'bg-base-canvas-default border-base-divider-medium border-r shadow-xl md:shadow-none',
          'flex flex-col',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Admin navigation"
        role="navigation"
      >
        {/* Close button at top of drawer (mobile only). */}
        <div className="flex items-center justify-between px-3 pt-3 md:hidden">
          <span className="prose-label-sm text-base-content-medium">Admin</span>
          <button
            type="button"
            className="text-base-content-medium hover:text-base-content-strong inline-flex items-center justify-center rounded p-1"
            aria-label="Close admin menu"
            onClick={() => setMobileOpen(false)}
          >
            <BiX size={20} />
          </button>
        </div>
        <SidebarRoot className="h-full">
          {visibleItems.map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              startContent={item.icon}
              tooltip={item.tooltip}
              isSelected={
                pathname === item.href || pathname.startsWith(item.href + '/')
              }
              onPress={() => setMobileOpen(false)}
            >
              {item.label}
            </SidebarItem>
          ))}
        </SidebarRoot>
      </div>
    </>
  )
}
