'use client'

import { useState } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

import { TextField } from '@acme/ui/text-field'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from '~/components/ui/data-table'
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
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold">All files</h1>
        <p className="text-muted-foreground text-sm">
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
        <Alert variant="info">
          <Info />
          <AlertDescription>No files match.</AlertDescription>
        </Alert>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Filename</DataTableHead>
                <DataTableHead>Owner</DataTableHead>
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
                      className="text-primary hover:underline"
                    >
                      {f.filename}
                    </a>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {f.user.name ?? f.user.id}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {formatBytes(f.size)}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(f.createdAt)}
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
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
