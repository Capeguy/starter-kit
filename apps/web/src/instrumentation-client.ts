/**
 * Sentry init for the browser bundle. Next.js auto-loads this file.
 * Picked up by both App Router pages and Pages Router pages.
 */
import * as Sentry from '@sentry/nextjs'

import { env } from '~/env'

if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: env.NEXT_PUBLIC_APP_ENV,
    release: env.NEXT_PUBLIC_APP_VERSION,
    // Replay disabled by default for privacy + bundle size; flip on per app.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
