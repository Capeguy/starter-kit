export async function register() {
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // eslint-disable-next-line no-restricted-properties
    if (process.env.DD_SERVICE !== undefined) {
      // setup datadog tracing
      const { initTracer } = await import('@acme/logging/tracer')
      // eslint-disable-next-line no-restricted-properties
      initTracer({ service: process.env.DD_SERVICE })
    }

    await import('../sentry.server.config')
  }

  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Re-exported by Next.js for nested route error capture (App Router).
export { captureRequestError as onRequestError } from '@sentry/nextjs'
