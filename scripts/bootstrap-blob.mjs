#!/usr/bin/env node
/**
 * pnpm bootstrap:blob <slug>
 *
 * Creates a Vercel Blob store named `<slug>-files`, connects it to the
 * currently-linked Vercel project (production env), which makes Vercel
 * auto-inject the BLOB_READ_WRITE_TOKEN env var on the next deploy.
 *
 * Idempotent — if the store exists, just re-runs the connect step.
 *
 * NB: `vercel blob create-store -y` also auto-pulls the project's development
 * env into .env.local (no flag to skip). We back up .env.local before running
 * and restore after so the local dev config from `pnpm bootstrap` is preserved.
 */
import { execFileSync, execSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const slug = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!slug) {
  console.error('usage: pnpm bootstrap:blob <slug>')
  process.exit(1)
}

const storeName = `${slug}-files`
const envPath = path.join(ROOT, '.env.local')
const envBackup = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null

console.log(`◇ store name : ${storeName}`)
console.log()

console.log('→ creating + connecting Blob store (idempotent)')
try {
  execSync(
    `vercel blob create-store ${storeName} --access public -e production -y`,
    { cwd: ROOT, stdio: 'inherit' },
  )
} catch (err) {
  console.error('× blob create-store failed')
  process.exit(1)
}

// Restore .env.local — the CLI's auto-pull would otherwise wipe our
// bootstrap-app.mjs output with the project's development env (which is
// empty for a fresh project).
if (envBackup !== null) {
  writeFileSync(envPath, envBackup)
  console.log('  restored .env.local from pre-blob backup')
} else if (existsSync(envPath)) {
  unlinkSync(envPath)
}

console.log()
console.log('✓ bootstrap-blob done')
console.log(
  '  BLOB_READ_WRITE_TOKEN is now in this project\'s production env via Vercel.',
)
console.log(
  '  Trigger a deploy (or wait for the next one) to pick it up.',
)
