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

import { TextField } from '@acme/ui/text-field'

import { useTRPC } from '~/trpc/react'

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const AdminFilesPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')

  const { data } = useSuspenseQuery(
    trpc.admin.files.list.queryOptions({ q: q || null, limit: 50 }),
  )

  const deleteFile = useMutation(
    trpc.admin.files.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('File deleted')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.files.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">All files</h1>
        <p className="prose-body-2 text-base-content-medium">
          Every file uploaded by every user. Delete to remove from blob storage
          and the index.
        </p>
      </header>

      <TextField
        label="Search by filename"
        inputProps={{ placeholder: 'invoice', name: 'q' }}
        value={q}
        onChange={setQ}
      />

      {data.items.length === 0 ? (
        <Infobox variant="info">No files match.</Infobox>
      ) : (
        <div className="border-base-divide-medium overflow-x-auto rounded-md border">
          <table className="w-full min-w-max text-left">
            <thead className="prose-label-sm bg-base-canvas-alt text-base-content-medium">
              <tr>
                <th className="px-3 py-2">Filename</th>
                <th className="px-3 py-2">Owner</th>
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
                    {f.user.name ?? f.user.id}
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
