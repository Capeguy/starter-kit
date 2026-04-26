import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * The seeded admin role gains `user.impersonate` via a recent migration. When
 * the e2e Testcontainer is reused across runs, applyMigrations short-circuits
 * on the existing schema and skips newer migrations — leaving the cap missing.
 * Defensively grant it here so the impersonation UI surfaces the button.
 * The afterEach snapshot reset reverts this between tests, so it's a no-op for
 * specs that don't need it.
 */
const grantImpersonateToAdmin = async () => {
  const role = await db.role.findUnique({ where: { id: 'role_admin' } })
  if (!role) return
  if (role.capabilities.includes('user.impersonate')) return
  await db.role.update({
    where: { id: 'role_admin' },
    data: { capabilities: [...role.capabilities, 'user.impersonate'] },
  })
}

test.describe('Audit log resolves metadata user-ids to clickable names', () => {
  // Shared setup: admin impersonates targetUser via the UI, then stops. This
  // produces two audit rows owned by the admin:
  //   user.impersonate.start  metadata.targetUserId       = targetUser.id
  //   user.impersonate.stop   metadata.impersonatedUserId = targetUser.id
  //
  // The /dashboard "Recent activity" panel uses audit.listMine (self
  // perspective); /admin/audit uses audit.list (admin perspective). Both
  // render via `formatAuditEvent` and should resolve the user-id refs to
  // the target's name with a link to /admin/users/<targetUser.id>.

  test('dashboard recent activity renders impersonation start/stop with target name as link', async ({
    browser,
  }) => {
    const tag = uniq()
    const adminName = `AuditResAdmin-${tag}`
    const targetName = `AuditResTarget-${tag}`
    await grantImpersonateToAdmin()
    const admin = await createTestUser({ name: adminName, role: 'ADMIN' })
    const target = await createTestUser({ name: targetName })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    // Drive the impersonation flow through the UI to mirror real usage.
    await page.goto('/admin/users')
    const targetRow = page.getByRole('row').filter({ hasText: targetName })
    await targetRow.getByRole('button', { name: 'Impersonate' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    // Stop impersonation from the banner — emits the second audit event.
    const banner = page.getByRole('status')
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Stop impersonation' }).click()
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10_000 })

    // Sanity-check the rows landed in the DB before we assert on the UI —
    // avoids flakes where the dashboard polls before the writes commit.
    await expect
      .poll(
        () =>
          db.auditLog.count({
            where: {
              userId: admin.id,
              action: {
                in: ['user.impersonate.start', 'user.impersonate.stop'],
              },
            },
          }),
        { timeout: 5_000 },
      )
      .toBe(2)

    // Visit the dashboard and switch to the Activity tab.
    await page.goto('/dashboard')
    await page.getByRole('tab', { name: 'Activity' }).click()

    const activityPanel = page.getByRole('tabpanel', { name: 'Activity' })

    // Stop event ("You stopped impersonating <name>"). The literal "user <id>"
    // fallback must NOT appear — the resolution should have produced the name.
    const stopItem = activityPanel
      .getByRole('listitem')
      .filter({ hasText: /You stopped impersonating/ })
    await expect(stopItem).toContainText(targetName)
    await expect(stopItem).not.toContainText(`user ${target.id}`)
    const stopLink = stopItem.getByRole('link', { name: targetName })
    await expect(stopLink).toHaveAttribute('href', `/admin/users/${target.id}`)

    // Start event ("You started impersonating <name>")
    const startItem = activityPanel
      .getByRole('listitem')
      .filter({ hasText: /You started impersonating/ })
    await expect(startItem).toContainText(targetName)
    await expect(startItem).not.toContainText(`user ${target.id}`)
    const startLink = startItem.getByRole('link', { name: targetName })
    await expect(startLink).toHaveAttribute('href', `/admin/users/${target.id}`)

    await ctx.close()
  })

  test('admin audit log renders impersonation row with target name as link', async ({
    browser,
  }) => {
    const tag = uniq()
    const adminName = `AuditResAdmin2-${tag}`
    const targetName = `AuditResTarget2-${tag}`
    await grantImpersonateToAdmin()
    const admin = await createTestUser({ name: adminName, role: 'ADMIN' })
    const target = await createTestUser({ name: targetName })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    await page.goto('/admin/users')
    const targetRow = page.getByRole('row').filter({ hasText: targetName })
    await targetRow.getByRole('button', { name: 'Impersonate' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })

    const banner = page.getByRole('status')
    await banner.getByRole('button', { name: 'Stop impersonation' }).click()
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 10_000 })

    await expect
      .poll(
        () =>
          db.auditLog.count({
            where: { userId: admin.id, action: 'user.impersonate.stop' },
          }),
        { timeout: 5_000 },
      )
      .toBe(1)

    // /admin/audit (audit.list, admin perspective). Row text format:
    // "<adminName> stopped impersonating <targetName>"
    await page.goto('/admin/audit')
    const stopRow = page
      .getByRole('row')
      .filter({ hasText: /stopped impersonating/ })
      .filter({ hasText: adminName })
    await expect(stopRow).toContainText(targetName)
    await expect(stopRow).not.toContainText(`user ${target.id}`)
    const link = stopRow.getByRole('link', { name: targetName })
    await expect(link).toHaveAttribute('href', `/admin/users/${target.id}`)

    await ctx.close()
  })

  test('falls back to literal "user <id>" when referenced user does not exist', async ({
    browser,
  }) => {
    const tag = uniq()
    const admin = await createTestUser({
      name: `AuditResMissing-${tag}`,
      role: 'ADMIN',
    })

    // A cuid-shaped id that is guaranteed not to exist in the User table.
    // The audit pipeline doesn't FK-validate metadata, so this is the simplest
    // way to simulate a referenced-then-deleted user without race conditions.
    const ghostId = `ghost${tag.replace(/-/g, '')}`

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: 'user.impersonate.stop',
        metadata: { impersonatedUserId: ghostId },
      },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard')
    await page.getByRole('tab', { name: 'Activity' }).click()
    const activityPanel = page.getByRole('tabpanel', { name: 'Activity' })

    // Page renders without crashing and contains the literal "user <id>"
    // fallback text — proving graceful handling of unresolved refs.
    const item = activityPanel
      .getByRole('listitem')
      .filter({ hasText: /You stopped impersonating/ })
    await expect(item).toContainText(`user ${ghostId}`)

    await ctx.close()
  })
})
