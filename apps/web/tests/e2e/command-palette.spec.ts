import { expect } from '@playwright/test'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * Cmd+K command palette. The provider mounts in `(authed)/layout.tsx`, so it's
 * available on every authed route — we land on /dashboard and exercise the
 * shortcut from there. We use Meta+K because the e2e Chromium runs as if on
 * macOS by default; the provider listens for either Meta or Ctrl + K so this
 * works regardless of the OS the test is running on.
 */
test.describe('Cmd+K command palette', () => {
  test('admin user opens palette, navigates to audit log via Enter, then re-opens and Esc closes', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `PaletteAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    // Wait for the dashboard heading so the page (and the
    // CommandPaletteProvider keydown listener) are mounted before we send
    // the shortcut. Without this we race the React mount and ~30% of runs
    // dropped the keydown.
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()
    await page.locator('body').click()

    // (1) Cmd+K opens the palette.
    await page.keyboard.press('Meta+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()

    // (2) Type "audit" → "Audit log" entry appears, Enter navigates to /admin/audit.
    // Focus the cmdk input explicitly so keyboard events land there regardless
    // of where Radix Dialog put initial focus.
    const input = palette.getByRole('combobox')
    await input.focus()
    await input.fill('audit')
    const auditItem = palette.getByRole('option', { name: /Audit log/ })
    await expect(auditItem).toBeVisible()
    // Wait for cmdk to settle the auto-selection (it takes a microtask after
    // the input changes), then commit with Enter. The 10s URL timeout absorbs
    // the cold-route compile in dev mode for /admin/audit.
    await expect(auditItem).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/admin\/audit$/, { timeout: 10_000 })

    // (3) Reopen the palette and Esc to close.
    await page.keyboard.press('Meta+k')
    await expect(palette).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()

    await ctx.close()
  })

  test('non-admin user does NOT see admin-only entries (Audit log, All files, Notifications composer, Roles)', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `PaletteUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()
    await page.locator('body').click()

    await page.keyboard.press('Meta+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()

    // The non-admin always-visible items are present.
    await expect(
      palette.getByRole('option', { name: /Dashboard/ }),
    ).toBeVisible()
    await expect(
      palette.getByRole('option', { name: /My files/ }),
    ).toBeVisible()

    // None of the admin-gated entries are rendered for a plain user.
    await expect(
      palette.getByRole('option', { name: /Audit log/ }),
    ).toHaveCount(0)
    await expect(
      palette.getByRole('option', { name: /All files/ }),
    ).toHaveCount(0)
    await expect(
      palette.getByRole('option', { name: /Notifications composer/ }),
    ).toHaveCount(0)
    await expect(
      palette.getByRole('option', { name: /Roles & capabilities/ }),
    ).toHaveCount(0)
    await expect(
      palette.getByRole('option', { name: /Admin home/ }),
    ).toHaveCount(0)
    await expect(palette.getByRole('option', { name: /^Users$/ })).toHaveCount(
      0,
    )
    await expect(
      palette.getByRole('option', { name: /^Open Admin$/ }),
    ).toHaveCount(0)

    // Even when the user types a query that would match admin entries by name,
    // they remain absent (capability filtering happens before cmdk filtering).
    const input = palette.getByRole('combobox')
    await input.focus()
    await input.fill('audit')
    await expect(
      palette.getByRole('option', { name: /Audit log/ }),
    ).toHaveCount(0)

    await ctx.close()
  })
})
