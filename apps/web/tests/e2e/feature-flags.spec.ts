import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

interface TrpcQueryResponse<T> {
  result?: { data: { json: T } }
  error?: { message: string }
}

/**
 * Call a tRPC query endpoint from inside the browser page so the session
 * cookie is automatically sent. tRPC's GET protocol expects the input as a
 * URL-encoded JSON-with-superjson `{ "0": { "json": <input> } }` payload
 * inside the `?input=...` query string when batching is on; the simpler
 * single-call shape used here matches the basic httpLink (no batch).
 */
async function trpcGet(page: Page, path: string, input: unknown) {
  return page.evaluate(
    async ([p, i]: [string, unknown]) => {
      const inputParam = encodeURIComponent(JSON.stringify({ json: i }))
      const res = await fetch(`/api/trpc/${p}?input=${inputParam}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = (await res.json()) as unknown
      return { status: res.status, body }
    },
    [path, input] as [string, unknown],
  )
}

const evaluateFlag = async (page: Page, key: string) => {
  const res = await trpcGet(page, 'featureFlag.evaluate', { key })
  expect(res.status, `evaluate(${key}) status`).toBe(200)
  const body = res.body as TrpcQueryResponse<{ enabled: boolean }>
  expect(body.error, `evaluate(${key}) tRPC error`).toBeUndefined()
  return body.result?.data.json.enabled ?? false
}

test.describe('/admin/feature-flags', () => {
  test('admin creates a flag, evaluates as themselves, then toggles it via the inline switch', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `FlagAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const flagKey = `e2e.flag.${uniq()}`.toLowerCase().replace(/-/g, '_')

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/feature-flags')

    // Open the create modal and fill it in. Start enabled at 0% rollout —
    // we'll bump the toggle/percent in subsequent tests.
    await page.getByRole('button', { name: 'New flag' }).click()
    const dialog = page.getByRole('dialog', { name: /Create feature flag/ })
    await dialog.getByLabel('Key').fill(flagKey)
    await dialog.getByLabel('Name').fill(`E2E flag ${flagKey}`)
    await dialog.getByLabel('Description (optional)').fill('Created by e2e')
    // Leave enabled=off and rollout=0 — this gives us a deterministic baseline.
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(dialog).toBeHidden()

    // The new row appears in the table.
    const row = page.getByRole('row').filter({ hasText: flagKey })
    await expect(row).toBeVisible()

    // DB shape matches what the form submitted.
    const created = await db.featureFlag.findUnique({
      where: { key: flagKey },
    })
    expect(created).toMatchObject({
      key: flagKey,
      name: `E2E flag ${flagKey}`,
      description: 'Created by e2e',
      enabled: false,
      rolloutPercent: 0,
      allowedUserIds: [],
    })

    // While the flag is off, evaluation returns false.
    expect(await evaluateFlag(page, flagKey)).toBe(false)

    // Flip the inline toggle on — page should optimistically/eagerly refetch
    // after the mutation. Wait for DB to confirm before re-evaluating.
    // OUI's Toggle wraps a real <input role="switch"> in a label; the
    // visual span intercepts pointer events. Use { force: true } to bypass
    // Playwright's actionability check and dispatch the click directly.
    await row.getByRole('switch', { name: /Toggle/ }).click({ force: true })
    await expect
      .poll(
        () =>
          db.featureFlag
            .findUnique({ where: { key: flagKey } })
            .then((f) => f?.enabled),
        { timeout: 5_000 },
      )
      .toBe(true)

    // Even with enabled=true, rolloutPercent=0 and the user not in the
    // allowlist → still false.
    expect(await evaluateFlag(page, flagKey)).toBe(false)

    await ctx.close()
  })

  test('rolloutPercent=100 returns true for any authenticated user; 0 returns false', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `RolloutAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    // Seed the two flags directly so the test stays focused on the eval surface.
    const onKey = `e2e.rollout.on.${tag}`.toLowerCase().replace(/-/g, '_')
    const offKey = `e2e.rollout.off.${tag}`.toLowerCase().replace(/-/g, '_')
    await db.featureFlag.create({
      data: {
        key: onKey,
        name: 'Always on',
        enabled: true,
        rolloutPercent: 100,
        allowedUserIds: [],
      },
    })
    await db.featureFlag.create({
      data: {
        key: offKey,
        name: 'Always off',
        enabled: true,
        rolloutPercent: 0,
        allowedUserIds: [],
      },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/feature-flags')

    expect(await evaluateFlag(page, onKey)).toBe(true)
    expect(await evaluateFlag(page, offKey)).toBe(false)

    await ctx.close()
  })

  test('allowlist always-on overrides 0% rollout', async ({ browser }) => {
    const admin = await createTestUser({
      name: `AllowlistAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    const flagKey = `e2e.allow.${tag}`.toLowerCase().replace(/-/g, '_')
    await db.featureFlag.create({
      data: {
        key: flagKey,
        name: 'Allowlist override',
        enabled: true,
        rolloutPercent: 0,
        allowedUserIds: [admin.id],
      },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/feature-flags')

    expect(await evaluateFlag(page, flagKey)).toBe(true)

    await ctx.close()
  })

  test('non-admin USER cannot reach /admin/feature-flags', async ({
    browser,
  }) => {
    const user = await createTestUser({ name: `NonAdminFlags-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/admin/feature-flags')
    await expect(page).toHaveURL(/\/dashboard$/)

    await ctx.close()
  })

  test('admin deletes a flag and the row disappears', async ({ browser }) => {
    const admin = await createTestUser({
      name: `DeleteFlagAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    const flagKey = `e2e.delete.${tag}`.toLowerCase().replace(/-/g, '_')
    await db.featureFlag.create({
      data: {
        key: flagKey,
        name: 'To delete',
        enabled: true,
        rolloutPercent: 50,
        allowedUserIds: [],
      },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/feature-flags')

    const row = page.getByRole('row').filter({ hasText: flagKey })
    await expect(row).toBeVisible()

    // Auto-confirm the window.confirm() prompt.
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: 'Delete' }).click()

    // Wait for the DB to reflect the delete; then assert the row is gone.
    await expect
      .poll(
        () =>
          db.featureFlag
            .findUnique({ where: { key: flagKey } })
            .then((f) => f === null),
        { timeout: 5_000 },
      )
      .toBe(true)
    await expect(row).toBeHidden()

    await ctx.close()
  })
})
