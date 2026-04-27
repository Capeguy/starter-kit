# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

This is a Turborepo + pnpm workspace using the `@acme/*` scope. The workspace scope is renameable via the `sed` recipe in `README.md`.

- `apps/web` — Next.js 15 / React 19 app with tRPC v11, the single deployable.
- `packages/db` — Prisma client + Kysely extension + generated Zod schemas (PostgreSQL).
- `packages/{common,logging,redis,ui,validators}` — shared workspace packages consumed by `apps/web`.
- `tooling/{eslint,prettier,tailwind,typescript,storybook,github}` — shared config presets.

Dependency versions are pinned via pnpm **catalog:** (e.g. `catalog:react`, `catalog:trpc`) in `pnpm-workspace.yaml`. When bumping versions, update the catalog, not individual `package.json` files. `minimumReleaseAge: 1440` enforces a 24h hold before new versions can be installed.

## Common commands

Run from repo root unless noted:

```bash
# Setup (first time)
pnpm i
cp .env.example .env
docker compose up -d          # Postgres on :54321, Redis on :63791
pnpm db:push                  # push Prisma schema to the dev DB

# Dev
pnpm dev                      # all packages in watch mode
pnpm dev:next                 # only @acme/web and its deps

# DB
pnpm db:push                  # prisma db push (dev only; no migration file)
pnpm db:migrate               # prisma migrate dev (creates migration)
pnpm db:deploy                # prisma migrate deploy (prod)
pnpm db:studio                # Prisma Studio on :5556

# Quality gates
pnpm lint                     # ESLint (cached)
pnpm lint:fix
pnpm typecheck                # tsc --noEmit across workspaces
pnpm format / pnpm format:fix # Prettier (cached)
pnpm lint:ws                  # sherif workspace sanity check (also runs postinstall)
```

### Testing

Unit/integration tests use **Vitest**; E2E uses **Playwright**. Both live in `apps/web`.

```bash
# From apps/web
pnpm test                     # vitest watch
pnpm test:ci                  # vitest run + coverage
pnpm vitest run path/to/file  # single test file
pnpm vitest -t "test name"    # filter by name
pnpm e2e                      # playwright (boots dev server on :3111)
pnpm e2e:ui                   # playwright UI mode
pnpm storybook                # storybook on :6006
```

Vitest global setup (`apps/web/tests/global-setup.ts`) spins up **Testcontainers** for Postgres + Redis and stashes their details in `process.env.testcontainers`. The per-file setup (`tests/db/setup.ts`) creates a fresh DB per test run, applies migrations from `packages/db/prisma/migrations/` directly via `$executeRawUnsafe`, and `vi.mock`s `@acme/db` to point at the test DB. Migrations — not `prisma db push` — are what tests see, so new schema changes require a migration to be picked up by tests.

#### Always ship e2e coverage with new features

Every new user-facing feature (new admin action, new authed page, new auth flow, new mutation that has UI) ships with a Playwright spec in `apps/web/tests/e2e/<feature>.spec.ts`. Don't defer it. Pattern: right after the feature commit lands and is pushed, spawn a background sub-agent (`Agent` with `run_in_background: true`) that owns only the new spec file and writes coverage. The orchestrator continues with whatever's next; push the agent's commit when it returns. Bug fixes don't need new e2e unless they expose missing coverage. Reference fixtures: `tests/e2e/setup/auth.ts` (createTestUser + signInAs), `tests/e2e/app-fixture.ts` (DB/Redis container fixtures + per-test reset).

## Architecture

### tRPC is the API contract

All client/server data flow goes through tRPC v11 (`apps/web/src/server/api/`). The Next.js `/api/trpc/[trpc]` route is the only HTTP API; there is no REST layer. `appRouter` in `server/api/root.ts` is the single composition point — new feature routers must be registered there.

`server/api/trpc.ts` defines the middleware stack:

- `loggerMiddleware` — pino logger scoped by procedure path, emits duration/status metrics.
- `rateLimitMiddleware` — uses `modules/rate-limit` (Redis-backed `rate-limiter-flexible`). Configure per-procedure via `.meta({ rateLimitOptions: { points, duration } })`; set `rateLimitOptions: null` to disable. Skipped when `NODE_ENV === 'test'`.
- `authMiddleware` — guards `protectedProcedure`; `publicProcedure` does not require a session.

Procedures should almost always be `publicProcedure` or `protectedProcedure` (both include logging + rate limiting).

### Server-side module structure

Business logic lives in `apps/web/src/server/modules/<domain>/` (e.g. `auth`, `user`, `mail`, `rate-limit`, `healthcheck`). Routers in `server/api/routers/` are thin wrappers that call into these modules. Tests colocate in `__tests__` folders inside each module.

### Frontend data flow

- Server Components: use `trpc` from `src/trpc/server.tsx` (calls the router in-process, no HTTP) and `HydrateClient` + `prefetch()` to hand dehydrated state to the client.
- Client Components: `useTRPC()` from `src/trpc/react.tsx` returns the TanStack Query-bound proxy, which runs over `httpLink` to `/api/trpc`.
- The HTTP client attaches `NEXT_PUBLIC_APP_VERSION` and listens for a mismatched server version to emit `REQUIRE_UPDATE_EVENT` — used for soft-refresh-on-deploy UX.

### App routing

`apps/web/src/app` uses Next.js route groups to split auth states:

- `(public)/` — unauthenticated routes (sign-in, landing).
- `(authed)/` — requires session; has its own layout + `_components`.

### Database access

`@acme/db` exports a single `db` singleton — a Prisma client extended with `kyselyPrismaExtension`, giving you `db.$kysely.selectFrom(...)` alongside normal Prisma calls. Use Kysely for complex SQL (joins, CTEs, aggregations); use Prisma for simple CRUD. Do **not** use `db.$kysely.transaction()` — the extension does not support it; wrap in `db.$transaction` instead.

Schema changes workflow:

1. Edit `packages/db/prisma/schema.prisma`.
2. `pnpm db:migrate` to create and apply a migration (needed for tests to see the change).
3. `pnpm -F @acme/db generate` regenerates Prisma client, Kysely types, and Zod schemas.

Generated Zod schemas are exported from `@acme/db/validators`.

### Env vars

Validated with `@t3-oss/env-nextjs` in `apps/web/src/env.ts` and `packages/db/src/env.ts`. Client-exposed vars **must** be prefixed `NEXT_PUBLIC_` _and_ explicitly listed in `experimental__runtimeEnv` — otherwise Next.js will tree-shake them out of the client bundle. `SKIP_ENV_VALIDATION=1` bypasses checks (used by Storybook).

### Sessions / auth

`iron-session` (`src/lib/auth.ts`, `src/server/session.ts`) backs the cookie. Auth is **WebAuthn passkeys** (`@simplewebauthn/server` + `/browser`); see `src/server/modules/auth/passkey.service.ts`. Session shape is `{ userId }`.

#### Sign-in flow architecture (`(public)/sign-in`)

Two principles that the wizard at `apps/web/src/app/(public)/sign-in/_components/wizard/passkey-flow.tsx` is built around — both deliberate, both load-bearing:

1. **Never auto-fork to registration on `NotAllowedError`.** WebAuthn collapses cancel / no-credential / biometric-fail / timeout into one error code. Registration only happens when the user explicitly clicks "Create new account". On any failure (modal or conditional), stay on the same screen with an inline retry hint.
2. **Conditional UI runs in the background.** On mount, `startAuthentication({ useBrowserAutofill: true })` waits for the user to pick a passkey from the browser's autofill dropdown (the name input has `autocomplete="username webauthn"`). Before any modal flow starts, call `WebAuthnAbortService.cancelCeremony()` so the two ceremonies don't race. The conditional flow's `catch` block must mirror the modal flow's — surfacing `NOT_FOUND` (orphan passkey from a wiped DB) inline; otherwise the user picks a passkey from autofill, gets a silent 404, and nothing happens.

#### Authed chrome (`(authed)/layout.tsx`)

The whole authed shell is one shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset(SiteHeader + children)` mounted in `(authed)/layout.tsx`. Both `/dashboard/*` and `/admin/*` share it; per-section layouts only carry capability gates.

- `apps/web/src/components/app-sidebar.tsx` — picks `USER_NAV` or `ADMIN_NAV` from pathname (via `rootForPathname`), uses `variant="inset"` + `collapsible="icon"`, footer holds the user dropdown + logout. Don't pass NavRoot objects across the RSC boundary; pass a string key (`navKey="admin"|"user"`) and look up the nav inside the client.
- `apps/web/src/components/site-header.tsx` — sticky top bar with `SidebarTrigger` + ⌘K search chip + `ThemeToggle` + `NotificationBell`.
- `apps/web/src/lib/nav.ts` — single source of truth. Adding a sidebar item here surfaces it in (a) the sidebar, (b) the Cmd+K palette, (c) the breadcrumb chain. Capability-gate via `requires`; sub-routes (`/admin/users/[id]`) match their parent via `matches: RegExp[]`.
- `apps/web/src/components/registry-breadcrumbs.tsx` — call `<RegistryBreadcrumbs />` at the top of every authed page. Pass `trailing="..."` for dynamic-segment pages so the leaf crumb gets the right label.

#### Admin-settable system banner

`/admin/system-message` (capability `system.message.manage`) edits a singleton `SystemMessage` row. The `EnvBanner` at the top of every authed page reads `systemMessage.get` via TanStack Query and renders nothing when `enabled === false` (the default). Use it for maintenance notices, incident updates, dev-environment warnings.

### UI components — shadcn/ui via the next-shadcn-admin-dashboard reference

Design language follows **next-shadcn-admin-dashboard**:

- Source: https://github.com/arhamkhnz/next-shadcn-admin-dashboard
- Live preview (visual + structural reference): https://next-shadcn-admin-dashboard.vercel.app/dashboard/default

When composing or restyling UI, mirror the reference (sidebar layout, card chrome, header, breadcrumbs, mobile drawer, dark-mode treatment). Reach for shadcn primitives before building one yourself.

**Tokens.** `apps/web/src/app/globals.css` defines the full neutral palette in `:root` + `.dark` plus an `@layer base { * { @apply border-border outline-ring/50 } }` rule that defaults every element's border-color to `--border`. **Don't remove that rule** — without it, `border-b` (used in the shadcn `Table`, `CardFooter`, etc.) falls back to `currentColor` and renders as harsh white text-coloured lines in dark mode.

**Project conventions on top of vanilla shadcn:**

- `Card` uses `ring-1 ring-foreground/10` + `overflow-hidden` instead of the default `border + shadow-sm` (the default combination produces a halo on dark backgrounds — see `~/components/ui/_card-primitives.tsx`).
- `Sidebar` is mounted with `variant="inset"` so the main content floats as a rounded card inside the sidebar-coloured background, matching the reference.
- `Table` is wrapped by `~/components/ui/data-table.tsx`, which owns the scroll container and renders edge-aware scroll-shadow gradients via `useScrollEdges`. The shadcn `Table` primitive itself has had its built-in `<div className="...overflow-auto">` wrapper removed so the wrapper is the single scroll container.
- After `pnpm dlx shadcn@latest add <primitive>`, **always sweep the new file** for Tailwind v3 arbitrary syntax that breaks under our v4 setup: `w-[--var]` → `w-(length:--var)` (or `w-[var(--var)]` for non-length types), `theme(spacing.X)` → `var(--spacing-X)`, `origin-[--var]` → `origin-[var(--var)]`. Verify with `grep -nE 'w-\[--|h-\[--|theme\(' apps/web/src/components/ui/<file>.tsx` returning nothing.

**Project's own UI package:** `packages/ui` (`@acme/ui/text-field`, `@acme/ui/link-button`, `@acme/ui/infobox`, `@acme/ui/empty-placeholder`) wraps shadcn primitives with project-specific defaults. Prefer the wrapper when one exists; otherwise import the shadcn primitive directly from `~/components/ui/*`.

**What to avoid:** raw `<button className="...">`, `<div className="rounded-md bg-red-50…">` style alert boxes, hand-rolled headings/cards. Use design-system primitives. Tailwind utility classes are still fine for layout (`flex`, `gap-*`, `grid`, spacing) but not as a substitute for components.

**Legacy OUI footprint (residual).** `globals.css` keeps `@import '@opengovsg/oui-theme/tailwind.css'` so the gated `@acme/ui/restricted-footer` (behind `NEXT_PUBLIC_SHOW_OGP_BRANDING`) still resolves its OUI tokens. No JS file in `apps/web/src` or `packages/ui/src` imports from `@opengovsg/oui` anymore.

## Spinning off a new app from this template

This repo is a GitHub template — `Capeguy/starter-kit` is marked as one. To spin off a new product, the four `pnpm bootstrap*` scripts under `scripts/` automate the whole pipeline:

```bash
gh repo create Capeguy/<slug> --private --template Capeguy/starter-kit
git clone https://github.com/Capeguy/<slug>.git
cd <slug>
pnpm install

pnpm bootstrap <slug>            # local: rename schema, gen SESSION_SECRET, write .env.local
pnpm bootstrap:vercel <slug>     # remote: link Vercel project, push env, first deploy
pnpm bootstrap:sentry <slug>     # remote: create Sentry project, push DSN/auth/org/project
pnpm bootstrap:blob <slug>       # remote: create Blob store, auto-injects BLOB_READ_WRITE_TOKEN
```

Each script is idempotent — safe to re-run. After bootstrap:blob, run `vercel deploy --prod --yes` once more to pick up the Sentry + Blob env vars. The result: a live deploy at `https://<slug>.vercel.app` with healthcheck green, isolated Postgres schema, prefixed Redis keyspace, dedicated Sentry project, and a connected Blob store.

**What "isolated" means here.** The starter kit shares one Neon DB and one Redis Cloud DB across all spin-offs (per `~/.claude/CLAUDE.md`'s shared-resource convention). Isolation is enforced via:

- Postgres: each app has its own `?schema=<slug_underscored>` and only ever queries its own schema (every Prisma model carries `@@schema(...)`).
- Redis: each app sets `CACHE_KEY_PREFIX=<slug>` so ioredis prepends every key with `<slug>:`.
- Sessions: each app has its own `SESSION_SECRET` in keychain at `claude-code:<slug>` so iron-session cookies don't cross apps.
- Sentry / Blob: per-app project + store.

When a project moves beyond pre-launch and starts holding real user data, fork it onto a dedicated Neon project + Redis instance. The shared resources are an early-stage convenience.

## Conventions to be aware of

- Node `>=24.13.0`, pnpm `>=10.17.1` (see `.nvmrc` and `package.json` engines).
- Prettier config is `@acme/prettier-config`; ESLint configs are flat-config files re-exported from `tooling/eslint`.
- `pnpm.publicHoistPattern` hoists Prettier/ESLint plugins, OUI, Prisma, and `pg` — don't `import { Prisma } from '@prisma/client'` directly in app code; go through `@acme/db`.
- `@img/sharp-libvips-darwin-arm64` is overridden to `-` in `pnpm-workspace.yaml` to avoid pulling a copyleft-licensed binary — don't remove.
- Vercel build runs `@acme/db#generate` → `@acme/db#migrate:deploy` → `^vercel-build` (see `turbo.json`). Deploys apply migrations automatically.
