import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe('/admin/roles CRUD', () => {
  test('admin sees seeded Admin + User roles in the list', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `RolesViewer-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    // Both seeded system roles are present and labelled "System role"
    // inside the table (not in the page header copy that also mentions
    // "System roles…").
    await expect(page.getByRole('cell', { name: /^Admin/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: /^User/ })).toBeVisible()
    const systemTagsInTable = page
      .getByRole('table')
      .getByText('System role', { exact: true })
    await expect(systemTagsInTable).toHaveCount(2)

    await ctx.close()
  })

  test('admin creates a custom role with selected capabilities', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `RolesCreator-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    const newRoleName = `Editor-${tag}`

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    await page.getByRole('button', { name: 'New role' }).click()

    // Modal opens with name + description + capability checkboxes.
    const dialog = page.getByRole('dialog', { name: /Create role/ })
    await dialog.getByLabel('Name').fill(newRoleName)
    await dialog
      .getByLabel('Description (optional)')
      .fill('e2e-created custom role')
    // Grant exactly one capability so the assertion below is unambiguous.
    await dialog.getByRole('checkbox', { name: 'audit.read' }).check()
    await dialog.getByRole('button', { name: 'Create' }).click()

    // Modal closes; the new role appears in the list.
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('cell', { name: newRoleName })).toBeVisible()

    // DB shape matches what we expect.
    const created = await db.role.findFirst({
      where: { name: newRoleName },
      select: { isSystem: true, capabilities: true, description: true },
    })
    expect(created).toMatchObject({
      isSystem: false,
      description: 'e2e-created custom role',
      capabilities: ['audit.read'],
    })

    await ctx.close()
  })

  test('admin edits a role to add and remove capabilities', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `RolesEditor-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    const roleName = `Mutable-${tag}`
    // Seed a custom role we can edit. Use a deterministic id for cleanup.
    const role = await db.role.create({
      data: {
        id: `role_mutable_${tag.replace(/-/g, '_')}`,
        name: roleName,
        capabilities: ['audit.read'],
        isSystem: false,
      },
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    // Click "Edit" on the row whose name cell is our role.
    const row = page.getByRole('row').filter({ hasText: roleName })
    await row.getByRole('button', { name: 'Edit' }).click()

    const dialog = page.getByRole('dialog', { name: new RegExp(roleName) })
    // audit.read should already be ticked; remove it and add user.list.
    await dialog.getByRole('checkbox', { name: 'audit.read' }).uncheck()
    await dialog.getByRole('checkbox', { name: 'user.list' }).check()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    const updated = await db.role.findUnique({
      where: { id: role.id },
      select: { capabilities: true },
    })
    expect(updated?.capabilities).toEqual(['user.list'])

    await ctx.close()
  })

  test('system roles cannot be deleted (delete button disabled)', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `SystemDeleteAttempt-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    // The seeded "Admin" row's Delete button is disabled.
    const adminRow = page.getByRole('row').filter({ hasText: /^Admin/ })
    await expect(
      adminRow.getByRole('button', { name: 'Delete' }),
    ).toBeDisabled()

    await ctx.close()
  })

  test('role with assigned members cannot be deleted (button disabled)', async ({
    browser,
  }) => {
    const admin = await createTestUser({
      name: `RoleWithMembersDeleter-${uniq()}`,
      role: 'ADMIN',
    })
    const tag = uniq()
    const roleName = `Populated-${tag}`
    const role = await db.role.create({
      data: {
        id: `role_populated_${tag.replace(/-/g, '_')}`,
        name: roleName,
        capabilities: [],
        isSystem: false,
      },
    })
    // Assign the role to a fresh user.
    await createTestUser({
      name: `MemberOfPopulated-${tag}`,
      roleId: role.id,
    })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/roles')

    const row = page.getByRole('row').filter({ hasText: roleName })
    // Member count cell shows 1.
    await expect(row).toContainText('1')
    await expect(row.getByRole('button', { name: 'Delete' })).toBeDisabled()

    await ctx.close()
  })

  test('non-admin USER cannot reach /admin/roles', async ({ browser }) => {
    const user = await createTestUser({ name: `NonAdminRoles-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/admin/roles')
    await expect(page).toHaveURL(/\/dashboard$/)

    await ctx.close()
  })
})
