/**
 * Sentry initialisation for the Edge runtime (middleware, edge route handlers).
 * Imported lazily from `src/instrumentation.ts`.
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
  })
}
