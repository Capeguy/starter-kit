'use client'

import { useSyncExternalStore } from 'react'
import { Search } from 'lucide-react'

import { NotificationBell } from '~/app/(authed)/_components/notification-bell'
import { useCommandPalette } from '~/components/command-palette-provider'
import { ThemeToggle } from '~/components/theme-toggle'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { SidebarTrigger } from '~/components/ui/sidebar'

const subscribeNoop = () => () => {
  /* origin/platform are immutable for the session */
}

const usePlatformShortcut = (): string =>
  useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform)
        ? '⌘K'
        : 'Ctrl K',
    () => '⌘K',
  )

/**
 * Top bar that lives inside `SidebarInset`. Mirrors next-shadcn-admin-dashboard:
 * sidebar trigger on the left, search affordance, then action chips on the
 * right (theme toggle, notifications). The user account menu lives in the
 * sidebar footer (`AppSidebar -> NavUser`), not here.
 */
export function SiteHeader() {
  const { open: openCommandPalette } = useCommandPalette()
  const shortcut = usePlatformShortcut()

  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <Button
        variant="outline"
        size="sm"
        onClick={openCommandPalette}
        aria-label={`Open command palette (${shortcut})`}
        className="text-muted-foreground hidden h-9 w-64 justify-between gap-2 md:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" aria-hidden />
          Search…
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px]">
          {shortcut}
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={openCommandPalette}
        aria-label="Open command palette"
        className="md:hidden"
      >
        <Search className="size-4" />
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  )
}
