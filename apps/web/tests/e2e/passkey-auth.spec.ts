import { expect } from '@playwright/test'

import { test } from './app-fixture'

test.describe('Passkey Authentication', () => {
  test('registers a new account with a passkey and redirects to /admin', async ({
    page,
  }) => {
    // Virtual authenticator via CDP: makes navigator.credentials.create/get work headlessly.
    const client = await page.context().newCDPSession(page)
    await client.send('WebAuthn.enable')
    await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })

    await page.goto('/sign-in')
    await page.getByRole('button', { name: 'Create New Account' }).click()

    await page.getByLabel('Your name').fill('E2E Test User')
    await page.getByRole('button', { name: 'Create Passkey' }).click()

    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
  })
})
