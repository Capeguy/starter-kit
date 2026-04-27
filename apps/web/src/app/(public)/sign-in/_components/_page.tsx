'use client'

import Link from 'next/link'
import { Fingerprint, Sparkles } from 'lucide-react'

import { Separator } from '~/components/ui/separator'
import { env } from '~/env'
import { SignInWizard } from './wizard'

// Computed at module load — `new Date()` in render breaks react-hooks/purity.
const COPYRIGHT_YEAR = new Date().getFullYear()

/**
 * Split-screen sign-in page modeled on next-shadcn-admin-dashboard's
 * `/auth/v2/login`. Form column on the left; primary-coloured brand panel on
 * the right (hidden below `lg`). Passkey-only — no password fields, no social
 * auth, single primary CTA inside `SignInWizard`.
 *
 * Exported for testing.
 */
export const SignInPageComponent = () => {
  return (
    <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
      {/* RIGHT — brand panel (lg+ only). order-2 so it sits on the right while
          the form stays first in DOM order for screen readers. */}
      <div className="bg-primary text-primary-foreground relative order-2 hidden h-full overflow-hidden rounded-3xl lg:flex">
        <div className="absolute top-10 space-y-1 px-10">
          <Sparkles className="size-10" aria-hidden />
          <h1 className="text-2xl font-medium">{env.NEXT_PUBLIC_APP_NAME}</h1>
          <p className="text-sm opacity-90">Build. Ship. Iterate.</p>
        </div>

        <div className="absolute right-10 bottom-10 left-10 flex justify-between gap-6">
          <div className="flex-1 space-y-1">
            <h2 className="font-medium">Passwordless by design.</h2>
            <p className="text-sm opacity-90">
              Sign in with a passkey synced across your devices — no passwords,
              no MFA codes, no emails to forget.
            </p>
          </div>
          <Separator
            orientation="vertical"
            className="bg-primary-foreground/20 h-auto!"
          />
          <div className="flex-1 space-y-1">
            <h2 className="font-medium">Already an account?</h2>
            <p className="text-sm opacity-90">
              Just hit continue. We&apos;ll match your existing passkey
              automatically — no need to remember which device.
            </p>
          </div>
        </div>
      </div>

      {/* LEFT — form column. order-1 so it appears first on mobile (when the
          right panel is hidden). */}
      <div className="relative order-1 flex h-full flex-col">
        <div className="text-muted-foreground absolute top-5 right-10 hidden text-sm sm:block">
          <Link prefetch={false} className="text-foreground" href="/">
            ← Back to home
          </Link>
        </div>

        <div className="mx-auto flex w-full flex-1 flex-col justify-center space-y-8 px-6 sm:w-[360px] sm:px-0">
          <div className="space-y-2 text-center">
            <div className="bg-primary text-primary-foreground mx-auto flex size-11 items-center justify-center rounded-xl">
              <Fingerprint className="size-5" aria-hidden />
            </div>
            <h1 className="text-3xl font-medium">Sign in to your account</h1>
            <p className="text-muted-foreground text-sm">
              Use your passkey to continue. We&apos;ll create one for you on
              your first visit.
            </p>
          </div>
          <SignInWizard />
        </div>

        <div className="text-muted-foreground hidden w-full justify-between px-10 pb-5 text-xs sm:flex">
          <span>
            © {COPYRIGHT_YEAR} {env.NEXT_PUBLIC_APP_NAME}
          </span>
          <span>Passkey-only authentication.</span>
        </div>
      </div>
    </div>
  )
}
