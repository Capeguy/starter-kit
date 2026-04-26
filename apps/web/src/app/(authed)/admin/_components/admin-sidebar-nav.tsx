'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarItem, SidebarRoot } from '@opengovsg/oui'
import { useQuery } from '@tanstack/react-query'
import { BiMenu, BiX } from 'react-icons/bi'

import { ADMIN_NAV, findActiveItem, visibleGroups } from '~/lib/nav'
import { useTRPC } from '~/trpc/react'

export function AdminSidebarNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const trpc = useTRPC()
  // Source the user's capabilities for client-side gating. Server-side
  // enforcement still lives in `capabilityProcedure(...)` on the routers
  // — this is purely cosmetic so users without the capability don't see
  // a nav item that would 403 on click.
  const { data: me } = useQuery(trpc.me.get.queryOptions())
  const groups = visibleGroups(ADMIN_NAV.groups, me?.role.capabilities)
  const active = findActiveItem(pathname, ADMIN_NAV)

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

      {/* Mobile backdrop. z-[60] sits above the OUI Navbar (which uses
          z-40) so the navbar gets darkened too — otherwise it stayed
          fully bright while everything below dimmed, which felt broken
          in both light and dark mode. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar drawer (mobile) / static column (md+). The wrapping div
          owns the surface bg + shadow so the drawer is opaque against the
          backdrop; SidebarRoot itself sits transparently on top. The
          drawer renders AFTER the backdrop in the DOM so it stacks on
          top at the same z-index. */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-[60] w-64 md:static md:z-auto md:w-auto',
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
          {groups.map((group, gi) => (
            <div
              key={group.label}
              className={gi > 0 ? 'mt-2' : undefined}
              role="group"
              aria-label={group.label}
            >
              {/* Section header. Collapses to icon-only at md when the
                  Sidebar is in collapsed mode (the OUI Sidebar handles
                  its own collapse styling; we hide the label to avoid
                  a stray header taking width). */}
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
