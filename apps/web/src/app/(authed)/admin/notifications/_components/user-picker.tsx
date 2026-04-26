'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { TextField } from '@acme/ui/text-field'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
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

const initials = (name: string | null | undefined): string =>
  name ? name.slice(0, 2).toUpperCase() : '?'

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
      <div className="border-border flex items-center justify-between rounded-md border p-3">
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">
            {value.name ?? '(unnamed)'}
          </span>
          <span className="text-muted-foreground text-xs">
            {value.email ?? value.id}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-primary text-sm font-medium hover:underline"
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
        <ul className="border-border flex flex-col rounded-md border">
          {isFetching && !data ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">
              Searching…
            </li>
          ) : !data || data.items.length === 0 ? (
            <li className="px-3 py-2">
              <Alert variant="info" className="p-2">
                <Info />
                <AlertDescription>No users match.</AlertDescription>
              </Alert>
            </li>
          ) : (
            data.items.map((u) => (
              <li key={u.id} className="border-border border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() =>
                    onChange({ id: u.id, name: u.name, email: u.email })
                  }
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
    </div>
  )
}
