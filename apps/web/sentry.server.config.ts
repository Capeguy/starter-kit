/**
 * Sentry initialisation for the Node runtime (serverless functions, route
 * handlers, RSC server components, tRPC procedures).
 *
 * Imported lazily from `src/instrumentation.ts` so it only runs in
 * NEXT_RUNTIME === 'nodejs'.
 */
import * as Sentry from '@sentry/nextjs'

// eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development',
    // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}
