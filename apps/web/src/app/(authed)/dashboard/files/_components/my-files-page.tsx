'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'
import { FilePickerButton } from '../../../_components/file-picker-button'

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const MyFilesPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data } = useSuspenseQuery(
    trpc.file.listMine.queryOptions({ limit: 50 }),
  )

  const deleteFile = useMutation(
    trpc.file.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('File deleted')
        await queryClient.invalidateQueries({
          queryKey: trpc.file.listMine.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/file', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      toast.success(`Uploaded ${file.name}`)
      await queryClient.invalidateQueries({
        queryKey: trpc.file.listMine.queryKey(),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">My files</h1>
        <p className="prose-body-2 text-base-content-medium">
          Upload, list, and delete your files. Stored on Vercel Blob; URLs are
          public-but-obscure (random suffix per upload).
        </p>
      </header>

      <div className="border-base-divide-medium flex flex-col items-start gap-3 rounded-md border p-4">
        <FilePickerButton
          label="Upload a file"
          isPending={uploading}
          onFileSelected={(f) => void handleUpload(f)}
        />
      </div>

      {data.items.length === 0 ? (
        <Infobox variant="info">No files yet. Upload one above.</Infobox>
      ) : (
        <div className="border-base-divide-medium overflow-x-auto rounded-md border">
          <table className="w-full min-w-max text-left">
            <thead className="prose-label-sm bg-base-canvas-alt text-base-content-medium">
              <tr>
                <th className="px-3 py-2">Filename</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="prose-body-2">
              {data.items.map((f) => (
                <tr key={f.id} className="border-base-divide-subtle border-t">
                  <td className="px-3 py-2">
                    <a
                      href={`/api/files/${f.id}/download`}
                      className="text-base-content-brand hover:underline"
                    >
                      {f.filename}
                    </a>
                  </td>
                  <td className="text-base-content-medium px-3 py-2">
                    {formatBytes(f.size)}
                  </td>
                  <td className="text-base-content-medium px-3 py-2">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(f.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        if (confirm(`Delete ${f.filename}?`)) {
                          deleteFile.mutate({ fileId: f.id })
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
