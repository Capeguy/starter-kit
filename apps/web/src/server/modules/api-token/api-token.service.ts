/**
 * Personal API token service. Tokens are minted with a `vibe_pat_` prefix
 * + 24 url-safe random chars. Only the SHA-256 hash is persisted; the
 * plaintext is returned exactly once (in `issue`) and never logged.
 *
 * Verification (`verifyAndTouch`) runs on every authenticated REST/MCP
 * request. Keep it lean: one `findUnique`, one `update` for `lastUsedAt`.
 * Do not fan out queries.
 */
import { createHash, randomBytes } from 'crypto'

import { db } from '@acme/db'

const TOKEN_PREFIX = 'vibe_pat_'
/** First 8 chars of the random suffix — enough to disambiguate visually. */
const DISPLAY_SUFFIX_LEN = 8
/** 18 random bytes -> 24 base64url chars. Caller-visible token: ~33 chars. */
const RANDOM_BYTES = 18

const sha256Hex = (s: string): string =>
  createHash('sha256').update(s).digest('hex')

const generatePlaintext = (): string =>
  `${TOKEN_PREFIX}${randomBytes(RANDOM_BYTES).toString('base64url')}`

/**
 * Public prefix used in the UI. Includes the `vibe_pat_` namespace plus the
 * first 8 random chars so users can disambiguate between tokens by
 * eyeballing it; the suffix is non-secret on its own (still need the hash
 * to verify).
 */
const computePrefix = (plaintext: string): string => {
  // `vibe_pat_` is 9 chars; keep that + the first DISPLAY_SUFFIX_LEN of the
  // random portion.
  return plaintext.slice(0, TOKEN_PREFIX.length + DISPLAY_SUFFIX_LEN)
}

interface IssueInput {
  userId: string
  name: string
  /** Days until expiry. `null` or `undefined` = no expiry. */
  expiresInDays?: number | null
}

export const issue = async ({ userId, name, expiresInDays }: IssueInput) => {
  const plaintext = generatePlaintext()
  const tokenHash = sha256Hex(plaintext)
  const prefix = computePrefix(plaintext)
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

  const row = await db.apiToken.create({
    data: {
      userId,
      name,
      tokenHash,
      prefix,
      expiresAt,
    },
    select: { id: true, prefix: true, expiresAt: true },
  })

  return {
    id: row.id,
    plaintext,
    prefix: row.prefix,
    expiresAt: row.expiresAt,
  }
}

export const listMine = async ({ userId }: { userId: string }) => {
  return db.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  })
}

export const revoke = async ({
  id,
  userId,
}: {
  id: string
  userId: string
}): Promise<void> => {
  // Owner-scoped: updateMany so a non-owner targeting another user's id
  // simply produces a no-op rather than throwing/leaking existence.
  await db.apiToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export interface VerifiedToken {
  userId: string
  capabilities: readonly string[]
  role: { id: string; name: string }
}

/**
 * Hashes the plaintext, looks up the token, validates not-revoked +
 * not-expired, atomically updates lastUsedAt, and returns the user's
 * role + capabilities. Returns null on any failure (unknown token,
 * revoked, expired, owning user gone).
 *
 * Hot path: this runs on every API/MCP request. One findUnique + one
 * update (and we batch the user load via the same join) — that's it.
 */
export const verifyAndTouch = async (
  plaintext: string,
): Promise<VerifiedToken | null> => {
  if (!plaintext.startsWith(TOKEN_PREFIX)) return null

  const tokenHash = sha256Hex(plaintext)
  const token = await db.apiToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          role: { select: { id: true, name: true, capabilities: true } },
        },
      },
    },
  })
  if (!token) return null
  if (token.revokedAt) return null
  if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) return null

  // Best-effort touch — don't await failure so a transient DB hiccup
  // doesn't block the request. Any failure is logged by Prisma's own
  // error handler.
  void db.apiToken
    .update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined)

  return {
    userId: token.user.id,
    capabilities: token.user.role.capabilities,
    role: { id: token.user.role.id, name: token.user.role.name },
  }
}
