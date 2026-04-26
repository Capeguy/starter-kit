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

### UI components — shadcn/ui via the next-shadcn-admin-dashboard reference

This project's design language follows **next-shadcn-admin-dashboard**:

- Source: https://github.com/arhamkhnz/next-shadcn-admin-dashboard
- Live preview (use as the visual + structural reference): https://next-shadcn-admin-dashboard.vercel.app/dashboard/default

When composing or restyling UI, look at how the reference does it (sidebar layout, card chrome, header, breadcrumbs, navigation density, mobile drawer, dark-mode treatment) and mirror it. Reach for shadcn/ui primitives before building one yourself.

**Migration in progress.** Historically this repo used `@opengovsg/oui` and the codebase still imports from `@opengovsg/oui/*` heavily. As pages get touched, migrate them to shadcn/ui patterns. Don't introduce _new_ OUI usage — when adding a primitive that's not yet in the project, install/copy from shadcn/ui rather than reaching for OUI.

**Project's own UI package:** `packages/ui` historically wrapped OUI primitives (e.g. `@acme/ui/text-field`). Existing wrappers can stay until their consumer pages are migrated; new wrappers should sit on shadcn/ui.

**What to avoid:** raw `<button className="...">`, `<div className="rounded-md bg-red-50…">` style alert boxes, hand-rolled headings/cards. Use design-system primitives. Tailwind utility classes are still fine for layout (`flex`, `gap-*`, `grid`, spacing) and one-off positioning, but not as a substitute for components.

## Conventions to be aware of

- Node `>=24.13.0`, pnpm `>=10.17.1` (see `.nvmrc` and `package.json` engines).
- Prettier config is `@acme/prettier-config`; ESLint configs are flat-config files re-exported from `tooling/eslint`.
- `pnpm.publicHoistPattern` hoists Prettier/ESLint plugins, OUI, Prisma, and `pg` — don't `import { Prisma } from '@prisma/client'` directly in app code; go through `@acme/db`.
- `@img/sharp-libvips-darwin-arm64` is overridden to `-` in `pnpm-workspace.yaml` to avoid pulling a copyleft-licensed binary — don't remove.
- Vercel build runs `@acme/db#generate` → `@acme/db#migrate:deploy` → `^vercel-build` (see `turbo.json`). Deploys apply migrations automatically.
