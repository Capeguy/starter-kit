'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Database,
  Fingerprint,
  Gauge,
  Layers,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { AUTHED_ROOT_ROUTE, LOGIN_ROUTE } from '~/constants'
import { env } from '~/env'

const COPYRIGHT_YEAR = new Date().getFullYear()

interface LandingPageComponentProps {
  appName: string
  isAuthed: boolean
}

const FEATURES: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}[] = [
  {
    icon: Fingerprint,
    title: 'Passwordless auth',
    body: 'WebAuthn passkeys with iron-session cookies. Optional invite + reset flows already wired.',
  },
  {
    icon: ShieldCheck,
    title: 'RBAC out of the box',
    body: 'Role + capability gates on every tRPC procedure. Admin UI to manage them ships in the box.',
  },
  {
    icon: Database,
    title: 'Prisma + Kysely',
    body: 'CRUD via Prisma, complex queries via Kysely — same `db` singleton, generated Zod validators.',
  },
  {
    icon: Gauge,
    title: 'Observability built-in',
    body: 'Sentry error reporting, structured pino logs, audit log + admin viewer for security events.',
  },
  {
    icon: Layers,
    title: 'shadcn/ui chrome',
    body: 'Sidebar layout, command palette, breadcrumbs registry, dark-mode tokens — copy and own them.',
  },
  {
    icon: Zap,
    title: 'Vercel-native',
    body: 'One deploy command. Migrations apply automatically, environment vars validated at build time.',
  },
]

/**
 * Public landing page. Shadcn-style hero + feature grid + CTA, light-mode only
 * (per `(public)/layout.tsx`'s no-ThemeProvider rule). All chrome uses shadcn
 * primitives — no OUI imports.
 *
 * Exported for testing.
 */
export const LandingPageComponent = ({
  isAuthed,
  appName,
}: LandingPageComponentProps) => {
  const ctaLink = isAuthed ? AUTHED_ROOT_ROUTE : LOGIN_ROUTE
  const ctaLabel = isAuthed ? 'Open dashboard' : 'Sign in'

  return (
    <div className="flex flex-1 flex-col">
      {/* ── Top nav ───────────────────────────────────────────────────── */}
      <nav className="bg-background sticky top-0 z-30 flex h-14 items-center border-b px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <span className="text-foreground font-semibold">{appName}</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="https://github.com/Capeguy/starter-kit"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
          >
            GitHub
          </Link>
          <Button asChild size="sm">
            <Link href={ctaLink}>{ctaLabel}</Link>
          </Button>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-10 px-4 py-20 md:px-8 md:py-28">
          <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            Production-ready Next.js boilerplate
          </div>
          <h1 className="text-foreground max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            Skip the wiring. Ship the product.
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base md:text-lg">
            {appName} bundles the boring parts of every webapp — passkey auth,
            RBAC, audit logging, file uploads, an admin panel and a typed API
            layer — so day one is your feature, not your foundation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ctaLink} className="flex items-center gap-2">
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link
                href="https://github.com/Capeguy/starter-kit"
                target="_blank"
                rel="noreferrer"
              >
                Read the source
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Feature grid ──────────────────────────────────────────────── */}
      <section className="bg-muted/30 border-b">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              What&apos;s in the box
            </p>
            <h2 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
              Everything a real app needs, already wired up.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="gap-3 py-5">
                <CardHeader className="px-5">
                  <div className="bg-primary text-primary-foreground mb-2 flex size-8 items-center justify-center rounded-md">
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <p className="text-muted-foreground text-sm">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-8 md:py-24">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
            Get to your first commit faster.
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base">
            Clone the repo, point it at Postgres + Redis, and have an
            authenticated, observable, deployable app inside an hour.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ctaLink} className="flex items-center gap-2">
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="text-muted-foreground bg-background px-4 py-8 text-xs md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span>
            © {COPYRIGHT_YEAR} {appName}.{' '}
            {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && '· Built by OGP. '}
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/Capeguy/starter-kit"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </Link>
            <Link href={LOGIN_ROUTE} className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
