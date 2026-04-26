'use client'

/**
 * Next.js segment-level error boundary for the `(authed)` route group.
 * Catches errors thrown in Server Components / data fetchers / loading.tsx
 * for any route under (authed)/. Distinct from the React render-error
 * boundary in `~/components/error-boundary` — both are needed for full
 * coverage. This one renders OUTSIDE the layout (no navbar), so it links
 * back to the dashboard explicitly.
 */
import { useEffect } from 'react'
import NextLink from 'next/link'
import { Banner } from '@opengovsg/oui/banner'
import { Button } from '@opengovsg/oui/button'
import * as Sentry from '@sentry/nextjs'

import { AUTHED_ROOT_ROUTE } from '~/constants'
import { env } from '~/env'

export interface AuthedErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthedError({ error, reset }: AuthedErrorProps) {
  useEffect(() => {
    if (env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    } else {
      console.error('[(authed)/error.tsx] caught', error)
    }
  }, [error])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="container mx-auto flex flex-col gap-4 p-4"
      data-testid="authed-segment-error"
    >
      <Banner variant="error" isDismissable={false}>
        Something went wrong loading this page. The error has been reported.
      </Banner>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="solid" onPress={() => reset()}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
        >
          Reload page
        </Button>
        <NextLink
          href={AUTHED_ROOT_ROUTE}
          className="prose-label-md text-base-content-brand inline-flex items-center px-3 py-2 hover:underline"
        >
          Go to dashboard
        </NextLink>
      </div>
      <details className="text-base-content-medium">
        <summary className="prose-body-2 cursor-pointer">Error details</summary>
        <pre className="prose-caption-2 mt-2 max-h-64 overflow-auto whitespace-pre-wrap">
          {error.message}
          {error.digest ? `\n\nDigest: ${error.digest}` : ''}
        </pre>
      </details>
    </div>
  )
}
