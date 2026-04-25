'use client'

import { useState } from 'react'
import { Avatar } from '@opengovsg/oui'
import { Badge } from '@opengovsg/oui/badge'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import { Breadcrumbs } from '~/components/ui/breadcrumbs'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from '~/components/ui/data-table'
import { SystemRoleId } from '~/lib/rbac'
import { useTRPC } from '~/trpc/react'
import { ResetPasskeyModal } from '../../_components/reset-passkey-modal'

export const UsersListPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [resetTarget, setResetTarget] = useState<{
    userId: string
    name: string | null
  } | null>(null)

  const { data } = useSuspenseQuery(
    trpc.admin.users.list.queryOptions({ q: q || null, limit: 50 }),
  )
  const { data: rolesData } = useSuspenseQuery(
    trpc.admin.roles.list.queryOptions(),
  )

  const setRoleMutation = useMutation(
    trpc.admin.users.setRole.mutationOptions({
      onSuccess: async () => {
        toast.success('Role updated')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.users.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const deleteMutation = useMutation(
    trpc.admin.users.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('User deleted')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.users.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Breadcrumbs
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">Users</h1>
        <p className="prose-body-2 text-base-content-medium">
          Manage accounts, change roles, and reset passkeys for locked-out
          users.
        </p>
      </header>

      <TextField
        label="Search by name or email"
        inputProps={{ placeholder: 'jane', name: 'q' }}
        value={q}
        onChange={setQ}
      />

      {data.items.length === 0 ? (
        <Infobox variant="info">No users match the search.</Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead>Role</DataTableHead>
                <DataTableHead>Passkeys</DataTableHead>
                <DataTableHead>Last login</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((u) => (
                <DataTableRow key={u.id}>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <Avatar
                        size="xs"
                        name={u.name ?? 'Unknown'}
                        getInitials={(name) => name.slice(0, 2).toUpperCase()}
                      >
                        <Avatar.Fallback />
                      </Avatar>
                      {u.name ?? '(unnamed)'}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-base-content-medium">
                    {u.email ?? '—'}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <select
                        className="border-base-divider-medium bg-base-canvas-default rounded border px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        value={u.roleId}
                        onChange={(e) =>
                          setRoleMutation.mutate({
                            userId: u.id,
                            roleId: e.target.value,
                          })
                        }
                      >
                        {rolesData.items.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <Badge variant="subtle" size="sm">
                        {rolesData.items.find((r) => r.id === u.roleId)?.name ??
                          u.roleId}
                      </Badge>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{u._count.passkeys}</DataTableCell>
                  <DataTableCell className="text-base-content-medium">
                    {u.lastLogin
                      ? new Intl.DateTimeFormat('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(u.lastLogin)
                      : '—'}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          setResetTarget({ userId: u.id, name: u.name })
                        }
                      >
                        Reset passkey
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          setRoleMutation.mutate({
                            userId: u.id,
                            roleId:
                              u.roleId === SystemRoleId.Admin
                                ? SystemRoleId.User
                                : SystemRoleId.Admin,
                          })
                        }
                      >
                        {u.roleId === SystemRoleId.Admin ? 'Demote' : 'Promote'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          if (
                            confirm(
                              `Delete ${u.name ?? u.id}? This cannot be undone.`,
                            )
                          ) {
                            deleteMutation.mutate({ userId: u.id })
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

      {resetTarget && (
        <ResetPasskeyModal
          userId={resetTarget.userId}
          targetName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}
