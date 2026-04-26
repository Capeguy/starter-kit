import { request as apiRequest, expect } from '@playwright/test'

import { db } from '@acme/db'

import { test } from './app-fixture'
import { createTestUser, signInAs } from './setup/auth'
import { takeDbSnapshot } from './setup/db-setup'

const BASE_URL = 'http://localhost:3111'

const newApiContext = () =>
  apiRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: {} })

const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/**
 * Defensive: the e2e applyMigrations short-circuits when the User table
 * already exists, so a container that was previously snapshotted by another
 * worktree won't have the ApiToken table. Apply the migration manually here
 * (idempotent — IF NOT EXISTS) and re-take the snapshot so afterEach's
 * resetDbToSnapshot doesn't drop our table between tests.
 */
test.beforeAll(async ({ databaseContainer }) => {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "vibe_stack"."ApiToken" (
      "id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "token_hash" TEXT NOT NULL,
      "prefix" TEXT NOT NULL,
      "last_used_at" TIMESTAMPTZ(3),
      "expires_at" TIMESTAMPTZ(3),
      "revoked_at" TIMESTAMPTZ(3),
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
    );
  `)
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_token_hash_key" ON "vibe_stack"."ApiToken"("token_hash");`,
  )
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ApiToken_user_id_revoked_at_idx" ON "vibe_stack"."ApiToken"("user_id", "revoked_at");`,
  )
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      ALTER TABLE "vibe_stack"."ApiToken"
        ADD CONSTRAINT "ApiToken_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$;
  `)
  // Enable the MCP server in the snapshot. The route returns 404 when
  // mcp.enabled is off, which would break tests/list / tools/call below.
  // (Per-tool flags default-on when the row is absent, so we don't need
  // to insert a row per tool.)
  await db.featureFlag.upsert({
    where: { key: 'mcp.enabled' },
    update: { enabled: true, rolloutPercent: 100 },
    create: {
      key: 'mcp.enabled',
      enabled: true,
      rolloutPercent: 100,
      allowedUserIds: [],
      name: 'MCP server',
      description: 'MCP server endpoint accepts requests',
    },
  })

  // Re-snapshot AFTER our DDL + flag insert, so the per-test
  // resetDbToSnapshot in app-fixture afterEach restores to a state that
  // includes ApiToken AND the mcp.enabled flag.
  await takeDbSnapshot(databaseContainer)
})

test.describe('Personal API tokens + REST + MCP', () => {
  test('mint → /api/v1/me + MCP works → revoke → 401', async ({ browser }) => {
    const t = tag()
    const user = await createTestUser({ name: `ApiTokenE2E-${t}` })
    const ctx = await browser.newContext()
    await signInAs(ctx, user.id)
    const page = await ctx.newPage()

    // 1) Mint a token via the settings UI; assert plaintext is shown once.
    await page.goto('/dashboard/settings')

    await page.getByRole('button', { name: 'New token' }).click()
    await page.getByLabel('Name').fill(`E2E ${t}`)
    await page.getByRole('radio', { name: '7 days' }).click()
    await page.getByRole('button', { name: 'Create token' }).click()

    // The plaintext appears in a textarea (read-only). Assert the format and
    // capture the value for the rest of the spec.
    const tokenInput = page.getByLabel('Personal API token plaintext')
    await expect(tokenInput).toBeVisible()
    const plaintext = (await tokenInput.inputValue()).trim()
    expect(plaintext).toMatch(/^vibe_pat_[A-Za-z0-9_-]{24}$/)

    // 2) Use the plaintext for /api/v1/me — expect 200 with our identity.
    const apiCtx = await newApiContext()
    const meRes = await apiCtx.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${plaintext}` },
    })
    expect(meRes.status()).toBe(200)
    const meBody = (await meRes.json()) as {
      id: string
      name: string | null
      role: { name: string }
    }
    expect(meBody.id).toBe(user.id)
    expect(meBody.name).toBe(user.name)

    // 3) MCP tools/list returns three tools.
    const listRes = await apiCtx.post('/api/mcp', {
      headers: {
        Authorization: `Bearer ${plaintext}`,
        'Content-Type': 'application/json',
      },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(listRes.status()).toBe(200)
    const listBody = (await listRes.json()) as {
      result: { tools: { name: string }[] }
    }
    expect(listBody.result.tools.map((tool) => tool.name).sort()).toEqual([
      'get_my_profile',
      'list_my_files',
      'list_my_notifications',
    ])

    // 4) MCP tools/call get_my_profile — content includes our identity.
    const callRes = await apiCtx.post('/api/mcp', {
      headers: {
        Authorization: `Bearer ${plaintext}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_my_profile', arguments: {} },
      },
    })
    expect(callRes.status()).toBe(200)
    const callBody = (await callRes.json()) as {
      result: { content: { type: string; text: string }[] }
    }
    const contentText = callBody.result.content[0]?.text ?? '{}'
    const profile = JSON.parse(contentText) as {
      id: string
      name: string | null
    }
    expect(profile.id).toBe(user.id)
    expect(profile.name).toBe(user.name)

    // 5) Revoke the token via UI; the same plaintext is then 401.
    await page.reload()
    await page
      .getByRole('row', { name: new RegExp(`E2E ${t}`) })
      .getByRole('button', { name: 'Revoke' })
      .click()

    // Wait for the row to flip to "Revoked" status before re-fetching.
    await expect(
      page
        .getByRole('row', { name: new RegExp(`E2E ${t}`) })
        .getByText('Revoked'),
    ).toBeVisible()

    const meAfterRevoke = await apiCtx.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${plaintext}` },
    })
    expect(meAfterRevoke.status()).toBe(401)

    // 6) Bearer with a clearly-invalid token is also 401.
    const meWithBogus = await apiCtx.get('/api/v1/me', {
      headers: { Authorization: 'Bearer vibe_pat_invalidvalueinvalidvalu' },
    })
    expect(meWithBogus.status()).toBe(401)

    await ctx.close()
    await apiCtx.dispose()
  })
})
