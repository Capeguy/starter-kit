#!/usr/bin/env node
/**
 * pnpm bootstrap:vercel <slug> [--no-deploy]
 *
 * Creates a Vercel project linked to the current GitHub repo, configures
 * monorepo build settings, pushes every var from .env.local to Vercel
 * production env, and triggers the first prod deploy.
 *
 * Idempotent — re-running just upserts env vars and triggers a fresh deploy.
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { deployWithRetry } from './_lib/deploy-with-retry.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const TEAM_ID = 'team_AqUirRbmqVkSV9bgzAXk1r0r' // capeguys-projects

const args = process.argv.slice(2)
const slug = args.find((a) => !a.startsWith('--'))
const skipDeploy = args.includes('--no-deploy')

if (!slug) {
  console.error('usage: pnpm bootstrap:vercel <slug> [--no-deploy]')
  process.exit(1)
}

const envPath = path.join(ROOT, '.env.local')
if (!existsSync(envPath)) {
  console.error(`× .env.local missing — run \`pnpm bootstrap ${slug}\` first`)
  process.exit(1)
}

console.log(`◇ project slug : ${slug}`)
console.log(`◇ team         : capeguys-projects`)
console.log()

// ── 1. vercel link ──────────────────────────────────────────────────────
console.log(`→ linking project ${slug} (creates if absent)`)
try {
  execSync(`vercel link --yes --project ${slug} --scope ${TEAM_ID}`, {
    cwd: ROOT,
    stdio: 'inherit',
  })
} catch (err) {
  console.error('× vercel link failed:', err.message)
  process.exit(1)
}

// ── 2. patch project settings via REST ─────────────────────────────────
console.log(`→ patching project settings (rootDirectory, build, framework)`)
const vToken = vercelToken()
const patchRes = await fetch(
  `https://api.vercel.com/v9/projects/${slug}?teamId=${TEAM_ID}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${vToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rootDirectory: 'apps/web',
      framework: 'nextjs',
      buildCommand: 'turbo vercel-build',
      installCommand: 'pnpm install',
      outputDirectory: null,
    }),
  },
)
if (!patchRes.ok) {
  console.error(`× project PATCH failed (${patchRes.status})`)
  console.error(await patchRes.text())
  process.exit(1)
}
const patched = await patchRes.json()
console.log(
  `  rootDirectory=${patched.rootDirectory} buildCommand=${patched.buildCommand}`,
)

// ── 3. push env vars from .env.local to production ─────────────────────
console.log(`→ pushing env vars to production`)
const envVars = parseEnv(readFileSync(envPath, 'utf8'))
let pushed = 0
for (const [name, value] of envVars) {
  // NEXT_PUBLIC_* must NOT be sensitive (they're injected client-side anyway,
  // and marking them sensitive prevents them from being included in the
  // client bundle on next build). Everything else stays sensitive (default).
  const flags = name.startsWith('NEXT_PUBLIC_')
    ? ['--no-sensitive']
    : []
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
    pushed++
  } catch (err) {
    console.error(`  × ${name}:`, err.stderr?.toString().split('\n').pop())
  }
}
console.log(`  ${pushed}/${envVars.length} env vars pushed`)

// ── 4. first prod deploy (with P1002 retry) ────────────────────────────
if (skipDeploy) {
  console.log('→ skipping deploy (--no-deploy)')
} else {
  await deployWithRetry({ cwd: ROOT })
}

console.log()
console.log('✓ bootstrap-vercel done')

// ── helpers ────────────────────────────────────────────────────────────
function vercelToken() {
  const authPath = path.join(
    homedir(),
    'Library/Application Support/com.vercel.cli/auth.json',
  )
  return JSON.parse(readFileSync(authPath, 'utf8')).token
}

function parseEnv(s) {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const eq = l.indexOf('=')
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()]
    })
}
