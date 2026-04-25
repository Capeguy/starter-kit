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

    // First click triggers the auth ceremony; with no passkey on the virtual
    // authenticator the browser throws NotAllowedError and the UI falls
    // through to the "needs name" step.
    await page.getByRole('button', { name: 'Continue with Passkey' }).click()

    await page.getByLabel('Your name').fill('E2E Test User')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
  })
})
