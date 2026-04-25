import { NextResponse } from 'next/server'

import { createLogger } from '~/lib/logger'

// Endpoint for browsers to POST CSP violation reports (referenced from
// next.config.js headers as `report-uri /api/csp-report`).
//
// The browser sends application/csp-report or application/reports+json.
// We log the violation via pino and return 204. Cheap signal for tightening
// the CSP — when violations stop, we know the policy fits the app.
export async function POST(req: Request) {
  const logger = createLogger({
    path: 'csp-report',
    headers: req.headers,
  }).createScopedLogger({ action: 'POST' })

  try {
    const text = await req.text()
    let report: unknown
    try {
      report = JSON.parse(text)
    } catch {
      report = text
    }
    logger.warn({ message: 'CSP violation report', merged: { report } })
  } catch (error) {
    logger.error({ message: 'failed to parse CSP report', error })
  }

  return new NextResponse(null, { status: 204 })
}
