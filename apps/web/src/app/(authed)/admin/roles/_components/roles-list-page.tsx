'use client'

import { useState } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

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
import { RoleEditor } from './role-editor'
import { RoleUsersModal } from './role-users-modal'

interface RoleSummary {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  capabilities: string[]
  _count: { users: number }
}

export const RolesListPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RoleSummary | 'new' | null>(null)
  const [usersModalRole, setUsersModalRole] = useState<{
    id: string
    name: string
  } | null>(null)

  const { data } = useSuspenseQuery(trpc.admin.roles.list.queryOptions())

  const deleteMutation = useMutation(
    trpc.admin.roles.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('Role deleted')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.roles.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RegistryBreadcrumbs />
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold">Roles</h1>
          <p className="text-muted-foreground text-sm">
            Define which users can do what. Each role grants a set of dotted
            capability codes (e.g. <code>file.upload</code>). System roles
            (Admin, User) cannot be deleted; their capability sets are still
            editable.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setEditing('new')}>
          New role
        </Button>
      </header>

      {data.items.length === 0 ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>
            No roles yet — that&apos;s a problem. Re-run the RBAC seed
            migration.
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Description</DataTableHead>
                <DataTableHead>Capabilities</DataTableHead>
                <DataTableHead>Users</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{r.name}</span>
                      {r.isSystem && (
                        <span className="text-muted-foreground text-xs">
                          System role
                        </span>
                      )}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {r.description ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {r.capabilities.length === 0
                      ? '(none)'
                      : `${r.capabilities.length} granted`}
                  </DataTableCell>
                  <DataTableCell>
                    <button
                      type="button"
                      onClick={() =>
                        setUsersModalRole({ id: r.id, name: r.name })
                      }
                      className="text-primary hover:underline"
                      aria-label={`View ${r._count.users} user${r._count.users === 1 ? '' : 's'} in role ${r.name}`}
                    >
                      {r._count.users}
                    </button>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.isSystem || r._count.users > 0}
                        onClick={() => {
                          if (
                            confirm(
                              `Delete role "${r.name}"? This cannot be undone.`,
                            )
                          ) {
                            deleteMutation.mutate({ id: r.id })
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableRoot>
        </DataTable>
      )}

      {editing && (
        <RoleEditor
          role={editing === 'new' ? null : editing}
          allCapabilities={data.allCapabilities}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: trpc.admin.roles.list.queryKey(),
            })
            setEditing(null)
          }}
        />
      )}

      {usersModalRole && (
        <RoleUsersModal
          role={usersModalRole}
          onClose={() => setUsersModalRole(null)}
        />
      )}
    </div>
  )
}
