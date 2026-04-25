import { GovtBanner } from '@opengovsg/oui/govt-banner'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { env } from '~/env'
import { VersionCheckWrapper } from '../_components/version-check-wrapper'

// Public/logged-out pages always render in light mode regardless of the
// user's stored theme preference. The next-themes ThemeProvider at the
// root sets `html.class="dark"` from a head-injected script before paint;
// this layout-level inline script runs immediately after that head script
// (as the body parses) and removes the class so public pages render light
// without any visible flash. The user's stored preference is untouched
// and re-applies once they hit an authed route.
const FORCE_LIGHT_SCRIPT = `(function(){var h=document.documentElement;h.classList.remove('dark');h.classList.add('light');h.style.colorScheme='light'})();`

export default function PublicLayout({ children }: DynamicLayoutProps) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_SCRIPT }} />
      <main className="flex min-h-dvh flex-col">
        {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && <GovtBanner />}
        <VersionCheckWrapper />
        {children}
      </main>
    </>
  )
}
