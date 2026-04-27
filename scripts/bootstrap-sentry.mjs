#!/usr/bin/env node
/**
 * pnpm bootstrap:sentry <slug>
 *
 * Creates a Sentry project under org `capeguy` / team `capeguy`, retrieves the
 * DSN from its first ClientKey, and pushes the four Sentry env vars to the
 * Vercel project's production env.
 *
 * Idempotent — if the project already exists, just re-fetches its DSN and
 * re-upserts the env vars.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ORG = 'capeguy'
const TEAM = 'capeguy'

const slug = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!slug) {
  console.error('usage: pnpm bootstrap:sentry <slug>')
  process.exit(1)
}

const sentryToken = keychain('claude-code:shared-sentry', 'API_KEY')

console.log(`◇ org/team    : ${ORG}/${TEAM}`)
console.log(`◇ project     : ${slug}`)
console.log()

// ── 1. create or reuse project ─────────────────────────────────────────
console.log(`→ creating Sentry project ${slug} (idempotent)`)
const createRes = await fetch(
  `https://sentry.io/api/0/teams/${ORG}/${TEAM}/projects/`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sentryToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: slug,
      slug,
      platform: 'javascript-nextjs',
    }),
  },
)
if (createRes.status === 409) {
  console.log('  project already exists, reusing')
} else if (!createRes.ok) {
  console.error(`× project create failed (${createRes.status}):`, await createRes.text())
  process.exit(1)
} else {
  const created = await createRes.json()
  console.log(`  created project id=${created.id}`)
}

// ── 2. fetch DSN from project keys ─────────────────────────────────────
console.log('→ fetching DSN')
const keysRes = await fetch(
  `https://sentry.io/api/0/projects/${ORG}/${slug}/keys/`,
  { headers: { Authorization: `Bearer ${sentryToken}` } },
)
if (!keysRes.ok) {
  console.error(`× keys fetch failed (${keysRes.status})`)
  process.exit(1)
}
const keys = await keysRes.json()
const dsn = keys[0]?.dsn?.public
if (!dsn) {
  console.error('× no public DSN found on project keys')
  process.exit(1)
}
console.log(`  DSN: ${dsn.slice(0, 50)}…`)

// ── 3. push env vars to Vercel production ──────────────────────────────
console.log('→ pushing Sentry env vars to Vercel production')
const ENV = {
  NEXT_PUBLIC_SENTRY_DSN: { value: dsn, sensitive: false },
  SENTRY_ORG: { value: ORG, sensitive: false },
  SENTRY_PROJECT: { value: slug, sensitive: false },
  SENTRY_AUTH_TOKEN: { value: sentryToken, sensitive: true },
}
for (const [name, { value, sensitive }] of Object.entries(ENV)) {
  const flags = sensitive ? [] : ['--no-sensitive']
  try {
    execFileSync(
      'vercel',
      [
        'env',
        'add',
        name,
        'production',
        '--value',
        value,
        '--yes',
        '--force',
        ...flags,
      ],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] },
    )
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  × ${name}:`, err.stderr?.toString().split('\n').pop())
  }
}

console.log()
console.log('✓ bootstrap-sentry done')
console.log('  Errors will be tagged with environment=$VERCEL_ENV automatically.')

function keychain(service, account) {
  return execFileSync('security', [
    'find-generic-password',
    '-s', service,
    '-a', account,
    '-w',
  ])
    .toString()
    .trim()
}
