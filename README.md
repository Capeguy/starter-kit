# Starter Kit

A production-ready Next.js boilerplate for shipping web apps fast. Spin off a new app in five minutes to a live URL, then iterate on features instead of plumbing.

## What's in the box

- **Auth** — WebAuthn passkey-only sign-in with conditional-UI autofill, iron-session cookies. No passwords, no SMS, no email-magic-link.
- **API contract** — tRPC v11 end-to-end typesafe; per-procedure rate limiting via Redis; capability-based access control on every procedure.
- **Database** — Prisma + Kysely on Postgres with multi-schema isolation (so spin-offs can share a single Neon instance without colliding). Generated Zod validators.
- **UI chrome** — shadcn/ui sidebar + header + breadcrumbs + ⌘K command palette, modelled on [next-shadcn-admin-dashboard](https://next-shadcn-admin-dashboard.vercel.app). Tailwind v4. Dark mode. Mobile-friendly.
- **Admin panel** — user management + invite flow + passkey reset for locked-out users + audit log + RBAC role/capability editor + feature flags + admin-settable system banner + broadcast notifications + global file oversight.
- **REST API + MCP server** — `/api/v1/*` and `/api/mcp` gated by per-user personal API tokens, with admin-toggleable per-tool gates for the MCP endpoint.
- **File uploads** — Vercel Blob via direct-client uploads (avatar + generic Files page).
- **Observability** — Sentry, structured pino logs, audit-log viewer for security-relevant events.
- **CI** — GitHub Actions: ESLint, tsc, Vitest unit, Playwright e2e, Storybook visual regression.
- **Bootstrap automation** — `pnpm bootstrap*` scripts that take a fresh template clone to a live deploy in five minutes (one curl-pipe-bash command).

## Spin off a new app

One-liner from anywhere on disk:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/Capeguy/starter-kit/main/scripts/spin-off.sh) "Acme App" acme-app
```

In ~5 minutes you'll have:

- Live deploy at `https://acme-app.vercel.app`
- Private GitHub repo at `<your-user>/acme-app`
- Per-app isolated Postgres schema, Redis keyspace prefix, Sentry project, Vercel Blob store, fresh `SESSION_SECRET`

The script does pre-flight checks (`gh` + `vercel` + `pnpm` installed and authed; required keychain entries exist) before spending a build cycle on a deploy that would fail. Idempotent — re-run on partial failure and it resumes.

### Pre-requisites (one-time per machine)

The script defaults to a "shared infra" model — one Neon Postgres + one Redis Cloud + one Sentry org across all your personal projects, with per-project isolation enforced in code. Set up:

- `gh` CLI authed (`gh auth login`) with `repo` scope
- `vercel` CLI authed (`vercel login`)
- Three macOS keychain entries:
  - `claude-code:shared-neon` / `DATABASE_URL` + `DATABASE_URL_UNPOOLED`
  - `claude-code:shared-redis` / `REDIS_URL`
  - `claude-code:shared-sentry` / `API_KEY` (Sentry user token with `project:write` scope)

If you'd rather provision each app on dedicated infra (recommended once a project holds real user data), edit `scripts/bootstrap-app.mjs` and `scripts/bootstrap-vercel.mjs` to read your env from somewhere else — or do the steps manually following [`CLAUDE.md`](./CLAUDE.md).

### Step-by-step (alternative)

If you want finer control over each phase, the underlying scripts are exposed individually:

```bash
gh repo create <owner>/<slug> --private --template <owner>/starter-kit --clone
cd <slug>
pnpm install
pnpm bootstrap <slug>            # local: rename schema, gen SESSION_SECRET, write .env.local
pnpm bootstrap:vercel <slug>     # remote: link Vercel project, push env, first deploy
pnpm bootstrap:sentry <slug>     # remote: create Sentry project, push DSN/auth/org/project
pnpm bootstrap:blob <slug>       # remote: create Blob store, auto-injects BLOB_READ_WRITE_TOKEN
pnpm bootstrap:deploy            # final deploy with P1002 retry, bakes Sentry + Blob into bundle
```

`pnpm bootstrap:all <slug>` runs the same five phases sequentially. `--no-sentry` and `--no-blob` flags skip those phases if you don't need them.

## Local development

```bash
pnpm install
cp .env.example .env
docker compose up -d            # Postgres on :54321, Redis on :63791
pnpm db:push                    # apply Prisma schema to dev DB
pnpm dev                        # all packages in watch mode
```

Then open http://localhost:3000.

### Common commands

| Command                              | What                                       |
| ------------------------------------ | ------------------------------------------ |
| `pnpm lint` / `pnpm typecheck`       | quality gates                              |
| `pnpm test` / `pnpm test:ci`         | Vitest                                     |
| `pnpm -F @acme/web e2e`              | Playwright (boots a dev server on `:3111`) |
| `pnpm db:migrate` / `pnpm db:deploy` | Prisma migrate dev / deploy                |
| `pnpm db:studio`                     | Prisma Studio on `:5556`                   |
| `pnpm storybook`                     | Storybook on `:6006`                       |

### Environment variables

| Name                                                                             | Purpose                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `DIRECT_URL`                          | Postgres connection strings; `?schema=<slug>` for multi-schema isolation              |
| `SESSION_SECRET`                                                                 | iron-session cookie key (`openssl rand -base64 32`)                                   |
| `CACHE_HOSTNAME` / `CACHE_PORT` / `CACHE_USERNAME` / `CACHE_PASSWORD`            | Redis (Redis Cloud or self-hosted)                                                    |
| `CACHE_KEY_PREFIX`                                                               | per-app Redis namespacing — set to the project slug                                   |
| `BLOB_READ_WRITE_TOKEN`                                                          | Vercel Blob; auto-injected when you connect a store via `vercel blob create-store -y` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry error reporting                                                                |
| `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_VERSION` / `LOG_LEVEL`                 | app identity + logging                                                                |

The `pnpm bootstrap*` scripts populate every one of these in Vercel automatically; for local dev, `.env.local` gets written by `pnpm bootstrap`.

Validation lives in `apps/web/src/env.ts` (web app) + `packages/db/src/env.ts` + `packages/redis/src/env.ts`. Client-side variables must be prefixed `NEXT_PUBLIC_` and explicitly listed in `experimental__runtimeEnv` or Next.js will tree-shake them out of the client bundle.

## Project structure

```
apps/web              Next.js 15 / React 19 / tRPC v11 / shadcn-ui — the deployable
packages/
  ├─ db               Prisma client + Kysely extension + generated Zod schemas
  ├─ ui               shared @acme/ui wrappers (text-field, link-button, infobox)
  ├─ common           cross-cutting utility code
  ├─ logging          pino logger setup
  ├─ redis            ioredis singleton with per-app keyPrefix support
  └─ validators       generated Zod schemas
scripts/              spin-off + bootstrap automation (entry: spin-off.sh)
tooling/              shared eslint / prettier / tailwind / typescript / storybook configs
.github/workflows/    CI pipelines (lint, typecheck, vitest, playwright, storybook)
```

The monorepo uses pnpm workspaces with the `@acme/*` scope by default. `pnpm bootstrap` doesn't rename the scope (it stays internal); if you want to flip it, the README's old `sed` recipe still works:

```bash
grep -rl '@acme' --exclude='*.md' --exclude-dir=node_modules . \
  | xargs sed -i '' 's/@acme/@<your_scope>/g'
```

## Stack

- Next.js 15 App Router, React 19, Tailwind CSS v4
- tRPC v11 (single `/api/trpc/[trpc]` entry point — no REST shims)
- Prisma + Kysely on Postgres
- Redis Cloud for rate limiting + BullMQ
- iron-session + WebAuthn (`@simplewebauthn/server` + `/browser`)
- shadcn/ui chrome + lucide-react icons
- Sentry for errors, Vercel for hosting
- Vitest + Playwright for tests, Storybook for visual regression

[`CLAUDE.md`](./CLAUDE.md) has the architecture details and conventions — read that before making non-trivial changes.

## License

MIT — see [LICENSE](./LICENSE).

## References

Originated from [create-t3-app](https://github.com/t3-oss/create-t3-app) and [create-t3-turbo](https://github.com/t3-oss/create-t3-turbo); significantly extended.
