import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * Hit a tRPC mutation endpoint from inside the page so the session cookie is
 * sent automatically. Used here for the last-admin guard test where we want
 * to assert on the server-side error shape directly.
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

interface TrpcErrorBody {
  error?: {
    message?: string
    json?: { message?: string }
  }
}

function extractErrorMessage(body: unknown): string {
  const b = body as TrpcErrorBody
  return b.error?.json?.message ?? b.error?.message ?? ''
}

test.describe('Role bulk reassign', () => {
  test('users-count cell opens a modal listing every user in the role', async ({
    browser,
  }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `BulkAdmin-${tag}`,
      role: 'ADMIN',
    })
    const role = await db.role.create({
      data: {
        id: `role_blk_${tag.replace(/-/g, '_')}`,
        name: `BulkRole-${tag}`,
        capabilities: [],
        isSystem: false,
      },
    })
    const memberNames = [`Alice-${tag}`, `Bob-${tag}`, `Charlie-${tag}`]
    for (const name of memberNames) {
      await createTestUser({ name, roleId: role.id })
    }

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    const row = page.getByRole('row').filter({ hasText: role.name })
    // The count cell is now a button. Click it to open the modal.
    await row
      .getByRole('button', {
        name: new RegExp(`View 3 users in role ${role.name}`),
      })
      .click()

    const dialog = page.getByRole('dialog', {
      name: new RegExp(`Users in role: ${role.name}`),
    })
    await expect(dialog).toBeVisible()

    for (const name of memberNames) {
      await expect(dialog.getByText(name)).toBeVisible()
    }

    await ctx.close()
  })

  test('select 2, reassign to Admin → counts update and audit rows are written', async ({
    browser,
  }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `MoveAdmin-${tag}`,
      role: 'ADMIN',
    })
    const role = await db.role.create({
      data: {
        id: `role_mv_${tag.replace(/-/g, '_')}`,
        name: `MoveRole-${tag}`,
        capabilities: [],
        isSystem: false,
      },
    })
    const aliceName = `MAlice-${tag}`
    const bobName = `MBob-${tag}`
    const charlieName = `MCharlie-${tag}`
    const alice = await createTestUser({ name: aliceName, roleId: role.id })
    const bob = await createTestUser({ name: bobName, roleId: role.id })
    await createTestUser({ name: charlieName, roleId: role.id })

    // Baseline admin count for the assertion below.
    const adminCountBefore = await db.user.count({
      where: { roleId: 'role_admin' },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    const row = page.getByRole('row').filter({ hasText: role.name })
    await row
      .getByRole('button', {
        name: new RegExp(`View 3 users in role ${role.name}`),
      })
      .click()

    const dialog = page.getByRole('dialog', {
      name: new RegExp(`Users in role: ${role.name}`),
    })
    await expect(dialog).toBeVisible()

    // Tick Alice + Bob (leave Charlie). React Aria's Checkbox wraps the
    // hidden <input> in a <label> + decorative <div>, both of which steal
    // pointer events from each other — Playwright's actionability check
    // refuses without `force`. The accessibility behaviour is still validated
    // (the resulting state is what we assert below).
    await dialog
      .getByRole('checkbox', { name: new RegExp(`Select ${aliceName}`) })
      .click({ force: true })
    await dialog
      .getByRole('checkbox', { name: new RegExp(`Select ${bobName}`) })
      .click({ force: true })

    // Pick Admin as the target.
    await dialog
      .getByLabel('Reassign selected to')
      .selectOption({ label: 'Admin' })

    await dialog.getByRole('button', { name: /^Reassign 2 selected$/ }).click()

    // Modal closes; toast appears.
    await expect(dialog).toBeHidden()

    // Source role's count drops from 3 to 1.
    await expect
      .poll(() => db.user.count({ where: { roleId: role.id } }), {
        timeout: 5_000,
      })
      .toBe(1)

    // Admin role grew by exactly 2.
    await expect
      .poll(() => db.user.count({ where: { roleId: 'role_admin' } }), {
        timeout: 5_000,
      })
      .toBe(adminCountBefore + 2)

    // Two audit rows of type user.role.change for the moved users.
    const audits = await db.auditLog.findMany({
      where: {
        userId: { in: [alice.id, bob.id] },
        action: 'user.role.change',
      },
    })
    expect(audits).toHaveLength(2)
    for (const a of audits) {
      expect(a.metadata).toMatchObject({
        actingUserId: admin.id,
        oldRoleId: role.id,
        newRoleId: 'role_admin',
      })
    }

    // Page should now show "1" in the source role's row.
    const updatedRow = page.getByRole('row').filter({ hasText: role.name })
    await expect(
      updatedRow.getByRole('button', {
        name: new RegExp(`View 1 user in role ${role.name}`),
      }),
    ).toBeVisible()

    await ctx.close()
  })

  test('last-admin guard: cannot reassign all admins out of role_admin', async ({
    browser,
  }) => {
    const tag = uniq()
    // The only Admin in the system is the one we sign in as. Bulk-moving them
    // out of role_admin must error.
    const sole = await createTestUser({
      name: `SoleAdmin-${tag}`,
      role: 'ADMIN',
    })

    // Make sure no other admin user exists in this test DB run by reassigning
    // any leftover admins to role_user. The afterEach snapshot reset isn't
    // 100% clean across spec files in this fixture setup.
    await db.user.updateMany({
      where: { roleId: 'role_admin', NOT: { id: sole.id } },
      data: { roleId: 'role_user' },
    })

    expect(await db.user.count({ where: { roleId: 'role_admin' } })).toBe(1)

    const ctx = await browser.newContext()
    await signInAs(ctx, sole.id)
    const page = await ctx.newPage()
    // Need the page to exist so the cookie is attached and tRPC accepts it.
    await page.goto('/admin/roles')

    const result = await trpcPost(page, 'admin.roles.reassignUsers', {
      fromRoleId: 'role_admin',
      toRoleId: 'role_user',
      userIds: [sole.id],
    })

    expect(result.status).toBeGreaterThanOrEqual(400)
    expect(extractErrorMessage(result.body)).toMatch(/at least one Admin/i)

    // Sole admin still in role_admin.
    const after = await db.user.findUnique({
      where: { id: sole.id },
      select: { roleId: true },
    })
    expect(after?.roleId).toBe('role_admin')

    // No audit rows committed.
    const audits = await db.auditLog.count({
      where: { userId: sole.id, action: 'user.role.change' },
    })
    expect(audits).toBe(0)

    await ctx.close()
  })
})
