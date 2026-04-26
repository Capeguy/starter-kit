'use client'

import { useSyncExternalStore } from 'react'
import NextLink from 'next/link'
import {
  Avatar,
  Button,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from '@opengovsg/oui'
import { BiChevronDown, BiLogOut, BiSearch, BiShield } from 'react-icons/bi'

import { useCommandPalette } from '~/components/command-palette-provider'
import { ThemeToggle } from '~/components/theme-toggle'
import { ADMIN_ROOT_ROUTE, AUTHED_ROOT_ROUTE } from '~/constants'
import { env } from '~/env'
import { useAuth } from '~/lib/auth'
import { Capability, hasCapability } from '~/lib/rbac'
import { NotificationBell } from './notification-bell'

const subscribeNoop = () => () => {
  /* platform doesn't change mid-session */
}
const usePlatformShortcut = (): string =>
  useSyncExternalStore(
    subscribeNoop,
    () =>
      // navigator.platform is technically deprecated but still the most
      // reliable cross-browser way to detect macOS specifically. We only
      // use it to pick the visual hint character — actual key handling
      // accepts both meta and ctrl regardless of platform.
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
    // SSR fallback: render the macOS hint to avoid a hydration shimmer for
    // the majority of users; non-Mac users see it correct after hydrate.
    () => '⌘K',
  )

export const AuthedNavbar = () => {
  const { user, logout } = useAuth()
  const { open: openCommandPalette } = useCommandPalette()
  const shortcut = usePlatformShortcut()

  if (!user) {
    return null
  }

  const displayName = user.name ?? user.email ?? 'User'
  const isAdmin = hasCapability(user.role.capabilities, Capability.AdminAccess)

  return (
    <Navbar>
      <NavbarContent justify="start">
        <NavbarBrand>
          <NextLink
            href={AUTHED_ROOT_ROUTE}
            className="font-bold whitespace-nowrap text-inherit"
          >
            {env.NEXT_PUBLIC_APP_NAME}
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent justify="end">
        {/*
         * Cmd+K affordance — search-style chip that opens the command
         * palette. Hidden on small screens (no keyboard shortcut, hamburger
         * + bottom-nav patterns handle navigation there). Mirrors the
         * Linear / GitHub / Notion pattern of giving the palette a visible
         * surface so it's discoverable to non-power users.
         */}
        <NavbarItem className="hidden md:flex">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label={`Open command palette (${shortcut})`}
            className="border-base-divider-medium text-base-content-medium hover:bg-interaction-tinted-sub-hover hover:text-base-content-strong inline-flex items-center gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm transition"
          >
            <BiSearch className="h-4 w-4" aria-hidden />
            <span>Search...</span>
            <kbd className="border-base-divider-subtle bg-base-canvas-alt prose-caption-2 ml-2 rounded border px-1.5 py-0.5 font-mono">
              {shortcut}
            </kbd>
          </button>
        </NavbarItem>
        {isAdmin && (
          // Hide on small screens to keep the navbar from overflowing the
          // viewport — admins on mobile reach /admin via the account menu
          // (added below) or by typing the URL directly.
          <NavbarItem className="hidden sm:flex">
            <NextLink
              href={ADMIN_ROOT_ROUTE}
              className="prose-label-md text-base-content-strong hover:text-base-content-brand"
            >
              Admin
            </NextLink>
          </NavbarItem>
        )}
        <NavbarItem>
          <ThemeToggle />
        </NavbarItem>
        <NavbarItem>
          <NotificationBell />
        </NavbarItem>
        <NavbarItem>
          <MenuTrigger>
            <Button
              variant="clear"
              size="sm"
              className="min-w-0 px-2 sm:min-w-20 sm:px-4"
              endContent={<BiChevronDown className="hidden h-5 w-5 sm:block" />}
            >
              <Avatar
                size="xs"
                name={displayName}
                getInitials={(name) => name.slice(0, 2).toUpperCase()}
              >
                {user.avatarUrl && (
                  <Avatar.Image src={user.avatarUrl} alt={displayName} />
                )}
                <Avatar.Fallback />
              </Avatar>
            </Button>
            <Menu>
              <MenuSection title={displayName}>
                {isAdmin && (
                  <MenuItem href={ADMIN_ROOT_ROUTE} startContent={<BiShield />}>
                    Admin
                  </MenuItem>
                )}
                <MenuItem startContent={<BiLogOut />} onPress={() => logout()}>
                  Logout
                </MenuItem>
              </MenuSection>
            </Menu>
          </MenuTrigger>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  )
}
