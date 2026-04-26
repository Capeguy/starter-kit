'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, Shield, Sparkles } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar'
import { useAuth } from '~/lib/auth'
import {
  ADMIN_NAV,
  findActiveItem,
  rootForPathname,
  USER_NAV,
  visibleGroups,
} from '~/lib/nav'
import { useTRPC } from '~/trpc/react'

const getInitials = (name: string | null | undefined): string => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? 'U'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1] ?? first
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase()
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.me.get.queryOptions())

  // Pick which nav root applies to this pathname (admin vs user) so admins
  // get the admin nav while inside /admin and the dashboard nav elsewhere.
  // The user's /dashboard root is always present so admins can flip back.
  const root = rootForPathname(pathname)
  const groups = useMemo(
    () => visibleGroups(root.groups, me?.role.capabilities),
    [root, me?.role.capabilities],
  )
  const active = findActiveItem(pathname, root)
  // When the user is admin and currently on the dashboard, surface a quick
  // pivot to /admin (and vice versa). Built lazily off the other nav root.
  const otherRoot = root === USER_NAV ? ADMIN_NAV : USER_NAV
  const showOtherRoot =
    otherRoot === USER_NAV ||
    visibleGroups(ADMIN_NAV.groups, me?.role.capabilities).length > 0
  // Distinguish the two roots in the chrome: dashboard reads as a personal
  // workspace, admin as the operator's control surface. The switch-view icon
  // reflects the destination so it's clear at a glance which way you're going.
  const brandSubtitle = root === ADMIN_NAV ? 'Admin panel' : 'Workspace'
  const SwitchIcon = otherRoot === ADMIN_NAV ? Shield : LayoutDashboard

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Starter Kit</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {brandSubtitle}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = active?.item.path === item.path
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.path}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {showOtherRoot && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Switch view</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={otherRoot.label}>
                    <Link href={otherRoot.href}>
                      <SwitchIcon />
                      <span>Open {otherRoot.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavUser() {
  const { isMobile } = useSidebar()
  const trpc = useTRPC()
  const { data: me } = useQuery(trpc.me.get.queryOptions())
  const { logout } = useAuth()

  if (!me) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
                <AvatarFallback className="rounded-lg">
                  {getInitials(me.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {me.name ?? '(unnamed)'}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {me.role.name}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
                  <AvatarFallback className="rounded-lg">
                    {getInitials(me.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {me.name ?? '(unnamed)'}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {me.email ?? me.role.name}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
