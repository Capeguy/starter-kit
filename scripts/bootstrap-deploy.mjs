#!/usr/bin/env node
/**
 * pnpm bootstrap:deploy
 *
 * Final-step deploy after `bootstrap:vercel` + `bootstrap:sentry` +
 * `bootstrap:blob`. Bakes the Sentry DSN + BLOB_READ_WRITE_TOKEN that the
 * later steps added into the production bundle.
 *
 * Wraps `vercel deploy --prod --yes` with auto-retry on Prisma's `P1002 —
 * Timed out trying to acquire a postgres advisory lock` failure, which fires
 * deterministically when env-var pushes from the prior steps have triggered
 * background preview deploys holding the migrate lock. Up to 3 retries with
 * 30s spacing — typically clears on attempt 1 retry.
 */
import path from 'node:path'

import { deployWithRetry } from './_lib/deploy-with-retry.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')

await deployWithRetry({ cwd: ROOT })
console.log()
console.log('✓ bootstrap-deploy done')
