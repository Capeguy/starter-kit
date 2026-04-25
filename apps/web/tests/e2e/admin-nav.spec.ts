import { expect } from '@playwright/test'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe('Admin navigation + role gating', () => {
  test('admin sidebar surfaces all five sub-page links', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `NavAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    await page.goto('/admin')

    // The sidebar wrapper div has role="navigation" aria-label="Admin navigation".
    const nav = page.getByRole('navigation', { name: 'Admin navigation' })
    await expect(nav.getByRole('link', { name: /Users/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Audit log/ })).toBeVisible()
    await expect(
      nav.getByRole('link', { name: /Send notification/ }),
    ).toBeVisible()
    await expect(nav.getByRole('link', { name: /All files/ })).toBeVisible()
    await expect(
      nav.getByRole('link', { name: /Roles.*capabilities/ }),
    ).toBeVisible()

    await ctx.close()
  })

  test('each admin sub-page is reachable as ADMIN', async ({ browser }) => {
    const admin = await createTestUser({
      name: `NavAdminB-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    for (const path of [
      '/admin',
      '/admin/users',
      '/admin/audit',
      '/admin/notifications',
      '/admin/files',
      '/admin/roles',
    ]) {
      const res = await page.goto(path)
      expect(res?.status(), `${path} status`).toBe(200)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
    }

    await ctx.close()
  })

  test('non-admin USER is redirected from /admin to /dashboard', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `PlainUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/dashboard$/)

    await ctx.close()
  })

  test('navbar shows the Admin link only for admins', async ({ browser }) => {
    const admin = await createTestUser({
      name: `NavbarAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const adminCtx = await browser.newContext()
    await signInAs(adminCtx, admin.id)
    const adminPage = await adminCtx.newPage()
    await adminPage.goto('/dashboard')
    await expect(
      adminPage.getByRole('link', { name: 'Admin', exact: true }),
    ).toBeVisible()
    await adminCtx.close()

    const user = await createTestUser({ name: `NavbarUser-${uniq()}` })
    const userCtx = await browser.newContext()
    await signInAs(userCtx, user.id)
    const userPage = await userCtx.newPage()
    await userPage.goto('/dashboard')
    await expect(
      userPage.getByRole('link', { name: 'Admin', exact: true }),
    ).toHaveCount(0)
    await userCtx.close()
  })
})
