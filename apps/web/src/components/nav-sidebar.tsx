'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarItem, SidebarRoot } from '@opengovsg/oui'
import { useQuery } from '@tanstack/react-query'
import { BiMenu, BiX } from 'react-icons/bi'

import { ADMIN_NAV, findActiveItem, USER_NAV, visibleGroups } from '~/lib/nav'
import { useTRPC } from '~/trpc/react'

/**
 * Which nav root to render. Passed as a string key (not the NavRoot object
 * itself) because NavRoot contains icon ComponentTypes that fail to serialize
 * across the server-component → client-component boundary. The lookup table
 * lives inside this client module instead.
 */
type NavKey = 'admin' | 'user'

const NAVS = { admin: ADMIN_NAV, user: USER_NAV } as const

interface NavSidebarProps {
  navKey: NavKey
  /** Label for the mobile hamburger trigger AND the drawer header. */
  mobileLabel: string
}

/**
 * Shared sidebar that renders either ADMIN_NAV or USER_NAV. Used by both the
 * admin layout and the user dashboard layout. Capability-gates items via
 * `visibleGroups`, computes active state via `findActiveItem`, and provides a
 * mobile drawer that dims the navbar (z-[60] beats the OUI Navbar's z-40 so
 * the entire chrome darkens together).
 */
export function NavSidebar({ navKey, mobileLabel }: NavSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.me.get.queryOptions())
  const nav = NAVS[navKey]
  const groups = visibleGroups(nav.groups, me?.role.capabilities)
  const active = findActiveItem(pathname, nav)

  return (
    <>
      <button
        type="button"
        className="border-base-divider-medium bg-base-canvas-default text-base-content-strong inline-flex w-fit items-center gap-2 self-start rounded-md border px-3 py-2 text-sm shadow-sm md:hidden"
        aria-label={mobileOpen ? `Close ${mobileLabel}` : `Open ${mobileLabel}`}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <BiX size={18} /> : <BiMenu size={18} />}
        <span>{mobileOpen ? 'Close menu' : mobileLabel}</span>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={[
          'fixed inset-y-0 left-0 z-[60] w-64 md:static md:z-auto md:w-auto',
          'bg-base-canvas-default border-base-divider-medium border-r shadow-xl md:shadow-none',
          'flex flex-col',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label={`${nav.label} navigation`}
        role="navigation"
      >
        <div className="flex items-center justify-between px-3 pt-3 md:hidden">
          <span className="prose-label-sm text-base-content-medium">
            {nav.label}
          </span>
          <button
            type="button"
            className="text-base-content-medium hover:text-base-content-strong inline-flex items-center justify-center rounded p-1"
            aria-label={`Close ${mobileLabel}`}
            onClick={() => setMobileOpen(false)}
          >
            <BiX size={20} />
          </button>
        </div>
        <SidebarRoot className="h-full">
          {groups.map((group, gi) => (
            <div
              key={group.label}
              className={gi > 0 ? 'mt-2' : undefined}
              role="group"
              aria-label={group.label}
            >
              <div className="px-3 pt-3 pb-1">
                <span className="prose-caption-2 text-base-content-medium tracking-wide uppercase">
                  {group.label}
                </span>
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarItem
                    key={item.path}
                    href={item.path}
                    startContent={<Icon size={20} />}
                    tooltip={item.label}
                    isSelected={active?.item.path === item.path}
                    onPress={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </SidebarItem>
                )
              })}
            </div>
          ))}
        </SidebarRoot>
      </div>
    </>
  )
}
