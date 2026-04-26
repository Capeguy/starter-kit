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
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
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
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          We couldn&apos;t load this page. The error has been reported.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
        >
          Reload page
        </Button>
        <Button asChild size="sm" variant="link">
          <NextLink href={AUTHED_ROOT_ROUTE}>Go to dashboard</NextLink>
        </Button>
      </div>
      <details className="text-muted-foreground">
        <summary className="cursor-pointer text-sm">Error details</summary>
        <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">
          {error.message}
          {error.digest ? `\n\nDigest: ${error.digest}` : ''}
        </pre>
      </details>
    </div>
  )
}
