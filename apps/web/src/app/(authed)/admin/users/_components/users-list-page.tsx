'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@opengovsg/oui'
import { Badge } from '@opengovsg/oui/badge'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQuery,
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
import { Capability, hasCapability, SystemRoleId } from '~/lib/rbac'
import { useTRPC } from '~/trpc/react'
import { InviteModal } from '../../_components/invite-modal'
import { ResetPasskeyModal } from '../../_components/reset-passkey-modal'

const formatDateTime = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(d)
    : '—'

interface UserRow {
  kind: 'user'
  id: string
  name: string | null
  email: string | null
  roleId: string
  passkeyCount: number
  lastLogin: Date | null
}

interface InviteRow {
  kind: 'invite'
  id: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
  issuedByLabel: string
  createdAt: Date
  expiresAt: Date | null
  token: string
}

type Row = UserRow | InviteRow

export const UsersListPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [resetTarget, setResetTarget] = useState<{
    userId: string
    name: string | null
  } | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  const { data: usersData } = useSuspenseQuery(
    trpc.admin.users.list.queryOptions({ q: q || null, limit: 50 }),
  )
  const { data: rolesData } = useSuspenseQuery(
    trpc.admin.roles.list.queryOptions(),
  )
  const { data: me } = useSuspenseQuery(trpc.me.get.queryOptions())

  const canImpersonate = hasCapability(
    me?.role.capabilities,
    Capability.UserImpersonate,
  )
  const canInvite = hasCapability(
    me?.role.capabilities,
    Capability.UserInviteIssue,
  )

  // Invites are only loaded when the admin actually has the capability —
  // and the un-filtered list is the only place they're surfaced (a search
  // for a name/email scopes the table down to existing users only).
  const { data: invitesData } = useQuery({
    ...trpc.admin.invites.list.queryOptions({ limit: 50 }),
    enabled: canInvite,
  })

  const impersonate = useMutation(
    trpc.impersonation.start.mutationOptions({
      onSuccess: async (result) => {
        toast.success(`Impersonating ${result.targetName ?? 'user'}`)
        await queryClient.invalidateQueries()
        router.push('/dashboard')
        router.refresh()
      },
      onError: (err) => toast.error(err.message),
    }),
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

  const deleteUserMutation = useMutation(
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

  const revokeInviteMutation = useMutation(
    trpc.admin.invites.revoke.mutationOptions({
      onSuccess: async () => {
        toast.success('Invite revoked')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.invites.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    // Active invites at the top so they're prominent; only when the admin
    // isn't filtering for a specific user.
    if (canInvite && !q && invitesData) {
      const now = new Date()
      for (const i of invitesData.items) {
        if (i.consumedAt || i.revokedAt) continue
        if (i.expiresAt && i.expiresAt < now) continue
        out.push({
          kind: 'invite',
          id: i.id,
          name: i.name,
          email: i.email,
          roleId: i.role.id,
          roleName: i.role.name,
          issuedByLabel: i.issuedBy.name ?? i.issuedBy.email ?? '—',
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          token: i.token,
        })
      }
    }
    for (const u of usersData.items) {
      out.push({
        kind: 'user',
        id: u.id,
        name: u.name,
        email: u.email,
        roleId: u.roleId,
        passkeyCount: u._count.passkeys,
        lastLogin: u.lastLogin,
      })
    }
    return out
  }, [canInvite, invitesData, q, usersData])

  const copyInviteUrl = async (token: string) => {
    try {
      const url = `${window.location.origin}/invite/${token}`
      await navigator.clipboard.writeText(url)
      toast.success('Invite URL copied')
    } catch {
      toast.error('Could not copy URL')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Breadcrumbs
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
      />
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="prose-h2 text-base-content-strong">Users</h1>
          <p className="prose-body-2 text-base-content-medium">
            Active accounts and pending invites. Issue an invite link, change
            roles, reset passkeys for locked-out users.
          </p>
        </div>
        {canInvite && (
          <Button className="shrink-0" onPress={() => setInviteModalOpen(true)}>
            New invite
          </Button>
        )}
      </header>

      <TextField
        label="Search by name or email (existing users only)"
        inputProps={{ placeholder: 'jane', name: 'q' }}
        value={q}
        onChange={setQ}
      />

      {rows.length === 0 ? (
        <Infobox variant="info">
          {q ? 'No users match the search.' : 'No users or invites yet.'}
        </Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Email</DataTableHead>
                <DataTableHead>Role</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Last activity</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((row) =>
                row.kind === 'user' ? (
                  <DataTableRow key={`user-${row.id}`}>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="xs"
                          name={row.name ?? 'Unknown'}
                          getInitials={(name) => name.slice(0, 2).toUpperCase()}
                        >
                          <Avatar.Fallback />
                        </Avatar>
                        {row.name ?? '(unnamed)'}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {row.email ?? '—'}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <select
                          className="border-base-divider-medium bg-base-canvas-default rounded border px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          value={row.roleId}
                          onChange={(e) =>
                            setRoleMutation.mutate({
                              userId: row.id,
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
                          {rolesData.items.find((r) => r.id === row.roleId)
                            ?.name ?? row.roleId}
                        </Badge>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="subtle" size="sm" color="success">
                        Active
                      </Badge>
                      <span className="prose-caption-2 text-base-content-medium ml-2">
                        {row.passkeyCount} passkey
                        {row.passkeyCount === 1 ? '' : 's'}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {row.lastLogin ? formatDateTime(row.lastLogin) : '—'}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            setResetTarget({
                              userId: row.id,
                              name: row.name,
                            })
                          }
                        >
                          Reset passkey
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            setRoleMutation.mutate({
                              userId: row.id,
                              roleId:
                                row.roleId === SystemRoleId.Admin
                                  ? SystemRoleId.User
                                  : SystemRoleId.Admin,
                            })
                          }
                        >
                          {row.roleId === SystemRoleId.Admin
                            ? 'Demote'
                            : 'Promote'}
                        </Button>
                        {canImpersonate && row.id !== me?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onPress={() =>
                              impersonate.mutate({ userId: row.id })
                            }
                          >
                            Impersonate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            if (
                              confirm(
                                `Delete ${row.name ?? row.id}? This cannot be undone.`,
                              )
                            ) {
                              deleteUserMutation.mutate({ userId: row.id })
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  <DataTableRow key={`invite-${row.id}`}>
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="xs"
                          name={row.name ?? row.email ?? '?'}
                          getInitials={(name) => name.slice(0, 2).toUpperCase()}
                        >
                          <Avatar.Fallback />
                        </Avatar>
                        {row.name ?? '(no name)'}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {row.email ?? '—'}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="subtle" size="sm">
                        {row.roleName}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="subtle" size="sm" color="warning">
                        Invited
                      </Badge>
                      <span className="prose-caption-2 text-base-content-medium ml-2">
                        by {row.issuedByLabel}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {row.expiresAt
                        ? `Expires ${formatDateTime(row.expiresAt)}`
                        : 'No expiry'}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => copyInviteUrl(row.token)}
                        >
                          Copy URL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            if (
                              confirm(
                                `Revoke invite for ${row.name ?? row.email ?? 'recipient'}? The link will stop working immediately.`,
                              )
                            ) {
                              revokeInviteMutation.mutate({ id: row.id })
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ),
              )}
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

      {inviteModalOpen && (
        <InviteModal
          onClose={() => setInviteModalOpen(false)}
          onIssued={async () => {
            await queryClient.invalidateQueries({
              queryKey: trpc.admin.invites.list.queryKey(),
            })
          }}
        />
      )}
    </div>
  )
}
