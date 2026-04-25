import { NextResponse } from 'next/server'

import { db } from '@acme/db'

/**
 * Vercel Cron entrypoint — runs cleanup jobs that would normally live in
 * a long-running BullMQ worker. We batch them inline because Vercel
 * serverless can't host a persistent worker process.
 *
 * For heavier workloads, host a real BullMQ worker on a long-running
 * platform (Railway, Fly, Hetzner) and point it at the same Redis.
 *
 * Configured in `vercel.json` to fire daily.
 *
 * Auth: optional CRON_SECRET. Vercel Cron sends the request with a
 * synthesized Authorization header (`Bearer <CRON_SECRET>`) when the env
 * var is set. We accept anything if unset (acceptable for the cleanup
 * jobs which are idempotent + read-only on critical state).
 */
export async function GET(req: Request) {
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  const expected = process.env.CRON_SECRET
  if (expected) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const now = Date.now()
  const oneHourAgo = new Date(now - 60 * 60 * 1000)

  // Cleanup #1: expired-but-never-claimed passkey challenges.
  const challenges = await db.passkeyChallenge.deleteMany({
    where: { expiresAt: { lt: oneHourAgo } },
  })

  // Cleanup #2: nothing to delete for reset tokens — kept for audit
  // (consumedAt + expiresAt remain queryable). Just count them for telemetry.
  const expiredResetTokens = await db.passkeyResetToken.count({
    where: { expiresAt: { lt: new Date() }, consumedAt: null },
  })

  return NextResponse.json({
    ok: true,
    cleaned: {
      passkeyChallenges: challenges.count,
      expiredResetTokens,
    },
  })
}
