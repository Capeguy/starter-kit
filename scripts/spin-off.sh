#!/usr/bin/env bash
# spin-off.sh — one-shot spin-off of a new app from this starter kit.
#
# Usage: spin-off.sh "<App Name>" <slug>
#   e.g. spin-off.sh "Acme App" acme-app
#
# As a one-liner from anywhere on disk:
#   bash <(curl -sSL https://raw.githubusercontent.com/Capeguy/starter-kit/main/scripts/spin-off.sh) "Acme App" acme-app
#
# What it does (idempotent end-to-end — re-run on partial failure):
#   1. gh repo create Capeguy/<slug> --private --template Capeguy/starter-kit --clone
#   2. cd <slug>
#   3. pnpm install
#   4. pnpm bootstrap:all <slug> --name "<App Name>"
#
# Prerequisites (one-time per machine):
#   - gh CLI authed with `repo` scope          (gh auth login)
#   - vercel CLI authed                        (vercel login)
#   - macOS keychain entries (per ~/.claude/CLAUDE.md):
#       claude-code:shared-neon  / DATABASE_URL, DATABASE_URL_UNPOOLED
#       claude-code:shared-redis / REDIS_URL
#       claude-code:shared-sentry / API_KEY  (token with project:write scope)

set -euo pipefail

if [ $# -lt 2 ]; then
  cat >&2 <<EOF
usage: spin-off.sh "<App Name>" <slug>
  e.g. spin-off.sh "Acme App" acme-app
EOF
  exit 1
fi

APP_NAME="$1"
SLUG="$2"

if [[ ! "$SLUG" =~ ^[a-z][a-z0-9-]{2,31}$ ]]; then
  echo "× invalid slug '$SLUG' — must be 3-32 chars, kebab-case, start with a letter" >&2
  exit 1
fi

# Quick sanity-check that prerequisites are in place before spending 5 min on
# a deploy that will fail at the last step.
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "× missing prerequisite: $1" >&2; exit 1; }
}
require_cmd gh
require_cmd vercel
require_cmd pnpm

gh auth status >/dev/null 2>&1 || { echo '× gh CLI not authed; run `gh auth login`' >&2; exit 1; }
vercel whoami >/dev/null 2>&1 || { echo '× vercel CLI not authed; run `vercel login`' >&2; exit 1; }

for kc in 'claude-code:shared-neon|DATABASE_URL' 'claude-code:shared-redis|REDIS_URL' 'claude-code:shared-sentry|API_KEY'; do
  svc="${kc%%|*}"; acct="${kc##*|}"
  security find-generic-password -s "$svc" -a "$acct" -w >/dev/null 2>&1 \
    || { echo "× missing keychain entry: $svc / $acct" >&2; exit 1; }
done

echo "◇ slug    : $SLUG"
echo "◇ name    : $APP_NAME"
echo "◇ repo    : github.com/Capeguy/$SLUG (private)"

T0=$(date +%s)

echo
echo "═══ 1/3 cloning template (waits for GitHub apply) ═══"
gh repo create "Capeguy/$SLUG" --private --template Capeguy/starter-kit --clone

cd "$SLUG"

echo
echo "═══ 2/3 pnpm install ═══"
pnpm install

echo
echo "═══ 3/3 pnpm bootstrap:all ═══"
pnpm bootstrap:all "$SLUG" --name "$APP_NAME"

T_END=$(date +%s)
echo
echo "═══════════════════════════════════════════════"
echo "  done in $((T_END-T0))s"
echo "  Live: https://$SLUG.vercel.app"
echo "═══════════════════════════════════════════════"
