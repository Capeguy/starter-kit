import type { NextResponse } from 'next/server'

// Throw a deliberate error so we can verify Sentry capture in production.
// Hitting GET /api/sentry-check returns 500 and Sentry should record it.
// Safe to leave in the boilerplate — it's an explicit opt-in (only fires
// when someone visits the URL) and useful as a smoke test after every
// Sentry-touching deploy.
export function GET(): NextResponse {
  throw new Error('Sentry check (deliberate test error)')
}
