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
        <div className="border-base-divide-medium overflow-x-auto rounded-md border">
          <table className="w-full min-w-max text-left">
            <thead className="prose-label-sm bg-base-canvas-alt text-base-content-medium">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Passkeys</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="prose-body-2">
              {data.items.map((u) => (
                <tr key={u.id} className="border-base-divide-subtle border-t">
                  <td className="px-3 py-2">{u.name ?? '(unnamed)'}</td>
                  <td className="text-base-content-medium px-3 py-2">
                    {u.email ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border-base-divide-medium bg-base-canvas-default rounded border px-2 py-1 text-sm"
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
                  </td>
                  <td className="px-3 py-2">{u._count.passkeys}</td>
                  <td className="text-base-content-medium px-3 py-2">
                    {u.lastLogin
                      ? new Intl.DateTimeFormat('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(u.lastLogin)
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
