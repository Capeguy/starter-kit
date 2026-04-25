import { NextResponse } from 'next/server'

import { uploadFile } from '~/server/modules/file/file.service'
import { getSession } from '~/server/session'

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
    const record = await uploadFile({
      userId: session.userId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: buffer,
      size: buffer.byteLength,
    })
    return NextResponse.json({
      id: record.id,
      url: record.url,
      filename: record.filename,
      size: record.size,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'upload failed',
      },
      { status: 400 },
    )
  }
}
