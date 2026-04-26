import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ThemeProvider } from 'next-themes'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { AppSidebar } from '~/components/app-sidebar'
import { CommandPaletteProvider } from '~/components/command-palette-provider'
import { ErrorBoundary } from '~/components/error-boundary'
import { SiteHeader } from '~/components/site-header'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar'
import { LOGIN_ROUTE } from '~/constants'
import { getSession } from '~/server/session'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { EnvBanner } from '../_components/env-banner'
import { VersionCheckWrapper } from '../_components/version-check-wrapper'
import { ImpersonationBanner } from './_components/impersonation-banner'

export default async function AuthedLayout({ children }: DynamicLayoutProps) {
  // DO NOT SKIP AUTHENTICATION CHECKS IN YOUR PROCEDURES.
  // It is NOT secure. You can access a page data bypassing a layout call. It’s not trivial but it can be done.
  // Always put your auth call as close to the actual data call as possible, ideally right before access.

  const session = await getSession()
  if (!session.userId) {
    redirect(LOGIN_ROUTE)
  }
  await prefetch(trpc.me.get.queryOptions())

  // SidebarProvider reads the persisted open/collapsed state from a cookie
  // (set by SidebarTrigger). We hand it the server-side initial value so the
  // first render matches what the user last left, avoiding a flash.
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <HydrateClient>
        <CommandPaletteProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <SidebarInset>
              <EnvBanner />
              <VersionCheckWrapper />
              <ImpersonationBanner />
              <SiteHeader />
              {/*
               * ErrorBoundary wraps only the page content (not the chrome) so
               * that React render errors below it still leave the sidebar +
               * header + command palette interactive — users can still
               * navigate, log out, or open the account menu while seeing the
               * friendly fallback. Next.js segment-level crashes are caught
               * by `error.tsx`.
               */}
              <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </CommandPaletteProvider>
      </HydrateClient>
    </ThemeProvider>
  )
}
