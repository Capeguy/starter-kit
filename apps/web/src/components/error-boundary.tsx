'use client'

import type { ReactNode } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { useEffect } from 'react'
import { Banner } from '@opengovsg/oui/banner'
import { Button } from '@opengovsg/oui/button'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'

import { env } from '~/env'

export interface ErrorBoundaryProps {
  children: ReactNode
}

/**
 * Per-segment error boundary used to wrap UI inside the authed layout.
 *
 * Renders an OUI Banner with friendly text plus "Try again" + "Reload page"
 * actions. Auto-reports the error to Sentry when `NEXT_PUBLIC_SENTRY_DSN`
 * is configured; otherwise logs to the console (no hard dependency).
 *
 * Note: this is React's render-error boundary, NOT Next.js's segment-level
 * error.tsx. Both are wired up — see also `(authed)/error.tsx`.
 */
export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => (
  <ReactErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
    {children}
  </ReactErrorBoundary>
)

const ErrorBoundaryFallback = ({
  error,
  resetErrorBoundary,
}: FallbackProps) => {
  // Report to Sentry exactly once per crash. Sentry no-ops gracefully if it
  // wasn't initialised (no DSN), but we still gate on NEXT_PUBLIC_SENTRY_DSN
  // so we don't pull in any side-effecty code paths in DSN-less envs.
  useEffect(() => {
    if (env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    } else {
      console.error('[ErrorBoundary] caught', error)
    }
  }, [error])

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-4"
      data-testid="error-boundary-fallback"
    >
      <Banner variant="error" isDismissable={false}>
        Something went wrong. The error has been reported — try again, or reload
        the page if it persists.
      </Banner>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="solid" onPress={() => resetErrorBoundary()}>
          Try again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.reload()
            }
          }}
        >
          Reload page
        </Button>
      </div>
      <details className="text-base-content-medium">
        <summary className="prose-body-2 cursor-pointer">Error details</summary>
        <pre className="prose-caption-2 mt-2 max-h-64 overflow-auto whitespace-pre-wrap">
          {message}
        </pre>
      </details>
    </div>
  )
}
