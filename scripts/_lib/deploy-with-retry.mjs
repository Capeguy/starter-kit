/**
 * Run `vercel deploy --prod --yes` from the given cwd. If the deploy fails
 * with Prisma's `P1002 — Timed out trying to acquire a postgres advisory
 * lock` (which happens deterministically when an env-var change has
 * triggered a competing background deploy holding the migrate lock), wait
 * and retry up to `maxRetries` times.
 *
 * Other failure modes propagate immediately — only P1002 is retried.
 *
 * Returns the live deploy URL on success; throws on failure or non-P1002
 * error.
 */
import { spawn } from 'node:child_process'

const P1002_MARKER =
  'Timed out trying to acquire a postgres advisory lock'
const RETRY_DELAY_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

export async function deployWithRetry({
  cwd,
  maxRetries = DEFAULT_MAX_RETRIES,
} = {}) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const label = attempt === 1 ? 'attempt' : `retry ${attempt - 1}`
    console.log(`→ vercel deploy --prod (${label})`)
    const { code, output } = await runDeploy(cwd)
    if (code === 0) {
      const urlMatch = output.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/)?.[0]
      console.log(`  ✓ ${urlMatch ?? '(deploy URL not parsed)'}`)
      return urlMatch
    }
    if (output.includes(P1002_MARKER) && attempt <= maxRetries) {
      console.log(
        `  P1002 advisory lock — competing deploy holds it. Waiting ${
          RETRY_DELAY_MS / 1000
        }s and retrying…`,
      )
      await sleep(RETRY_DELAY_MS)
      continue
    }
    // Anything else: propagate. Print the tail of stderr so the operator
    // sees what happened.
    const tail = output.split('\n').slice(-15).join('\n')
    throw new Error(
      `vercel deploy --prod failed (exit ${code})\n${tail.trim()}`,
    )
  }
}

function runDeploy(cwd) {
  return new Promise((resolve) => {
    const child = spawn('vercel', ['deploy', '--prod', '--yes'], { cwd })
    let output = ''
    child.stdout.on('data', (d) => {
      output += d.toString()
    })
    child.stderr.on('data', (d) => {
      output += d.toString()
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 0, output })
    })
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
