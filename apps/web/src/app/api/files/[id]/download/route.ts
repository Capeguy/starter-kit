/**
 * Authenticated file-download proxy.
 *
 * Why this route exists: files are stored on Vercel Blob with a random
 * suffix on the pathname (`resume-NoOVGD…XYZ.pdf`). Vercel's CDN serves
 * those URLs with `Content-Disposition: attachment; filename="<suffixed>"`
 * generated from the pathname — there is no SDK option to override this at
 * upload time, and the HTML `download="…"` attribute is silently ignored
 * cross-origin (see https://developer.mozilla.org/.../a/download). So
 * fetching the blob URL directly always saves the file with the suffix
 * embedded in the name.
 *
 * This route streams the blob through us and rewrites Content-Disposition
 * to use the original `File.filename` we stored at upload. We also enforce
 * that the request is authenticated and the caller is the owner (or an
 * admin) — the underlying blob URL is still public-but-obscure, so this
 * is a UX fix, not a privacy boundary.
 */
import type { NextRequest } from 'next/server'

import { db } from '@acme/db'

import { Capability, hasCapability } from '~/lib/rbac'
import { getSession } from '~/server/session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const file = await db.file.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      url: true,
      filename: true,
      mimeType: true,
    },
  })
  if (!file) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }

  // Owner can always download. Anyone else needs the file.read.any capability
  // (matches the deletion-authz pattern in file.service.ts).
  if (file.userId !== session.userId) {
    const me = await db.user.findUnique({
      where: { id: session.userId },
      select: { role: { select: { capabilities: true } } },
    })
    if (!hasCapability(me?.role.capabilities, Capability.FileReadAny)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const upstream = await fetch(file.url)
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: `upstream blob fetch failed (${upstream.status})` },
      { status: 502 },
    )
  }

  // RFC 5987: ASCII fallback + UTF-8-encoded `filename*` for non-ASCII.
  // The ASCII fallback strips quotes/control chars to keep the header valid.
  const asciiFallback = file.filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
  const contentDisposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`

  const headers = new Headers()
  headers.set('Content-Disposition', contentDisposition)
  // file.mimeType is set at upload (defaults to 'application/octet-stream')
  // so it's always present here.
  headers.set('Content-Type', file.mimeType)
  const upstreamLength = upstream.headers.get('content-length')
  if (upstreamLength) headers.set('Content-Length', upstreamLength)
  // Don't let intermediaries cache an authenticated response.
  headers.set('Cache-Control', 'private, no-store')

  return new Response(upstream.body, { status: 200, headers })
}
