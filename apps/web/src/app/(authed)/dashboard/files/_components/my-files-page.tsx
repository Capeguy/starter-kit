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

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from '~/components/ui/data-table'
import { Capability, hasCapability } from '~/lib/rbac'
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
  const { data: me } = useSuspenseQuery(trpc.me.get.queryOptions())
  const canUpload = hasCapability(me?.role.capabilities, Capability.FileUpload)

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

      {canUpload ? (
        <div className="border-base-divider-medium flex flex-col items-start gap-3 rounded-md border p-4">
          <FilePickerButton
            label="Upload a file"
            isPending={uploading}
            onFileSelected={(f) => void handleUpload(f)}
          />
        </div>
      ) : (
        <Infobox variant="info">
          File uploads are restricted to roles with the <code>file.upload</code>{' '}
          capability. Ask an admin to grant it if you need to upload.
        </Infobox>
      )}

      {data.items.length === 0 ? (
        <Infobox variant="info">
          No files yet.
          {canUpload ? ' Upload one above.' : ''}
        </Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Filename</DataTableHead>
                <DataTableHead>Size</DataTableHead>
                <DataTableHead>Uploaded</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((f) => (
                <DataTableRow key={f.id}>
                  <DataTableCell>
                    <a
                      href={`/api/files/${f.id}/download`}
                      className="text-base-content-brand hover:underline"
                    >
                      {f.filename}
                    </a>
                  </DataTableCell>
                  <DataTableCell className="text-base-content-medium">
                    {formatBytes(f.size)}
                  </DataTableCell>
                  <DataTableCell className="text-base-content-medium">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(f.createdAt)}
                  </DataTableCell>
                  <DataTableCell className="text-right">
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
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableRoot>
        </DataTable>
      )}
    </div>
  )
}
