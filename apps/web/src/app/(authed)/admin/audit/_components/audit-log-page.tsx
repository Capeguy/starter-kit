'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { TextField } from '@acme/ui/text-field'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
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
import { formatAuditEvent } from '../../../_components/audit-action-labels'
import { RelativeTime } from '../../../_components/relative-time'

const initials = (name: string | null | undefined): string =>
  name ? name.slice(0, 2).toUpperCase() : '?'

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
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold">Audit log</h1>
        <p className="text-muted-foreground text-sm">
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
            variant="outline"
            onClick={() => {
              setActionFilter('')
              setUserIdFilter('')
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            No audit entries match the filter.
          </AlertDescription>
        </Alert>
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
                      <span className="text-muted-foreground font-mono text-xs">
                        {row.action}
                      </span>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap">
                    {row.user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {initials(row.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{row.user.name ?? '(unnamed)'}</span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {row.user.id}
                          </span>
                        </div>
                      </div>
                    ) : (
                      '(deleted)'
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground font-mono whitespace-nowrap">
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
