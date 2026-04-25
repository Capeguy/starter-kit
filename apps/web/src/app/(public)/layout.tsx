import { GovtBanner } from '@opengovsg/oui/govt-banner'
import { ThemeProvider } from 'next-themes'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { env } from '~/env'
import { VersionCheckWrapper } from '../_components/version-check-wrapper'

export default function PublicLayout({ children }: DynamicLayoutProps) {
  // Force light theme on public/logged-out pages — dark mode is an
  // authenticated-user preference and shouldn't apply to landing/sign-in.
  // Nested ThemeProvider with `forcedTheme` overrides the root provider's
  // value while leaving the user's stored preference untouched for when
  // they sign in.
  return (
    <ThemeProvider forcedTheme="light" attribute="class">
      <main className="flex min-h-dvh flex-col">
        {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && <GovtBanner />}
        <VersionCheckWrapper />
        {children}
      </main>
    </ThemeProvider>
  )
}
