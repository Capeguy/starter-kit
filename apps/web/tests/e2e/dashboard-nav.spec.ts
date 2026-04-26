import { expect } from '@playwright/test'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe('Dashboard navigation + sub-routes + breadcrumbs', () => {
  test('user sidebar surfaces all four workspace links and Overview is selected', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `DashNavUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()

    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })
    await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'My files' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Activity' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()

    // OUI's SidebarItem applies data-selected="true" to the wrapping <li>
    // when isSelected is true (the inner <a> doesn't get aria-current).
    const overviewItem = nav.locator('li[data-selected="true"]')
    await expect(overviewItem).toHaveCount(1)
    await expect(overviewItem).toContainText('Overview')

    await ctx.close()
  })

  test('clicking sidebar items navigates between dashboard sub-routes', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `DashClickUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()

    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })

    await nav.getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(/\/dashboard\/activity$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Activity', level: 1 }),
    ).toBeVisible()

    await nav.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/dashboard\/settings$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeVisible()

    await ctx.close()
  })

  test('breadcrumbs on /dashboard/activity link back to /dashboard', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `DashCrumbUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard/activity')
    await expect(
      page.getByRole('heading', { name: 'Activity', level: 1 }),
    ).toBeVisible()

    // OUI Breadcrumbs renders as <ol role="list" aria-label="Breadcrumbs">,
    // not a navigation landmark. Both crumbs are <a> (the trailing one
    // is rendered as a disabled link, no href).
    const crumbs = page.getByRole('list', { name: 'Breadcrumbs' })
    const dashboardCrumb = crumbs.getByRole('link', { name: 'Dashboard' })
    await expect(dashboardCrumb).toBeVisible()
    await expect(crumbs.getByRole('link', { name: 'Activity' })).toBeVisible()

    await dashboardCrumb.click()
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()

    await ctx.close()
  })

  test('mobile drawer opens, lists all four items, closes via the in-drawer Close Menu', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `DashMobileUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()

    const openTrigger = page.getByRole('button', { name: 'Open Menu' })
    await expect(openTrigger).toBeVisible()
    await openTrigger.click()

    const nav = page.getByRole('navigation', { name: /Dashboard navigation/i })
    await expect(nav.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'My files' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Activity' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()

    // Two "Close Menu" controls exist while the drawer is open (the trigger
    // button toggles to "Close Menu" and the in-drawer header has its own).
    // Use the in-drawer one (scoped to the nav landmark) to close.
    await nav.getByRole('button', { name: 'Close Menu' }).click()

    // After closing, the trigger flips back to "Open Menu" — which is the
    // hamburger-only-visible-on-mobile state we started in.
    await expect(page.getByRole('button', { name: 'Open Menu' })).toBeVisible()

    await ctx.close()
  })

  test('legacy /dashboard?tab=settings renders Overview, not the Settings page', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `DashLegacyUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard?tab=settings')
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Personal API tokens' }),
    ).toHaveCount(0)

    await ctx.close()
  })
})
