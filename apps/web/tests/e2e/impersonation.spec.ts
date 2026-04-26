import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

interface TrpcErrorBody {
  error: { message: string }
}

/**
 * Call a tRPC mutation endpoint from inside the browser page (so the
 * session cookie is automatically sent). The caller must have already
 * navigated to a page before calling this helper.
 *
 * Returns { status, body } where `body` is the parsed tRPC response JSON.
 */
async function trpcPost(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ([p, i]: [string, unknown]) => {
      const res = await fetch(`/api/trpc/${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: i }),
      })
      const body = (await res.json()) as unknown
      return { status: res.status, body }
    },
    [path, input] as [string, unknown],
  )
}

/** Extract the error message string from a tRPC HTTP error response body. */
function extractErrorMessage(body: unknown): string {
  const b = body as Partial<TrpcErrorBody>
  return b.error?.message ?? ''
}

test.describe('User impersonation', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — full happy-path: banner appears, ctx flips, stop reverts
  // ──────────────────────────────────────────────────────────────────────────
  test('admin impersonates a user → banner appears, ctx flips, stop reverts', async ({
    browser,
  }) => {
    const tag = uniq()
    const adminName = `ImpAdmin-${tag}`
    const targetName = `ImpTarget-${tag}`
    const admin = await createTestUser({ name: adminName, role: 'ADMIN' })
    await createTestUser({ name: targetName })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/users')

    // The target user's row has an "Impersonate" button.
    const targetRow = page.getByRole('row').filter({ hasText: targetName })
    await targetRow.getByRole('button', { name: 'Impersonate' }).click()

    // After impersonation starts the router pushes to /dashboard.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // The impersonation banner is visible and mentions both names.
    const banner = page.getByRole('status')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(targetName)
    await expect(banner).toContainText(adminName)
    // Banner copy: "You are impersonating <target> as <admin>"
    await expect(banner).toContainText(/impersonating/i)

    // Stop impersonation via the banner button.
    await banner.getByRole('button', { name: 'Stop impersonation' }).click()

    // Router pushes back to /admin/users after stop.
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10_000 })

    // Banner is gone — we're back to the admin's own session.
    await expect(page.getByRole('status')).toHaveCount(0)

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — user without user.impersonate cannot see the Impersonate button
  // ──────────────────────────────────────────────────────────────────────────
  test('user with admin.access + user.list but no user.impersonate sees no Impersonate button', async ({
    browser,
  }) => {
    const tag = uniq()

    // Create a custom role that grants access to /admin/users but NOT impersonation.
    const limitedRole = await db.role.create({
      data: {
        id: `role_limited_${tag.replace(/-/g, '_')}`,
        name: `LimitedAdmin-${tag}`,
        // admin.access lets them reach /admin/*, user.list lets them see /admin/users
        capabilities: ['admin.access', 'user.list'],
        isSystem: false,
      },
    })

    const limitedUser = await createTestUser({
      name: `LimitedUser-${tag}`,
      roleId: limitedRole.id,
    })
    // Create a second user so there is at least one row in the table.
    await createTestUser({ name: `OtherUser-${tag}` })

    const ctx = await browser.newContext()
    await signInAs(ctx, limitedUser.id)
    const page = await ctx.newPage()
    await page.goto('/admin/users')

    // The users list renders (limited user has admin.access + user.list).
    await expect(page.getByRole('heading', { name: /Users/ })).toBeVisible()

    // No Impersonate button anywhere in the table.
    await expect(page.getByRole('button', { name: 'Impersonate' })).toHaveCount(
      0,
    )

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3 — API: no capability → 403
  // ──────────────────────────────────────────────────────────────────────────
  test('API: calling impersonation.start without capability returns 403', async ({
    browser,
  }) => {
    const tag = uniq()
    const regularUser = await createTestUser({
      name: `ApiNoCapUser-${tag}`,
      role: 'USER',
    })
    const otherUser = await createTestUser({
      name: `ApiOtherUser-${tag}`,
      role: 'USER',
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, regularUser.id)
    const page = await ctx.newPage()
    // Navigate first so relative fetch URL resolves.
    await page.goto('/dashboard')

    const result = await trpcPost(page, 'impersonation.start', {
      userId: otherUser.id,
    })

    // tRPC maps FORBIDDEN → HTTP 403.
    expect(result.status).toBe(403)

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4 — API: cannot impersonate self
  // ──────────────────────────────────────────────────────────────────────────
  test('API: admin cannot impersonate themselves', async ({ browser }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `SelfImpAdmin-${tag}`,
      role: 'ADMIN',
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard')

    const result = await trpcPost(page, 'impersonation.start', {
      userId: admin.id,
    })

    expect(result.status).toBe(400)
    expect(extractErrorMessage(result.body)).toMatch(
      /cannot impersonate yourself/i,
    )

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5 — API: cannot stack impersonations
  // ──────────────────────────────────────────────────────────────────────────
  test('API: admin cannot start a second impersonation while one is active', async ({
    browser,
  }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `StackAdmin-${tag}`,
      role: 'ADMIN',
    })
    const u1 = await createTestUser({ name: `StackU1-${tag}` })
    const u2 = await createTestUser({ name: `StackU2-${tag}` })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard')

    // Start first impersonation (should succeed).
    const first = await trpcPost(page, 'impersonation.start', {
      userId: u1.id,
    })
    expect(first.status).toBe(200)

    // Attempt second impersonation while first is active.
    const second = await trpcPost(page, 'impersonation.start', {
      userId: u2.id,
    })
    expect(second.status).toBe(400)
    expect(extractErrorMessage(second.body)).toMatch(/already impersonating/i)

    await ctx.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6 — API: stop fails when no impersonation is active
  // ──────────────────────────────────────────────────────────────────────────
  test('API: calling impersonation.stop without an active session returns 400', async ({
    browser,
  }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `StopNoSessionAdmin-${tag}`,
      role: 'ADMIN',
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard')

    const result = await trpcPost(page, 'impersonation.stop', {})

    expect(result.status).toBe(400)
    expect(extractErrorMessage(result.body)).toMatch(
      /not currently impersonating/i,
    )

    await ctx.close()
  })
})
