#!/usr/bin/env node
/**
 * pnpm bootstrap:blob <slug>
 *
 * Creates a Vercel Blob store named `<slug>-files`, connects it to the
 * currently-linked Vercel project (production env), which makes Vercel
 * auto-inject the BLOB_READ_WRITE_TOKEN env var on the next deploy.
 *
 * Idempotent — if the store exists, just re-runs the connect step.
 */
import { execFileSync, execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const slug = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!slug) {
  console.error('usage: pnpm bootstrap:blob <slug>')
  process.exit(1)
}

const storeName = `${slug}-files`
console.log(`◇ store name : ${storeName}`)
console.log()

console.log('→ creating + connecting Blob store (idempotent)')
try {
  // -y accepts defaults; -e production connects this store to the production
  // env of the currently-linked project, which makes Vercel inject
  // BLOB_READ_WRITE_TOKEN on the next deploy. Re-running just connects again
  // (or no-ops if the store with this name already exists).
  execSync(
    `vercel blob create-store ${storeName} --access public -e production -y`,
    { cwd: ROOT, stdio: 'inherit' },
  )
} catch (err) {
  console.error('× blob create-store failed')
  process.exit(1)
}

console.log()
console.log('✓ bootstrap-blob done')
console.log(
  '  BLOB_READ_WRITE_TOKEN is now in this project\'s production env via Vercel.',
)
console.log(
  '  Trigger a deploy (or wait for the next one) to pick it up.',
)
