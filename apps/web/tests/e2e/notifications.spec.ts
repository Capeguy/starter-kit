import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

test.describe('Admin broadcast notifications', () => {
  test('admin sends a notification to a single user; recipient sees it in the bell', async ({
    browser,
  }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const admin = await createTestUser({
      name: `BroadcastAdmin-${tag}`,
      role: 'ADMIN',
    })
    const recipient = await createTestUser({ name: `BroadcastTarget-${tag}` })

    // Admin: open the broadcast composer, search, pick recipient, submit.
    const adminCtx = await browser.newContext()
    await signInAs(adminCtx, admin.id)
    const adminPage = await adminCtx.newPage()
    await adminPage.goto('/admin/notifications')

    // Pick "Single user" audience → user picker reveals.
    await adminPage.getByLabel('Single user').check()
    const recipientName = recipient.name ?? 'unnamed'
    await adminPage
      .getByPlaceholder('Search by name or email…')
      .fill(recipientName)
    await adminPage
      .getByRole('button', { name: new RegExp(recipientName) })
      .click()

    await adminPage.getByLabel('Title').fill('Hello from e2e')
    await adminPage.getByLabel('Body (optional)').fill('Body content')
    await adminPage.getByRole('button', { name: /Send broadcast/ }).click()

    // Confirm the row landed in the DB before we re-auth as recipient.
    await expect
      .poll(
        () =>
          db.notification.count({
            where: { userId: recipient.id, title: 'Hello from e2e' },
          }),
        { timeout: 5_000 },
      )
      .toBe(1)

    await adminCtx.close()

    // Recipient: navbar bell shows unread badge; opening the panel reveals
    // the new notification.
    const recipientCtx = await browser.newContext()
    await signInAs(recipientCtx, recipient.id)
    const recipientPage = await recipientCtx.newPage()
    await recipientPage.goto('/dashboard')

    const bell = recipientPage.getByRole('button', {
      name: /unread notification/i,
    })
    await expect(bell).toBeVisible()
    await bell.click()
    await expect(recipientPage.getByText('Hello from e2e')).toBeVisible()
    await expect(recipientPage.getByText('Body content')).toBeVisible()

    await recipientCtx.close()
  })

  test('broadcast to "All users" delivers to every user', async ({
    browser,
  }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const admin = await createTestUser({
      name: `BroadcastAllAdmin-${tag}`,
      role: 'ADMIN',
    })
    const u1 = await createTestUser({ name: `AllUser1-${tag}` })
    const u2 = await createTestUser({ name: `AllUser2-${tag}` })

    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/admin/notifications')

    // Default audience is "All users"; just fill and submit.
    await page.getByLabel('Title').fill('Heads up everyone')
    await page.getByRole('button', { name: /Send broadcast/ }).click()

    // Both regular users + the sending admin should receive it (= 3 rows).
    await expect
      .poll(
        () => db.notification.count({ where: { title: 'Heads up everyone' } }),
        { timeout: 5_000 },
      )
      .toBe(3)

    // Each of u1 and u2 should have their own row.
    expect(
      await db.notification.count({
        where: { userId: u1.id, title: 'Heads up everyone' },
      }),
    ).toBe(1)
    expect(
      await db.notification.count({
        where: { userId: u2.id, title: 'Heads up everyone' },
      }),
    ).toBe(1)

    await ctx.close()
  })
})
