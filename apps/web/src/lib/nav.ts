/**
 * Single source of truth for navigation across the authed app.
 *
 * Three consumers read from this file:
 * - The shared sidebar (`apps/web/src/components/nav-sidebar.tsx`) renders
 *   groups + items for whichever NavRoot is passed in (admin or user).
 * - The Cmd+K command palette (`apps/web/src/components/command-palette.tsx`)
 *   pulls its grouped sections from here.
 * - The registry-driven breadcrumb component
 *   (`apps/web/src/components/registry-breadcrumbs.tsx`) walks the registry
 *   to resolve a chain from the current pathname.
 *
 * Adding a new page means adding ONE entry here; the sidebar, palette, and
 * breadcrumbs pick it up automatically. Capability gates centralize too —
 * an item with `requires` is hidden from users who lack the capability.
 *
 * NOT registered here: dynamic sub-routes like `/admin/users/[id]`. They
 * resolve to their parent item via the parent's `matches` regex (see
 * `findActiveItem` below) and are rendered as the trailing breadcrumb
 * label by their owning page (which has the dynamic data — e.g. the
 * user's name — that the registry can't know).
 */
import type { ComponentType, SVGProps } from 'react'
import {
  BiBell,
  BiBroadcast,
  BiCog,
  BiFile,
  BiFolder,
  BiHistory,
  BiHome,
  BiPulse,
  BiCog as BiSettings,
  BiShield,
  BiToggleRight,
  BiUser,
} from 'react-icons/bi'

import type { CapabilityCode } from '~/lib/rbac'
import { Capability, hasCapability } from '~/lib/rbac'

export type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export interface NavItem {
  /** Canonical href the item renders for. Active when pathname === path
   *  or pathname.startsWith(path + '/'). Override with `matches` for
   *  more precise control (e.g. dynamic segments under a sibling item). */
  path: string
  /** Sidebar / palette label. Title-case, sentence-style. */
  label: string
  /** A single short sentence shown in the Cmd+K palette under the label. */
  description?: string
  icon: NavIcon
  /** Capability the user must have for this item to render. Sidebar +
   *  palette skip the item when absent. */
  requires?: CapabilityCode
  /** Extra patterns the item should match for active-state / breadcrumb
   *  resolution. e.g. `/admin/users/[id]` matches the Users item via
   *  matches: [/^\/admin\/users\//]. The `path` already matches itself
   *  and any `path/...` sub-path; add matches only when you need more. */
  matches?: RegExp[]
}

export interface NavGroup {
  /** Section header rendered above the group in the sidebar. */
  label: string
  items: NavItem[]
}

export interface NavRoot {
  /** Top-level area label, used for the first breadcrumb (e.g. "Admin"). */
  label: string
  /** Where the root crumb links to (clickable). */
  href: string
  groups: NavGroup[]
}

// ────────────────────────────────────────────────────────────────────────────
// Admin
// ────────────────────────────────────────────────────────────────────────────

export const ADMIN_NAV: NavRoot = {
  label: 'Admin',
  href: '/admin',
  groups: [
    {
      label: 'Identity',
      items: [
        {
          path: '/admin/users',
          label: 'Users',
          description: 'Active accounts + pending invites',
          icon: BiUser,
          requires: Capability.UserList,
          matches: [/^\/admin\/users(\/|$)/],
        },
        {
          path: '/admin/roles',
          label: 'Roles & capabilities',
          description: 'RBAC roles and their granted capabilities',
          icon: BiShield,
        },
      ],
    },
    {
      label: 'Content',
      items: [
        {
          path: '/admin/files',
          label: 'All files',
          description: 'Every file uploaded by every user',
          icon: BiFile,
          requires: Capability.FileReadAny,
        },
        {
          path: '/admin/notifications',
          label: 'Send notification',
          description: 'Broadcast to all users, a role, or one user',
          icon: BiBell,
          requires: Capability.NotificationBroadcast,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          path: '/admin/audit',
          label: 'Audit log',
          description: 'Security-relevant events across the app',
          icon: BiHistory,
        },
        {
          path: '/admin/feature-flags',
          label: 'Feature flags',
          description: 'Toggle features, % rollouts, allowlists',
          icon: BiToggleRight,
          requires: Capability.FeatureFlagManage,
        },
        {
          path: '/admin/mcp',
          label: 'MCP server',
          description: 'Model Context Protocol JSON-RPC endpoint',
          icon: BiCog,
        },
        {
          path: '/admin/system-message',
          label: 'System message',
          description: 'App-wide banner shown to all signed-in users',
          icon: BiBroadcast,
          requires: Capability.SystemMessageManage,
        },
      ],
    },
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// User dashboard
// ────────────────────────────────────────────────────────────────────────────

export const USER_NAV: NavRoot = {
  label: 'Dashboard',
  href: '/dashboard',
  groups: [
    {
      label: 'Workspace',
      items: [
        {
          path: '/dashboard',
          label: 'Overview',
          description: 'Profile + summary',
          icon: BiHome,
        },
        {
          path: '/dashboard/files',
          label: 'My files',
          description: 'Your uploaded files',
          icon: BiFolder,
        },
        {
          path: '/dashboard/activity',
          label: 'Activity',
          description: 'Your recent sign-ins, passkey events, and changes',
          icon: BiPulse,
        },
        {
          path: '/dashboard/settings',
          label: 'Settings',
          description: 'Personal API tokens, preferences',
          icon: BiSettings,
        },
      ],
    },
  ],
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Filter groups (and their items) to only those the user is allowed to see.
 * Empty groups (everything inside was capability-gated out) are dropped.
 */
export function visibleGroups(
  groups: readonly NavGroup[],
  capabilities: readonly string[] | undefined,
): NavGroup[] {
  const out: NavGroup[] = []
  for (const g of groups) {
    const items = g.items.filter(
      (it) => !it.requires || hasCapability(capabilities, it.requires),
    )
    if (items.length > 0) out.push({ label: g.label, items })
  }
  return out
}

/**
 * Find which item the given pathname belongs to. An item matches when
 * pathname === item.path, pathname.startsWith(item.path + '/'), or any
 * of item.matches tests true.
 *
 * Prefers the longest path match so /admin/users/abc resolves to /admin/users
 * even if /admin had its own item.
 */
export function findActiveItem(
  pathname: string,
  root: NavRoot,
): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem; score: number } | null = null
  for (const g of root.groups) {
    for (const it of g.items) {
      const matched =
        pathname === it.path ||
        pathname.startsWith(it.path + '/') ||
        (it.matches?.some((re) => re.test(pathname)) ?? false)
      if (!matched) continue
      const score = it.path.length
      if (!best || score > best.score) {
        best = { group: g, item: it, score }
      }
    }
  }
  return best ? { group: best.group, item: best.item } : null
}

/**
 * Pick which root applies to a pathname. Currently a simple prefix check.
 * Defaults to USER_NAV if nothing else matches (so /dashboard/files
 * resolves cleanly).
 */
export function rootForPathname(pathname: string): NavRoot {
  if (pathname.startsWith('/admin')) return ADMIN_NAV
  return USER_NAV
}

/**
 * Resolve the breadcrumb chain for a pathname.
 *
 * Returns: [root, ...item, optional trailing] where:
 *  - root is the area label ("Admin") linking to its home
 *  - item is the matching nav item (or omitted if pathname === root.href)
 *  - trailing is the caller-supplied label for a dynamic sub-page
 *    (e.g. a user's name on /admin/users/{id}); pages provide it because
 *    the registry can't know data.
 *
 * The current item is rendered as the LAST entry when no trailing is
 * provided (i.e. it's not a link); when trailing is provided, the item
 * becomes a clickable mid-crumb back to the parent.
 */
export interface BreadcrumbCrumb {
  label: string
  href?: string
}

export function resolveBreadcrumbs(
  pathname: string,
  trailing?: string,
): BreadcrumbCrumb[] {
  const root = rootForPathname(pathname)
  const crumbs: BreadcrumbCrumb[] = [{ label: root.label, href: root.href }]
  if (pathname === root.href) {
    // Just the root — no item crumb. Trailing only added if provided.
    if (trailing) crumbs.push({ label: trailing })
    return crumbs
  }
  const active = findActiveItem(pathname, root)
  if (active) {
    if (trailing) {
      // Item becomes a clickable mid-crumb; trailing is the leaf.
      crumbs.push({ label: active.item.label, href: active.item.path })
      crumbs.push({ label: trailing })
    } else {
      // Item is the leaf, not a link.
      crumbs.push({ label: active.item.label })
    }
  } else if (trailing) {
    crumbs.push({ label: trailing })
  }
  return crumbs
}
