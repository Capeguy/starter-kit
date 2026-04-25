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
      {/* Mobile hamburger button — visible below md */}
      <button
        type="button"
        className="border-base-divider-medium bg-base-canvas-default fixed top-20 left-4 z-40 flex items-center justify-center rounded-md border p-2 shadow-sm md:hidden"
        aria-label={mobileOpen ? 'Close admin menu' : 'Open admin menu'}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <BiX size={20} /> : <BiMenu size={20} />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open, always visible on md+ */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 md:static md:z-auto',
          'flex flex-col',
          'transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Admin navigation"
        role="navigation"
      >
        <SidebarRoot className="h-full pt-16 md:pt-0">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.href}
              href={item.href}
              startContent={item.icon}
              tooltip={item.tooltip}
              isSelected={
                pathname === item.href || pathname.startsWith(item.href + '/')
              }
            >
              {item.label}
            </SidebarItem>
          ))}
        </SidebarRoot>
      </div>
    </>
  )
}
