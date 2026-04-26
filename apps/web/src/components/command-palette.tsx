'use client'

import type { ComponentProps } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { useTheme } from 'next-themes'
import {
  BiBell,
  BiFile,
  BiFolder,
  BiHome,
  BiLogOut,
  BiMoon,
  BiNote,
  BiShield,
  BiSliderAlt,
  BiSun,
  BiUser,
} from 'react-icons/bi'
import { useDebounceValue } from 'usehooks-ts'

import { ADMIN_ROOT_ROUTE, AUTHED_ROOT_ROUTE } from '~/constants'
import { useAuth } from '~/lib/auth'
import { Capability, hasCapability } from '~/lib/rbac'
import { useTRPC } from '~/trpc/react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface PageEntry {
  href: string
  label: string
  description?: string
  capability?: (typeof Capability)[keyof typeof Capability]
  icon: React.ReactNode
  keywords?: string[]
}

const PAGE_ENTRIES: PageEntry[] = [
  {
    href: AUTHED_ROOT_ROUTE,
    label: 'Dashboard',
    description: 'Your home page',
    icon: <BiHome aria-hidden className="h-4 w-4" />,
    keywords: ['home'],
  },
  {
    href: '/dashboard/files',
    label: 'My files',
    description: 'Files you uploaded',
    icon: <BiFile aria-hidden className="h-4 w-4" />,
    keywords: ['uploads', 'documents'],
  },
  {
    href: '/dashboard?tab=settings',
    label: 'Settings',
    description: 'Account preferences and API tokens',
    icon: <BiSliderAlt aria-hidden className="h-4 w-4" />,
    keywords: ['preferences', 'profile', 'tokens', 'api'],
  },
  {
    href: ADMIN_ROOT_ROUTE,
    label: 'Admin home',
    description: 'Administration overview',
    capability: Capability.AdminAccess,
    icon: <BiShield aria-hidden className="h-4 w-4" />,
    keywords: ['admin'],
  },
  {
    href: '/admin/users',
    label: 'Users',
    description: 'Manage users',
    capability: Capability.UserList,
    icon: <BiUser aria-hidden className="h-4 w-4" />,
    keywords: ['admin', 'people', 'members'],
  },
  {
    href: '/admin/audit',
    label: 'Audit log',
    description: 'View audit history',
    capability: Capability.AdminAccess,
    icon: <BiNote aria-hidden className="h-4 w-4" />,
    keywords: ['admin', 'logs', 'history', 'events'],
  },
  {
    href: '/admin/files',
    label: 'All files',
    description: 'Every uploaded file',
    capability: Capability.FileReadAny,
    icon: <BiFolder aria-hidden className="h-4 w-4" />,
    keywords: ['admin', 'uploads'],
  },
  {
    href: '/admin/notifications',
    label: 'Notifications composer',
    description: 'Broadcast a notification',
    capability: Capability.NotificationBroadcast,
    icon: <BiBell aria-hidden className="h-4 w-4" />,
    keywords: ['admin', 'broadcast', 'send'],
  },
  {
    href: '/admin/roles',
    label: 'Roles & capabilities',
    description: 'Manage RBAC roles',
    capability: Capability.AdminAccess,
    icon: <BiShield aria-hidden className="h-4 w-4" />,
    keywords: ['admin', 'rbac', 'permissions'],
  },
]

const SEARCH_DEBOUNCE_MS = 300

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const itemClass = [
  'group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
  'text-base-content-strong',
  'aria-selected:bg-interaction-tinted-main-active',
  'aria-selected:text-interaction-main-default',
].join(' ')

/**
 * Cmd+K command palette: keyboard-driven overlay that fuzzy-searches across
 * pages, users (admin), own files, and quick actions. Hidden behind a Radix
 * dialog (via cmdk's `Command.Dialog`) so focus trap, Esc-to-close, and
 * portal mounting come for free. Capability-gated entries are filtered out
 * before render — non-admin users never see admin items in the list, and
 * never receive admin tRPC search results either (those queries are gated
 * by the same capability check, so the request is just not made).
 */
export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const router = useRouter()
  const trpc = useTRPC()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounceValue(search, SEARCH_DEBOUNCE_MS)

  const capabilities = user?.role.capabilities

  const visiblePages = useMemo(
    () =>
      PAGE_ENTRIES.filter(
        (page) =>
          !page.capability || hasCapability(capabilities, page.capability),
      ),
    [capabilities],
  )

  const isAdminUserSearcher = hasCapability(capabilities, Capability.UserList)
  const debouncedSearchTrimmed = debouncedSearch.trim()
  const enableLiveSearch = isOpen && debouncedSearchTrimmed.length > 1

  const usersQuery = useQuery(
    trpc.admin.users.list.queryOptions(
      { q: debouncedSearchTrimmed || null, limit: 8 },
      { enabled: enableLiveSearch && isAdminUserSearcher },
    ),
  )

  const filesQuery = useQuery(
    trpc.file.search.queryOptions(
      { query: debouncedSearchTrimmed, limit: 8 },
      { enabled: enableLiveSearch },
    ),
  )

  const handleSelect = (run: () => void | Promise<void>) => {
    setSearch('')
    onClose()
    void Promise.resolve(run())
  }

  const navigate = (href: string) => handleSelect(() => router.push(href))

  const isAdmin = hasCapability(capabilities, Capability.AdminAccess)
  const nextThemeLabel = theme === 'dark' ? 'light' : 'dark'

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          // Reset the input on close so reopening starts fresh — this matches
          // the muscle memory pattern of Slack/Linear/etc. Doing it in the
          // event handler (not a useEffect) keeps state updates synchronous
          // and avoids cascading-render lint errors.
          setSearch('')
          onClose()
        }
      }}
      label="Command palette"
      shouldFilter
      loop
      overlayClassName="fixed inset-0 z-50 bg-base-canvas-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
      contentClassName="fixed top-[20vh] left-1/2 z-50 w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-xl border border-base-divider-medium bg-base-canvas-default shadow-2xl outline-hidden focus:outline-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
    >
      <CommandInputRow
        value={search}
        onValueChange={setSearch}
        placeholder="Type a command or search…"
      />
      <Command.List
        data-testid="command-palette-list"
        className="max-h-[60vh] overflow-y-auto p-2"
      >
        <Command.Empty className="prose-body-2 text-base-content-medium px-3 py-6 text-center">
          No matches.
        </Command.Empty>

        {visiblePages.length > 0 && (
          <Command.Group
            heading="Pages"
            className="prose-caption-2 text-base-content-medium [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase"
          >
            {visiblePages.map((page) => (
              <Command.Item
                key={page.href}
                value={`page ${page.label} ${page.description ?? ''} ${(page.keywords ?? []).join(' ')}`}
                onSelect={() => navigate(page.href)}
                className={itemClass}
              >
                <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
                  {page.icon}
                </span>
                <span className="flex flex-col">
                  <span className="prose-label-md">{page.label}</span>
                  {page.description && (
                    <span className="prose-caption-2 text-base-content-medium">
                      {page.description}
                    </span>
                  )}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {isAdminUserSearcher && enableLiveSearch && (
          <Command.Group
            heading="Users"
            className="prose-caption-2 text-base-content-medium mt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase"
          >
            {usersQuery.isLoading ? (
              <Command.Loading>
                <div className="prose-caption-2 text-base-content-medium px-3 py-2">
                  Searching users…
                </div>
              </Command.Loading>
            ) : (
              (usersQuery.data?.items ?? []).map((u) => (
                <Command.Item
                  key={`user-${u.id}`}
                  value={`user ${u.name ?? ''} ${u.email ?? ''} ${u.id}`}
                  onSelect={() => navigate(`/admin/users/${u.id}`)}
                  className={itemClass}
                >
                  <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
                    <BiUser aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="prose-label-md">
                      {u.name ?? '(unnamed)'}
                    </span>
                    <span className="prose-caption-2 text-base-content-medium">
                      {u.email ?? u.id}
                    </span>
                  </span>
                </Command.Item>
              ))
            )}
          </Command.Group>
        )}

        {enableLiveSearch && (
          <Command.Group
            heading="My files"
            className="prose-caption-2 text-base-content-medium mt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase"
          >
            {filesQuery.isLoading ? (
              <Command.Loading>
                <div className="prose-caption-2 text-base-content-medium px-3 py-2">
                  Searching files…
                </div>
              </Command.Loading>
            ) : (
              (filesQuery.data?.items ?? []).map((f) => (
                <Command.Item
                  key={`file-${f.id}`}
                  value={`file ${f.filename} ${f.id}`}
                  onSelect={() => navigate(`/api/files/${f.id}/download`)}
                  className={itemClass}
                >
                  <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
                    <BiFile aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="prose-label-md">{f.filename}</span>
                    <span className="prose-caption-2 text-base-content-medium">
                      {formatBytes(f.size)}
                    </span>
                  </span>
                </Command.Item>
              ))
            )}
          </Command.Group>
        )}

        <Command.Group
          heading="Actions"
          className="prose-caption-2 text-base-content-medium mt-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase"
        >
          <Command.Item
            value="action sign out logout"
            onSelect={() => handleSelect(() => logout())}
            className={itemClass}
          >
            <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
              <BiLogOut aria-hidden className="h-4 w-4" />
            </span>
            <span className="prose-label-md">Sign out</span>
          </Command.Item>
          <Command.Item
            value="action toggle dark mode theme"
            onSelect={() =>
              handleSelect(() => setTheme(theme === 'dark' ? 'light' : 'dark'))
            }
            className={itemClass}
          >
            <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
              {theme === 'dark' ? (
                <BiSun aria-hidden className="h-4 w-4" />
              ) : (
                <BiMoon aria-hidden className="h-4 w-4" />
              )}
            </span>
            <span className="prose-label-md">Toggle {nextThemeLabel} mode</span>
          </Command.Item>
          {isAdmin && (
            <Command.Item
              value="action open admin"
              onSelect={() => navigate(ADMIN_ROOT_ROUTE)}
              className={itemClass}
            >
              <span className="text-base-content-medium group-aria-selected:text-interaction-main-default flex h-7 w-7 items-center justify-center">
                <BiShield aria-hidden className="h-4 w-4" />
              </span>
              <span className="prose-label-md">Open Admin</span>
            </Command.Item>
          )}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

const CommandInputRow = (props: ComponentProps<typeof Command.Input>) => (
  <div className="border-base-divider-subtle flex items-center border-b px-3">
    <Command.Input
      {...props}
      className="placeholder:text-base-content-medium text-base-content-strong h-12 w-full bg-transparent px-1 text-base outline-hidden focus:outline-hidden"
    />
  </div>
)
