'use client'

import { useMemo, useState } from 'react'
import { Avatar } from '@opengovsg/oui'
import { Infobox } from '@opengovsg/oui/infobox'
import { useQueries, useQuery } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import { useTRPC } from '~/trpc/react'

interface AllowedUsersPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
}

/**
 * Multi-select user picker scoped to the feature-flag editor. Backed by
 * `admin.users.list` (search-as-you-type) plus a separate `admin.users.get`
 * lookup per already-selected id so we can show name/email chips for users
 * that aren't in the current search results.
 */
export const AllowedUsersPicker = ({
  value,
  onChange,
}: AllowedUsersPickerProps) => {
  const trpc = useTRPC()
  const [q, setQ] = useState('')

  const { data: searchResults, isFetching } = useQuery(
    trpc.admin.users.list.queryOptions(
      { q: q.trim() || null, limit: 10 },
      { enabled: q.trim().length > 0 },
    ),
  )

  // Resolve chip labels for already-selected users in a single hook call so
  // we don't break Rules of Hooks if `value` changes shape between renders.
  // Cheap: typical allowlists are <10 users, and TanStack Query caches each.
  const selectedQueries = useQueries({
    queries: value.map((id) =>
      trpc.admin.users.get.queryOptions({ userId: id }, { staleTime: 60_000 }),
    ),
  })
  const selectedUsers = useMemo(
    () => value.map((id, i) => ({ id, data: selectedQueries[i]?.data })),
    [value, selectedQueries],
  )

  const addUser = (id: string) => {
    if (value.includes(id)) return
    onChange([...value, id])
    setQ('')
  }
  const removeUser = (id: string) => {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="prose-label-md mb-1">Allowed users</legend>
      <p className="prose-caption-2 text-base-content-medium mb-1">
        These users always have the flag on, regardless of rollout percent.
      </p>

      {selectedUsers.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedUsers.map(({ id, data: u }) => (
            <li
              key={id}
              className="border-base-divider-medium bg-base-canvas-alt flex items-center gap-2 rounded-full border px-2 py-1"
            >
              <span className="prose-label-sm">
                {u?.name ?? u?.email ?? id}
              </span>
              <button
                type="button"
                onClick={() => removeUser(id)}
                className="text-base-content-medium hover:text-base-content-strong"
                aria-label={`Remove ${u?.name ?? id}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <TextField
        label="Add user"
        inputProps={{
          placeholder: 'Search by name or email…',
          name: 'allowed-user-search',
        }}
        value={q}
        onChange={setQ}
      />

      {q.trim() && (
        <ul className="border-base-divider-medium flex flex-col rounded-md border">
          {isFetching && !searchResults ? (
            <li className="prose-caption-2 text-base-content-medium px-3 py-2">
              Searching…
            </li>
          ) : !searchResults || searchResults.items.length === 0 ? (
            <li className="px-3 py-2">
              <Infobox variant="info" classNames={{ base: 'p-2' }}>
                No users match.
              </Infobox>
            </li>
          ) : (
            searchResults.items
              // Hide already-added users so the user list never offers a no-op.
              .filter((u) => !value.includes(u.id))
              .map((u) => (
                <li
                  key={u.id}
                  className="border-base-divider-subtle border-b last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => addUser(u.id)}
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
    </fieldset>
  )
}
