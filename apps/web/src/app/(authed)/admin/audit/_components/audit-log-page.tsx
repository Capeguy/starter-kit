'use client'

import { useState } from 'react'
import { Avatar } from '@opengovsg/oui'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { useSuspenseQuery } from '@tanstack/react-query'

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
import { useTRPC } from '~/trpc/react'
import { formatAuditEvent } from '../../../_components/audit-action-labels'
import { RelativeTime } from '../../../_components/relative-time'

export const AuditLogPage = () => {
  const trpc = useTRPC()
  const [actionFilter, setActionFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')

  const { data } = useSuspenseQuery(
    trpc.audit.list.queryOptions({
      limit: 50,
      action: actionFilter || null,
      userId: userIdFilter || null,
    }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Breadcrumbs
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">Audit log</h1>
        <p className="prose-body-2 text-base-content-medium">
          Security-relevant events: passkey registrations, authentications,
          resets, role changes, and account deletions.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <TextField
            label="Filter by action"
            inputProps={{
              placeholder: 'e.g. auth.passkey.register',
              name: 'action',
            }}
            value={actionFilter}
            onChange={setActionFilter}
          />
        </div>
        <div className="flex-1">
          <TextField
            label="Filter by user ID"
            inputProps={{ placeholder: 'cuid…', name: 'userId' }}
            value={userIdFilter}
            onChange={setUserIdFilter}
          />
        </div>
        <div className="flex items-end">
          <Button
            size="md"
            variant="outline"
            onPress={() => {
              setActionFilter('')
              setUserIdFilter('')
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <Infobox variant="info">No audit entries match the filter.</Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>When</DataTableHead>
                <DataTableHead>Action</DataTableHead>
                <DataTableHead>User</DataTableHead>
                <DataTableHead>IP</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="whitespace-nowrap">
                    <RelativeTime date={row.createdAt} />
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>
                        {formatAuditEvent(
                          {
                            action: row.action,
                            metadata: row.metadata,
                            user: row.user,
                          },
                          'admin',
                          data.relatedUsers,
                        )}
                      </span>
                      <span className="prose-caption-2 text-base-content-medium font-mono">
                        {row.action}
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">
                    {row.user ? (
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="xs"
                          name={row.user.name ?? 'Unknown'}
                          getInitials={(name) => name.slice(0, 2).toUpperCase()}
                        >
                          <Avatar.Fallback />
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{row.user.name ?? '(unnamed)'}</span>
                          <span className="prose-caption-2 text-base-content-medium font-mono">
                            {row.user.id}
                          </span>
                        </div>
                      </div>
                    ) : (
                      '(deleted)'
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-base-content-medium font-mono whitespace-nowrap">
                    {row.ip ?? '—'}
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
