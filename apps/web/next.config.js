import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import('./src/env')

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    // Limits body size in our endpoints.
    // Only affects route matches in proxy.ts, so you must be careful to not remove matches in that file
    // or the limit can be bypassed and cause OOM server crashes.
    proxyClientMaxBodySize: '2mb',
  },
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    '@acme/db',
    '@acme/ui',
    '@acme/validators',
    '@acme/logging',
    '@acme/redis',
    '@acme/common',
  ],

  reactCompiler: true,

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },

  // If deploying to AWS, set deploymentId to a unique value for each deployment, e.g. from git sha or CI build number
  deploymentId: undefined,
  // If deploying to AWS, set output to 'standalone'
  output: undefined,

  // Security headers applied to every route. CSP starts strict; widen carefully.
  async headers() {
    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' kept for now: react-aria + Next.js inject inline styles/scripts.
      // Tighten later by adopting nonces (Next.js 15 supports App Router nonce strategies).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Allow images from blob storage (Vercel Blob public CDN) + data: for inline icons.
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      // Sentry ingestion is allowed once Unit 8A wires DSN.
      "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
      // CSP violation reports (no-op in prod; logged via pino in dev).
      'report-uri /api/csp-report',
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default config
