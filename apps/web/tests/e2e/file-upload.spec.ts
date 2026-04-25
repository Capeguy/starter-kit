import { request as apiRequest, expect } from '@playwright/test'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'

// Vercel Blob requires BLOB_READ_WRITE_TOKEN to be set; .env.e2e has none
// by default. Skip when absent so CI runs aren't blocked on external infra.
const BLOB_TOKEN_PRESENT =
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  !!process.env.BLOB_READ_WRITE_TOKEN

test.describe('File upload flow', () => {
  test.skip(
    !BLOB_TOKEN_PRESENT,
    'BLOB_READ_WRITE_TOKEN is not set — skipping (set in .env.e2e to enable)',
  )

  test('upload preserves filename on download', async ({ browser }) => {
    const user = await createTestUser({ name: 'FileOwner' })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    await page.goto('/dashboard/files')

    // Replay the cookie so the API request runs as this user.
    const cookies = await ctx.cookies()
    const apiCtx = await apiRequest.newContext({
      baseURL: 'http://localhost:3111',
      extraHTTPHeaders: {
        cookie: cookies
          .filter((c) => c.name === 'auth.session-token')
          .map((c) => `${c.name}=${c.value}`)
          .join('; '),
      },
    })

    const filename = `e2e-${Date.now()}.txt`
    const uploadRes = await apiCtx.post('/api/upload/file', {
      multipart: {
        file: {
          name: filename,
          mimeType: 'text/plain',
          buffer: Buffer.from('hello from e2e\n'),
        },
      },
    })
    expect(uploadRes.status()).toBe(200)
    const uploadJson = (await uploadRes.json()) as {
      filename: string
      url: string
    }
    expect(uploadJson.filename).toBe(filename)

    await page.reload()
    await expect(page.getByRole('link', { name: filename })).toBeVisible()

    // Stored URL is downloadUrl which carries Content-Disposition with the
    // original filename — the actual fix shipped earlier.
    const dlRes = await apiCtx.get(uploadJson.url)
    expect(dlRes.status()).toBe(200)
    const cd = dlRes.headers()['content-disposition'] ?? ''
    expect(cd, `Content-Disposition: ${cd}`).toContain(filename)

    await ctx.close()
  })
})
