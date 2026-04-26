import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * The seeded admin role gains `user.invite.issue` via a recent migration.
 * When the e2e Testcontainer is reused across runs, applyMigrations short-
 * circuits on the existing schema and skips newer migrations — leaving the
 * capability missing. Defensively grant it here so the issue button surfaces.
 * The afterEach snapshot reset reverts this between tests, so it's a no-op
 * for specs that don't need it.
 *
 * Same workaround pattern is used by audit-user-resolution.spec.ts for
 * `user.impersonate`.
 */
const grantInviteIssueToAdmin = async () => {
  const role = await db.role.findUnique({ where: { id: 'role_admin' } })
  if (!role) return
  if (role.capabilities.includes('user.invite.issue')) return
  await db.role.update({
    where: { id: 'role_admin' },
    data: { capabilities: [...role.capabilities, 'user.invite.issue'] },
  })
}

test.describe('Admin invite flow', () => {
  // ──────────────────────────────────────────────────────────────────────
  // Test 1 — full happy path: admin issues invite → fresh recipient claims
  // it with a passkey → lands on /dashboard with the assigned role.
  // ──────────────────────────────────────────────────────────────────────
  test('admin issues invite → recipient registers passkey → signed in with assigned role', async ({
    browser,
  }) => {
    const tag = uniq()
    await grantInviteIssueToAdmin()
    const admin = await createTestUser({
      name: `InviteAdmin-${tag}`,
      role: 'ADMIN',
    })

    // Seed a custom role so we can verify the new user lands with exactly the
    // pre-assigned role (and not the default `role_user`).
    const customRoleId = `role_invited_${tag.replace(/-/g, '_')}`
    const customRoleName = `Invited-${tag}`
    await db.role.create({
      data: {
        id: customRoleId,
        name: customRoleName,
        capabilities: ['admin.access', 'user.list'],
        isSystem: false,
      },
    })

    // Admin context: open invites page, fill modal, copy URL.
    const adminCtx = await browser.newContext()
    await signInAs(adminCtx, admin.id)
    const adminPage = await adminCtx.newPage()
    await adminPage.goto('/admin/users')
    await expect(
      adminPage.getByRole('heading', { name: 'Invites' }),
    ).toBeVisible()

    await adminPage.getByRole('button', { name: 'New invite' }).click()

    const dialog = adminPage.getByRole('dialog', { name: /New invite/ })
    await dialog.getByLabel('Name (optional)').fill('Invited User')
    await dialog.getByLabel('Email (optional)').fill('invited@example.com')
    await dialog.getByLabel('Role').selectOption(customRoleId)
    await dialog.getByRole('button', { name: 'Generate invite link' }).click()

    // Wait for the URL to render in the success view.
    const urlField = dialog.locator('textarea[readonly]')
    await expect(urlField).toBeVisible({ timeout: 10_000 })
    const inviteUrl = (await urlField.inputValue()).trim()
    expect(inviteUrl).toContain('/invite/')

    // Confirm the DB has the row.
    const token = inviteUrl.split('/invite/').pop() ?? ''
    expect(token.length).toBeGreaterThan(0)
    const inviteRow = await db.invite.findUnique({
      where: { token },
      select: {
        roleId: true,
        consumedAt: true,
        revokedAt: true,
        name: true,
        email: true,
      },
    })
    expect(inviteRow).toMatchObject({
      roleId: customRoleId,
      consumedAt: null,
      revokedAt: null,
      name: 'Invited User',
      email: 'invited@example.com',
    })

    // Audit row for the issue.
    await expect
      .poll(
        () =>
          db.auditLog.count({
            where: { userId: admin.id, action: 'user.invite.issue' },
          }),
        { timeout: 5_000 },
      )
      .toBe(1)

    await adminCtx.close()

    // Recipient context: fresh browser context (no admin cookie). Open the
    // invite URL, register a passkey via the virtual authenticator, expect
    // to land on /dashboard.
    const recipientCtx = await browser.newContext()
    const recipientPage = await recipientCtx.newPage()
    const cdp = await recipientPage.context().newCDPSession(recipientPage)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })

    await recipientPage.goto(inviteUrl)
    await expect(
      recipientPage.getByRole('heading', { name: /Accept your invite/ }),
    ).toBeVisible()

    const recipientName = `RecipientUser-${tag}`
    await recipientPage.getByLabel('Your name').fill(recipientName)
    await recipientPage
      .getByRole('button', { name: /Register passkey/ })
      .click()

    await expect(recipientPage).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    // The newly-created user should have the pre-assigned custom role.
    const claimedUser = await db.user.findUnique({
      where: { name: recipientName },
      select: {
        id: true,
        roleId: true,
        email: true,
        _count: { select: { passkeys: true, accounts: true } },
      },
    })
    expect(claimedUser).not.toBeNull()
    expect(claimedUser?.roleId).toBe(customRoleId)
    // Email is populated from the invite pre-fill.
    expect(claimedUser?.email).toBe('invited@example.com')
    expect(claimedUser?._count.passkeys).toBe(1)
    expect(claimedUser?._count.accounts).toBe(1)

    // Invite is now consumed and FK'd to the new user.
    const consumed = await db.invite.findUnique({
      where: { token },
      select: { consumedAt: true, claimedByUserId: true },
    })
    expect(consumed?.consumedAt).not.toBeNull()
    expect(consumed?.claimedByUserId).toBe(claimedUser?.id)

    // Audit row for the claim, owned by the new user.
    await expect
      .poll(
        () =>
          db.auditLog.count({
            where: { userId: claimedUser?.id, action: 'user.invite.claim' },
          }),
        { timeout: 5_000 },
      )
      .toBe(1)

    await recipientCtx.close()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Test 2 — revoked invite link rejects the recipient.
  // ──────────────────────────────────────────────────────────────────────
  test('revoking an active invite makes the link unusable', async ({
    browser,
  }) => {
    const tag = uniq()
    await grantInviteIssueToAdmin()
    const admin = await createTestUser({
      name: `InviteRevokeAdmin-${tag}`,
      role: 'ADMIN',
    })

    // Seed an invite directly (skip the modal — covered by test 1).
    const invite = await db.invite.create({
      data: {
        token: `revokable-${tag}`,
        name: 'To Revoke',
        email: null,
        roleId: 'role_user',
        issuedById: admin.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    // Admin opens /admin/users, hits Revoke on the row.
    const adminCtx = await browser.newContext()
    await signInAs(adminCtx, admin.id)
    const adminPage = await adminCtx.newPage()
    adminPage.on('dialog', (d) => d.accept())
    await adminPage.goto('/admin/users')
    const row = adminPage.getByRole('row').filter({ hasText: 'To Revoke' })
    await row.getByRole('button', { name: 'Revoke' }).click()

    // Status flips to "Revoked" in the DB.
    await expect
      .poll(
        async () =>
          (await db.invite.findUnique({ where: { id: invite.id } }))
            ?.revokedAt !== null,
        { timeout: 5_000 },
      )
      .toBe(true)

    await adminCtx.close()

    // Recipient hitting the URL gets the not-found error in the public flow.
    const recipientCtx = await browser.newContext()
    const recipientPage = await recipientCtx.newPage()
    await recipientPage.goto(`/invite/${invite.token}`)
    // Try to start; the start mutation should reject because the invite is revoked.
    await recipientPage.getByLabel('Your name').fill(`RevokedRecipient-${tag}`)
    await recipientPage
      .getByRole('button', { name: /Register passkey/ })
      .click()

    await expect(
      recipientPage.getByText(/invalid|already been used/i),
    ).toBeVisible({ timeout: 10_000 })

    // No new user was created for the revoked invite.
    const sneakUser = await db.user.findUnique({
      where: { name: `RevokedRecipient-${tag}` },
    })
    expect(sneakUser).toBeNull()

    await recipientCtx.close()
  })

  // ──────────────────────────────────────────────────────────────────────
  // Test 3 — capability gate: regular user cannot reach /admin/users
  // and cannot call the API even if they bypass the UI.
  // ──────────────────────────────────────────────────────────────────────
  test('user without user.invite.issue cannot reach /admin/users or call invites.issue', async ({
    browser,
  }) => {
    const tag = uniq()
    const user = await createTestUser({ name: `NoInviteCap-${tag}` })

    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    // /admin/* gates on admin.access — user gets bounced to /dashboard.
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/dashboard$/)

    // Direct API call rejected with 403 (FORBIDDEN).
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/trpc/admin.invites.issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            name: 'should not work',
            email: null,
            roleId: 'role_user',
            expiresInSeconds: 3600,
          },
        }),
      })
      return { status: res.status }
    })
    expect(result.status).toBe(403)

    await ctx.close()
  })
})
