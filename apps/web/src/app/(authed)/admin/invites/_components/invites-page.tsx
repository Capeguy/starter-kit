'use client'

import { useState } from 'react'
import { Badge } from '@opengovsg/oui/badge'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

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
import { useTRPC } from '~/trpc/react'
import { InviteModal } from '../../_components/invite-modal'

const formatDateTime = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(d)
    : '—'

type InviteStatus = 'claimed' | 'revoked' | 'expired' | 'active'

const statusOf = (i: {
  consumedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date | null
}): InviteStatus => {
  if (i.consumedAt) return 'claimed'
  if (i.revokedAt) return 'revoked'
  if (i.expiresAt && i.expiresAt < new Date()) return 'expired'
  return 'active'
}

const statusBadge = (status: InviteStatus) => {
  switch (status) {
    case 'active':
      return <Badge variant="subtle">Active</Badge>
    case 'claimed':
      return <Badge variant="subtle">Claimed</Badge>
    case 'expired':
      return <Badge variant="subtle">Expired</Badge>
    case 'revoked':
      return <Badge variant="subtle">Revoked</Badge>
  }
}

export const InvitesPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data } = useSuspenseQuery(
    trpc.admin.invites.list.queryOptions({ limit: 50 }),
  )

  const revokeMutation = useMutation(
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

  const copyUrl = async (token: string) => {
    try {
      const url = `${window.location.origin}/invite/${token}`
      await navigator.clipboard.writeText(url)
      toast.success('Invite URL copied to clipboard')
    } catch {
      toast.error('Could not copy URL')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Breadcrumbs
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Invites' }]}
      />
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="prose-h2 text-base-content-strong">Invites</h1>
          <p className="prose-body-2 text-base-content-medium">
            Generate one-time URLs that let recipients self-register a passkey
            and land in the app under a pre-assigned role.
          </p>
        </div>
        <Button className="shrink-0" onPress={() => setModalOpen(true)}>
          New invite
        </Button>
      </header>

      {data.items.length === 0 ? (
        <Infobox variant="info">
          No invites yet. Click <strong>New invite</strong> to issue one.
        </Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Recipient</DataTableHead>
                <DataTableHead>Role</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead>Issued by</DataTableHead>
                <DataTableHead>Created</DataTableHead>
                <DataTableHead>Expires</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((i) => {
                const status = statusOf(i)
                return (
                  <DataTableRow key={i.id}>
                    <DataTableCell>
                      <div className="flex flex-col">
                        <span className="prose-label-md">
                          {i.name ?? i.email ?? '(no pre-fill)'}
                        </span>
                        {i.name && i.email && (
                          <span className="prose-caption-2 text-base-content-medium">
                            {i.email}
                          </span>
                        )}
                        {i.claimedBy && (
                          <span className="prose-caption-2 text-base-content-medium">
                            Claimed by{' '}
                            {i.claimedBy.name ?? i.claimedBy.email ?? '—'}
                          </span>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{i.role.name}</DataTableCell>
                    <DataTableCell>{statusBadge(status)}</DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {i.issuedBy.name ?? i.issuedBy.email ?? '—'}
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {formatDateTime(i.createdAt)}
                    </DataTableCell>
                    <DataTableCell className="text-base-content-medium">
                      {i.expiresAt ? formatDateTime(i.expiresAt) : 'No expiry'}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={status !== 'active'}
                          onPress={() => copyUrl(i.token)}
                        >
                          Copy URL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={status !== 'active'}
                          onPress={() => {
                            if (
                              confirm(
                                `Revoke invite for ${i.name ?? i.email ?? 'recipient'}? The link will stop working immediately.`,
                              )
                            ) {
                              revokeMutation.mutate({ id: i.id })
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTableRoot>
        </DataTable>
      )}

      {modalOpen && (
        <InviteModal
          onClose={() => setModalOpen(false)}
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
