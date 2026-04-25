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
