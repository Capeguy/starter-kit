import { GovtBanner } from '@opengovsg/oui/govt-banner'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { env } from '~/env'
import { VersionCheckWrapper } from '../_components/version-check-wrapper'

// Public/logged-out pages always render in light mode. ThemeProvider is
// scoped to (authed) routes only — without it on public pages, no
// `html.class="dark"` is ever applied and OUI's `.dark` overrides don't
// fire. The user's stored preference is untouched.
export default function PublicLayout({ children }: DynamicLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col">
      {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && <GovtBanner />}
      <VersionCheckWrapper />
      {children}
    </main>
  )
}
