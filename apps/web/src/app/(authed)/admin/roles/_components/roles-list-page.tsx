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
import { RoleEditor } from './role-editor'

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
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="prose-h2 text-base-content-strong">Roles</h1>
          <p className="prose-body-2 text-base-content-medium">
            Define which users can do what. Each role grants a set of dotted
            capability codes (e.g. <code>file.upload</code>). System roles
            (Admin, User) cannot be deleted; their capability sets are still
            editable.
          </p>
        </div>
        <Button onPress={() => setEditing('new')}>New role</Button>
      </header>

      {data.items.length === 0 ? (
        <Infobox variant="warning">
          No roles yet — that's a problem. Re-run the RBAC seed migration.
        </Infobox>
      ) : (
        <div className="border-base-divide-medium overflow-x-auto rounded-md border">
          <table className="w-full min-w-max text-left">
            <thead className="prose-label-sm bg-base-canvas-alt text-base-content-medium">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Capabilities</th>
                <th className="px-3 py-2">Users</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="prose-body-2">
              {data.items.map((r) => (
                <tr key={r.id} className="border-base-divide-subtle border-t">
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="prose-label-md">{r.name}</span>
                      {r.isSystem && (
                        <span className="prose-caption-2 text-base-content-medium">
                          System role
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-base-content-medium px-3 py-2">
                    {r.description ?? '—'}
                  </td>
                  <td className="text-base-content-medium px-3 py-2">
                    {r.capabilities.length === 0
                      ? '(none)'
                      : `${r.capabilities.length} granted`}
                  </td>
                  <td className="px-3 py-2">{r._count.users}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setEditing(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isDisabled={r.isSystem || r._count.users > 0}
                        onPress={() => {
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  )
}
