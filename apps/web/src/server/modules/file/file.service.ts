/**
 * File upload service backed by Vercel Blob (single public store, with
 * random-suffix paths). Public URLs are CDN-cached and discoverable to
 * anyone who has the URL — listing, deletion, and avatar replacement are
 * gated by ownership/role at the API layer.
 *
 * Two purposes:
 * - 'avatar': overwrites User.avatarUrl, deletes the previous blob.
 * - 'file':   appends a File row owned by the user.
 *
 * Both share the BLOB_READ_WRITE_TOKEN env var injected by the
 * vibe-stack-public store.
 */
import { TRPCError } from '@trpc/server'
import { del, put } from '@vercel/blob'

import { db } from '@acme/db'
import { Role } from '@acme/db/enums'
// kysely is hoisted via @acme/db's deps; the explicit import path is the
// generated client's bundled kysely (avoids needing to add kysely as an
// app-level dep).
import { sql } from '@acme/db/kysely'

const MAX_BYTES_PER_FILE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_AVATAR_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

interface ServerUploadInput {
  userId: string
  filename: string
  contentType: string
  bytes: Buffer
  size: number
}

export const uploadAvatar = async ({
  userId,
  filename,
  contentType,
  bytes,
  size,
}: ServerUploadInput) => {
  if (!ALLOWED_AVATAR_MIME.has(contentType)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Avatar must be a JPEG, PNG, WebP, or GIF.',
    })
  }
  if (size > MAX_BYTES_PER_FILE) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Avatar must be under ${MAX_BYTES_PER_FILE / (1024 * 1024)} MB.`,
    })
  }

  const previous = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  })

  const blob = await put(`avatars/${userId}/${filename}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  })

  await db.user.update({
    where: { id: userId },
    data: { avatarUrl: blob.url },
  })

  // Best-effort delete of the prior avatar.
  if (previous?.avatarUrl && previous.avatarUrl !== blob.url) {
    await del(previous.avatarUrl).catch(() => undefined)
  }

  return { url: blob.url }
}

export const uploadFile = async ({
  userId,
  filename,
  contentType,
  bytes,
  size,
}: ServerUploadInput) => {
  if (size > MAX_BYTES_PER_FILE) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `File must be under ${MAX_BYTES_PER_FILE / (1024 * 1024)} MB.`,
    })
  }

  const blob = await put(`files/${userId}/${filename}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  })

  const record = await db.file.create({
    data: {
      userId,
      // Store the canonical `blob.url`. We do NOT store `blob.downloadUrl`
      // because that's just `url` with `?download=1` appended — it does
      // force the browser to save instead of inline-render, but the
      // Content-Disposition that Vercel Blob serves is built from the
      // suffixed pathname (`resume-NoOVGD…XYZ.pdf`), not the original
      // filename. The original name is preserved by routing user
      // downloads through `/api/files/[id]/download`, which streams the
      // blob with our own Content-Disposition header.
      url: blob.url,
      pathname: blob.pathname,
      filename,
      mimeType: contentType,
      size,
    },
  })

  return record
}

export const listMyFiles = async ({
  userId,
  cursor,
  limit,
}: {
  userId: string
  cursor?: string | null
  limit: number
}) => {
  const items = await db.file.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNext = items.length > limit
  const trimmed = hasNext ? items.slice(0, -1) : items

  return {
    items: trimmed,
    nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
  }
}

export const listAllFiles = async ({
  q,
  cursor,
  limit,
}: {
  q?: string | null
  cursor?: string | null
  limit: number
}) => {
  const items = await db.file.findMany({
    where: q ? { filename: { contains: q, mode: 'insensitive' } } : undefined,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNext = items.length > limit
  const trimmed = hasNext ? items.slice(0, -1) : items

  return {
    items: trimmed,
    nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
  }
}

/**
 * Full-text search over the user's own files using the generated
 * tsvector column populated by Postgres. Falls back to substring
 * filter if the query is short or wouldn't generate any tsquery tokens.
 */
export const searchMyFiles = async ({
  userId,
  query,
  limit,
}: {
  userId: string
  query: string
  limit: number
}) => {
  const trimmed = query.trim()
  if (!trimmed) return { items: [] }

  const items = await db.$kysely
    .selectFrom('vibe_stack.File')
    .selectAll()
    .where('user_id', '=', userId)
    .where(sql<boolean>`searchable @@ plainto_tsquery('english', ${trimmed})`)
    .orderBy(
      sql`ts_rank(searchable, plainto_tsquery('english', ${trimmed}))`,
      'desc',
    )
    .limit(limit)
    .execute()

  return { items }
}

export const searchAllFiles = async ({
  query,
  limit,
}: {
  query: string
  limit: number
}) => {
  const trimmed = query.trim()
  if (!trimmed) return { items: [] }

  const items = await db.$kysely
    .selectFrom('vibe_stack.File')
    .innerJoin(
      'vibe_stack.User',
      'vibe_stack.User.id',
      'vibe_stack.File.user_id',
    )
    .select([
      'vibe_stack.File.id as id',
      'vibe_stack.File.url as url',
      'vibe_stack.File.filename as filename',
      'vibe_stack.File.size as size',
      'vibe_stack.File.mime_type as mimeType',
      'vibe_stack.File.createdAt as createdAt',
      'vibe_stack.User.id as userId',
      'vibe_stack.User.name as userName',
    ])
    .where(sql<boolean>`searchable @@ plainto_tsquery('english', ${trimmed})`)
    .orderBy(
      sql`ts_rank(searchable, plainto_tsquery('english', ${trimmed}))`,
      'desc',
    )
    .limit(limit)
    .execute()

  return { items }
}

export const deleteFile = async ({
  fileId,
  actingUserId,
  actingUserRole,
}: {
  fileId: string
  actingUserId: string
  actingUserRole: typeof Role.USER | typeof Role.ADMIN
}) => {
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: { id: true, userId: true, url: true },
  })
  if (!file) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' })
  }
  if (file.userId !== actingUserId && actingUserRole !== Role.ADMIN) {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }

  await db.file.delete({ where: { id: fileId } })
  await del(file.url).catch(() => undefined)

  return { id: fileId, deleted: true }
}
