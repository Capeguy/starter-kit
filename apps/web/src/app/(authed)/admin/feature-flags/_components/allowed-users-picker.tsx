'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { TextField } from '@acme/ui/text-field'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { useTRPC } from '~/trpc/react'

interface AllowedUsersPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
}

const initials = (name: string | null | undefined): string =>
  name ? name.slice(0, 2).toUpperCase() : '?'

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
      <legend className="mb-1 text-sm font-medium">Allowed users</legend>
      <p className="text-muted-foreground mb-1 text-xs">
        These users always have the flag on, regardless of rollout percent.
      </p>

      {selectedUsers.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selectedUsers.map(({ id, data: u }) => (
            <li
              key={id}
              className="border-border bg-muted flex items-center gap-2 rounded-full border px-2 py-1"
            >
              <span className="text-xs font-medium">
                {u?.name ?? u?.email ?? id}
              </span>
              <button
                type="button"
                onClick={() => removeUser(id)}
                className="text-muted-foreground hover:text-foreground"
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
        <ul className="border-border flex flex-col rounded-md border">
          {isFetching && !searchResults ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">
              Searching…
            </li>
          ) : !searchResults || searchResults.items.length === 0 ? (
            <li className="px-3 py-2">
              <Alert variant="info" className="p-2">
                <Info />
                <AlertDescription>No users match.</AlertDescription>
              </Alert>
            </li>
          ) : (
            searchResults.items
              // Hide already-added users so the user list never offers a no-op.
              .filter((u) => !value.includes(u.id))
              .map((u) => (
                <li
                  key={u.id}
                  className="border-border border-b last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => addUser(u.id)}
                    className="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-foreground text-sm font-medium">
                        {u.name ?? '(unnamed)'}
                      </span>
                      <span className="text-muted-foreground text-xs">
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
