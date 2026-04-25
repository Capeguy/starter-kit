/**
 * Helpers for e2e tests that need an authenticated session WITHOUT going
 * through the WebAuthn passkey ceremony. Forges an iron-session cookie
 * keyed by the e2e SESSION_SECRET (set in .env.e2e), inserts the matching
 * User row directly via Prisma, and attaches the cookie to a Playwright
 * BrowserContext.
 *
 * Use this for tests that exercise authed routes/role gating but don't
 * need to validate the passkey UX itself (passkey-auth.spec.ts already
 * covers that end-to-end).
 */
import type { BrowserContext } from '@playwright/test'
import { sealData } from 'iron-session'

import { db } from '@acme/db'

const SESSION_SECRET = 'this-is-a-very-secure-secret-for-e2e-tests'
const COOKIE_NAME = 'auth.session-token'

// Match the seeded role IDs from the RBAC migration. Tests that need a custom
// role can pass `roleId` directly.
const ROLE_ADMIN = 'role_admin'
const ROLE_USER = 'role_user'

interface CreateUserInput {
  name: string
  /** Convenience: 'ADMIN' or 'USER' map to seeded role IDs. */
  role?: 'ADMIN' | 'USER'
  /** Override roleId directly (e.g. for custom-role tests). */
  roleId?: string
}

export const createTestUser = async ({
  name,
  role = 'USER',
  roleId,
}: CreateUserInput) => {
  const finalRoleId = roleId ?? (role === 'ADMIN' ? ROLE_ADMIN : ROLE_USER)
  return db.user.create({
    data: { name, roleId: finalRoleId },
    select: {
      id: true,
      name: true,
      roleId: true,
      role: { select: { name: true } },
    },
  })
}

export const signInAs = async (
  context: BrowserContext,
  userId: string,
  baseUrl = 'http://localhost:3111',
) => {
  const sealed = await sealData(
    { userId },
    {
      password: { '1': SESSION_SECRET },
      ttl: 60 * 60 * 24 * 7,
    },
  )

  // Use `url` (not {domain, path}) — Playwright derives the right domain
  // attributes for localhost more reliably this way, and matches how
  // browsers actually scope the cookie when the dev server sets it.
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: sealed,
      url: baseUrl,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}
