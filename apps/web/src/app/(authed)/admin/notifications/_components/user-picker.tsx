'use client'

import { useState } from 'react'
import { Avatar } from '@opengovsg/oui'
import { Infobox } from '@opengovsg/oui/infobox'
import { useQuery } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import { useTRPC } from '~/trpc/react'

interface PickedUser {
  id: string
  name: string | null
  email: string | null
}

interface UserPickerProps {
  value: PickedUser | null
  onChange: (user: PickedUser | null) => void
}

/**
 * Search-as-you-type picker backed by `admin.users.list`. Emits the full
 * picked user (id + name + email) so the caller doesn't need a second
 * lookup just to show "X notification will go to <Name>".
 */
export const UserPicker = ({ value, onChange }: UserPickerProps) => {
  const trpc = useTRPC()
  const [q, setQ] = useState('')

  const { data, isFetching } = useQuery(
    trpc.admin.users.list.queryOptions(
      { q: q.trim() || null, limit: 10 },
      { enabled: q.trim().length > 0 },
    ),
  )

  if (value) {
    return (
      <div className="border-base-divider-medium flex items-center justify-between rounded-md border p-3">
        <div className="flex flex-col">
          <span className="prose-label-md text-base-content-strong">
            {value.name ?? '(unnamed)'}
          </span>
          <span className="prose-caption-2 text-base-content-medium">
            {value.email ?? value.id}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="prose-label-sm text-base-content-brand hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Recipient"
        inputProps={{
          placeholder: 'Search by name or email…',
          name: 'recipient',
        }}
        value={q}
        onChange={setQ}
      />
      {q.trim() && (
        <ul className="border-base-divider-medium flex flex-col rounded-md border">
          {isFetching && !data ? (
            <li className="prose-caption-2 text-base-content-medium px-3 py-2">
              Searching…
            </li>
          ) : !data || data.items.length === 0 ? (
            <li className="px-3 py-2">
              <Infobox variant="info" classNames={{ base: 'p-2' }}>
                No users match.
              </Infobox>
            </li>
          ) : (
            data.items.map((u) => (
              <li
                key={u.id}
                className="border-base-divider-subtle border-b last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    onChange({ id: u.id, name: u.name, email: u.email })
                  }
                  className="hover:bg-base-canvas-alt flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <Avatar
                    size="xs"
                    name={u.name ?? 'Unknown'}
                    getInitials={(name) => name.slice(0, 2).toUpperCase()}
                  >
                    <Avatar.Fallback />
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="prose-label-md text-base-content-strong">
                      {u.name ?? '(unnamed)'}
                    </span>
                    <span className="prose-caption-2 text-base-content-medium">
                      {u.email ?? u.id}
                    </span>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
