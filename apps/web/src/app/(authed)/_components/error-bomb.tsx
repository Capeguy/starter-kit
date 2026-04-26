'use client'

/**
 * Test-only escape hatch for forcing a render error inside the authed
 * ErrorBoundary. Used by `error-boundary.spec.ts` (and ad-hoc by devs) to
 * verify the friendly fallback renders instead of the bare Next.js error
 * screen.
 *
 * Triggered by appending `?_throw=1` to any (authed) URL whose page mounts
 * `<ErrorBomb />`. Currently only the dashboard mounts it. Gated to non-
 * production builds so a stray query param can never crash a prod page.
 *
 * Reads `window.location.search` directly rather than `useSearchParams()`
 * to avoid forcing the page into a Suspense bailout for what is purely a
 * test-only signal — the host page (DashboardPage) is already a Client
 * Component, so reading window during render is safe.
 */
import { env } from '~/env'

export const ErrorBomb = () => {
  if (env.NEXT_PUBLIC_APP_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('_throw') === '1') {
    throw new Error('Forced test error from ErrorBomb')
  }
  return null
}
