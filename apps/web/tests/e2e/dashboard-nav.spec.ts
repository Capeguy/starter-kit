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

    // shadcn `Sidebar` doesn't auto-set a nav landmark, but it does render an
    // inner `<div data-sidebar="sidebar">` that scopes the chrome. Use that
    // attribute to target sidebar links specifically (the dashboard body also
    // contains "See all →" links to /dashboard/files and /dashboard/activity).
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'My files' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Activity' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible()

    // shadcn `SidebarMenuButton` with `isActive` sets `data-active="true"` on
    // the rendered element. Because the menu button uses `asChild` + `<Link>`,
    // the active attribute lands on the anchor itself.
    const overviewLink = sidebar.getByRole('link', { name: 'Overview' })
    await expect(overviewLink).toHaveAttribute('data-active', 'true')

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

    const sidebar = page.locator('[data-sidebar="sidebar"]')

    await sidebar.getByRole('link', { name: 'Activity' }).click()
    await expect(page).toHaveURL(/\/dashboard\/activity$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Activity', level: 1 }),
    ).toBeVisible()

    await sidebar.getByRole('link', { name: 'Settings' }).click()
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

    // shadcn `Breadcrumb` renders as `<nav aria-label="breadcrumb">`.
    // `BreadcrumbLink` is an anchor; `BreadcrumbPage` is a span with
    // role="link" + aria-current="page" (rendered as a non-link current crumb).
    const crumbs = page.getByRole('navigation', { name: /breadcrumb/i })
    const dashboardCrumb = crumbs.getByRole('link', { name: 'Dashboard' })
    await expect(dashboardCrumb).toBeVisible()
    const activityCrumb = crumbs.getByText('Activity', { exact: true })
    await expect(activityCrumb).toBeVisible()
    await expect(activityCrumb).toHaveAttribute('aria-current', 'page')

    await dashboardCrumb.click()
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: /Welcome/, level: 1 }),
    ).toBeVisible()

    await ctx.close()
  })

  test('mobile drawer opens, lists all four items, closes via Escape', async ({
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

    // On mobile, shadcn `Sidebar` swaps the inline desktop sidebar for a
    // `Sheet` that's only mounted while open. So no `[data-sidebar="sidebar"]`
    // exists in the DOM until the trigger is clicked.
    await expect(page.locator('[data-sidebar="sidebar"]')).toHaveCount(0)

    // The `SidebarTrigger` button is the only mount point for the drawer.
    // It uses an `sr-only` "Toggle Sidebar" label (one button, not two states).
    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // Drawer opens — sidebar mounts inside a Sheet with data-mobile="true".
    const drawer = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Overview' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'My files' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Activity' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Settings' })).toBeVisible()

    // shadcn's `Sheet` hides its built-in close button via `[&>button]:hidden`
    // for sidebar usage; the project closes the drawer via Escape, backdrop,
    // or by clicking a link inside.
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)

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
