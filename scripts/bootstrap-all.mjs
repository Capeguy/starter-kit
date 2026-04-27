#!/usr/bin/env node
/**
 * pnpm bootstrap:all <slug> [--name "<App Name>"] [--no-sentry] [--no-blob]
 *
 * One-shot orchestrator. Runs the whole spin-off pipeline — local rename,
 * Vercel project + first deploy, Sentry project + DSN, Blob store + token,
 * final bake-in deploy — in sequence. Each underlying script is idempotent,
 * so re-running this command after a partial failure resumes safely.
 *
 * Use the individual `bootstrap:*` scripts when you need finer control
 * (e.g. opt out of Sentry/Blob, or pause to verify between phases).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const args = process.argv.slice(2)
const slug = args.find((a) => !a.startsWith('--'))
const noSentry = args.includes('--no-sentry')
const noBlob = args.includes('--no-blob')

if (!slug) {
  console.error(
    'usage: pnpm bootstrap:all <slug> [--name "<App Name>"] [--no-sentry] [--no-blob]',
  )
  process.exit(1)
}

// Forward --name through to bootstrap-app; everything else just takes <slug>.
const nameIdx = args.indexOf('--name')
const passToApp = nameIdx >= 0 ? [slug, '--name', args[nameIdx + 1]] : [slug]

const phases = [
  ['1/5 Local rewrite', 'scripts/bootstrap-app.mjs', passToApp],
  ['2/5 Vercel project + first deploy', 'scripts/bootstrap-vercel.mjs', [slug]],
  noSentry
    ? null
    : ['3/5 Sentry project + DSN', 'scripts/bootstrap-sentry.mjs', [slug]],
  noBlob
    ? null
    : ['4/5 Blob store + token', 'scripts/bootstrap-blob.mjs', [slug]],
  ['5/5 Final deploy (P1002 retry)', 'scripts/bootstrap-deploy.mjs', []],
].filter(Boolean)

const TOTAL = phases.length
const T0 = Date.now()
const tag = (i) => `[T+${Math.floor((Date.now() - T0) / 1000)}s] ${i}`

for (let i = 0; i < phases.length; i++) {
  const [label, script, scriptArgs] = phases[i]
  console.log()
  console.log(`═══ ${tag(label)} ═══`)
  const result = spawnSync('node', [script, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error()
    console.error(`× ${label} failed (exit ${result.status})`)
    console.error(
      `  Re-run \`pnpm bootstrap:all ${slug}\` to resume — each phase is idempotent.`,
    )
    process.exit(result.status ?? 1)
  }
}

const elapsed = Math.floor((Date.now() - T0) / 1000)
console.log()
console.log('═══════════════════════════════════════════════')
console.log(`✓ All ${TOTAL} phases complete in ${elapsed}s`)
console.log(`  Live: https://${slug}.vercel.app`)
console.log('═══════════════════════════════════════════════')
