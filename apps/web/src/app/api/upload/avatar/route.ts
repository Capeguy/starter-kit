import { NextResponse } from 'next/server'

import { uploadAvatar } from '~/server/modules/file/file.service'
import { getSession } from '~/server/session'

// POST multipart/form-data with field "file".
export async function POST(req: Request) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'expected multipart field "file"' },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const result = await uploadAvatar({
      userId: session.userId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: buffer,
      size: buffer.byteLength,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'upload failed',
      },
      { status: 400 },
    )
  }
}
