'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { useSuspenseQuery } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import { useTRPC } from '~/trpc/react'

const formatTimestamp = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)

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
        <div className="border-base-divide-medium overflow-x-auto rounded-md border">
          <table className="w-full text-left">
            <thead className="prose-label-sm bg-base-canvas-alt text-base-content-medium">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody className="prose-body-2">
              {data.items.map((row) => (
                <tr key={row.id} className="border-base-divide-subtle border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.action}</td>
                  <td className="px-3 py-2">
                    {row.user
                      ? `${row.user.name ?? '(unnamed)'} · ${row.user.id}`
                      : '(deleted)'}
                  </td>
                  <td className="text-base-content-medium px-3 py-2 font-mono">
                    {row.ip ?? '—'}
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
