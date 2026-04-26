import { Landmark } from 'lucide-react'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { env } from '~/env'
import { VersionCheckWrapper } from '../_components/version-check-wrapper'

// Public/logged-out pages always render in light mode. ThemeProvider is
// scoped to (authed) routes only — without it on public pages, no
// `html.class="dark"` is ever applied and tokens stay in light mode.
// The user's stored preference is untouched.
export default function PublicLayout({ children }: DynamicLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col">
      {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && <GovtStrip />}
      <VersionCheckWrapper />
      {children}
    </main>
  )
}

const GovtStrip = () => (
  <div
    role="banner"
    className="bg-muted text-muted-foreground flex w-full items-center gap-2 px-4 py-1.5 text-xs"
  >
    <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
    <span>A Singapore Government Agency Website</span>
    <a
      href="https://www.gov.sg/trusted-sites"
      target="_blank"
      rel="noreferrer"
      className="text-foreground ml-auto underline-offset-2 hover:underline"
    >
      How to identify
    </a>
  </div>
)
