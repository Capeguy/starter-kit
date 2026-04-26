'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarItem, SidebarRoot } from '@opengovsg/oui'
import {
  BiBell,
  BiFile,
  BiHistory,
  BiMenu,
  BiShield,
  BiUser,
  BiX,
} from 'react-icons/bi'

const NAV_ITEMS = [
  {
    href: '/admin/users',
    label: 'Users',
    icon: <BiUser size={20} />,
    tooltip: 'Users',
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
] as const

export function AdminSidebarNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger — inline at the top of the page content, not
          floating. Hidden on md+ where the sidebar is always visible. */}
      <button
        type="button"
        className="border-base-divider-medium bg-base-canvas-default text-base-content-strong inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm md:hidden"
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
          {NAV_ITEMS.map((item) => (
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
