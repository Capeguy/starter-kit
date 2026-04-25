import { expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

test.describe('file.upload capability gating', () => {
  test('USER (no file.upload) sees infobox, not the upload picker', async ({
    browser,
  }) => {
    // Default seeded "User" role has no capabilities at all.
    const u = await createTestUser({ name: `NoUploadUser-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, u.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard/files')

    // The upload picker uses the FilePickerButton which renders a "Upload a
    // file" button. Without the capability, it should not be present.
    await expect(
      page.getByRole('button', { name: /Upload a file/i }),
    ).toHaveCount(0)
    // The explanatory infobox is shown instead.
    await expect(page.getByText(/file\.upload.*capability/i)).toBeVisible()

    await ctx.close()
  })

  test('USER granted file.upload via custom role sees the upload picker', async ({
    browser,
  }) => {
    const tag = uniq()
    const role = await db.role.create({
      data: {
        id: `role_uploaders_${tag.replace(/-/g, '_')}`,
        name: `Uploaders-${tag}`,
        capabilities: ['file.upload'],
      },
    })
    const u = await createTestUser({
      name: `UploaderUser-${tag}`,
      roleId: role.id,
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, u.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard/files')

    await expect(
      page.getByRole('button', { name: /Upload a file/i }),
    ).toBeVisible()
    // Infobox should NOT be present when we can upload.
    await expect(page.getByText(/file\.upload.*capability/i)).toHaveCount(0)

    await ctx.close()
  })

  test('/api/upload/file returns 403 without file.upload capability', async ({
    browser,
  }) => {
    const u = await createTestUser({ name: `Api403User-${uniq()}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, u.id)
    const page = await ctx.newPage()

    // Build a tiny multipart request from inside the page (carries the cookie).
    const result = await page.evaluate(async () => {
      const form = new FormData()
      form.append('file', new Blob(['hi'], { type: 'text/plain' }), 'tiny.txt')
      const res = await fetch('/api/upload/file', {
        method: 'POST',
        body: form,
      })
      const body = (await res.json()) as { error?: string }
      return { status: res.status, body }
    })

    expect(result.status).toBe(403)
    expect(result.body.error).toMatch(/file\.upload/i)

    await ctx.close()
  })

  test('admin (seeded Admin role grants file.upload) sees the picker', async ({
    browser,
  }) => {
    // Doesn't actually upload — the live-blob round-trip is covered by
    // file-upload.spec.ts. We just assert the seeded Admin role's capability
    // set unlocks the picker the same way a custom role does.
    const admin = await createTestUser({
      name: `BlobAdmin-${uniq()}`,
      role: 'ADMIN',
    })
    const ctx = await browser.newContext()
    await signInAs(ctx, admin.id)
    const page = await ctx.newPage()
    await page.goto('/dashboard/files')

    await expect(
      page.getByRole('button', { name: /Upload a file/i }),
    ).toBeVisible()

    await ctx.close()
  })
})
