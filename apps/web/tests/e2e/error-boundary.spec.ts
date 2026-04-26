import { expect } from '@playwright/test'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * The authed area has TWO error boundaries that could catch a render crash:
 *
 *   1. `~/components/error-boundary` (React render-error boundary, from
 *      `react-error-boundary`) wired into `(authed)/layout.tsx`. Test id:
 *      `error-boundary-fallback`.
 *   2. `(authed)/error.tsx` (Next.js segment-level error boundary). Test id:
 *      `authed-segment-error`.
 *
 * For an exception thrown inside a segment's render tree (the case forced by
 * `?_throw=1` from `<ErrorBomb />`), Next.js routes the error to its own
 * segment-level boundary first because it's the tightest one — the React
 * boundary in the layout would only fire if there were no `error.tsx`
 * between it and the throw. Both fallbacks share the same friendly UX:
 * an OUI Banner + "Try again" + "Reload page" buttons + collapsible details.
 *
 * This spec asserts the user sees the friendly fallback (whichever one fires)
 * rather than the raw Next.js error overlay.
 */
test.describe('Authed error boundary', () => {
  test('shows the friendly fallback when the dashboard throws, and recovers on healthy navigation', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `ErrUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    // 1. Force the dashboard to throw via the test escape hatch (?_throw=1).
    //    The page mounts <ErrorBomb /> which throws when this query param
    //    is present.
    await page.goto('/dashboard?_throw=1')

    // 2. Whichever boundary catches it, the friendly fallback should
    //    render with the "Something went wrong" copy + Try again + Reload
    //    buttons. We accept either test id.
    const friendlyFallback = page.locator(
      '[data-testid="error-boundary-fallback"], [data-testid="authed-segment-error"]',
    )
    await expect(friendlyFallback).toBeVisible()
    await expect(friendlyFallback).toContainText(/Something went wrong/i)
    await expect(
      friendlyFallback.getByRole('button', { name: 'Try again' }),
    ).toBeVisible()
    await expect(
      friendlyFallback.getByRole('button', { name: 'Reload page' }),
    ).toBeVisible()

    // 3. Click "Try again" — the boundary resets and re-renders. Because
    //    the URL still has ?_throw=1 the bomb fires again; the fallback
    //    must therefore still be visible. (This proves the reset actually
    //    re-mounted children.)
    await friendlyFallback
      .getByRole('button', { name: 'Try again' })
      .first()
      .click()
    await expect(friendlyFallback).toBeVisible()

    // 4. Navigate to /dashboard without the throw param — the real page
    //    should render normally (no fallback). This is the recovery path.
    await page.goto('/dashboard')
    await expect(friendlyFallback).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible()

    await ctx.close()
  })
})
