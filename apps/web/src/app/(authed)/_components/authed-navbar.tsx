'use client'

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
import { BiChevronDown, BiLogOut } from 'react-icons/bi'

import { ADMIN_ROOT_ROUTE, AUTHED_ROOT_ROUTE } from '~/constants'
import { env } from '~/env'
import { useAuth } from '~/lib/auth'
import { Capability, hasCapability } from '~/lib/rbac'
import { NotificationBell } from './notification-bell'

export const AuthedNavbar = () => {
  const { user, logout } = useAuth()

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
        {isAdmin && (
          <NavbarItem>
            <NextLink
              href={ADMIN_ROOT_ROUTE}
              className="prose-label-md text-base-content-strong hover:text-base-content-brand"
            >
              Admin
            </NextLink>
          </NavbarItem>
        )}
        <NavbarItem>
          <NotificationBell />
        </NavbarItem>
        <NavbarItem>
          <MenuTrigger>
            <Button
              variant="clear"
              size="md"
              endContent={<BiChevronDown className="h-5 w-5" />}
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
