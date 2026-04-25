'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import { useMutation } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import { SystemRoleId } from '~/lib/rbac'
import { useTRPC } from '~/trpc/react'
import { UserPicker } from './user-picker'

type AudienceKind = 'all' | 'role:admin' | 'role:user' | 'user'

interface PickedUser {
  id: string
  name: string | null
  email: string | null
}

export const BroadcastForm = () => {
  const trpc = useTRPC()
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('all')
  const [pickedUser, setPickedUser] = useState<PickedUser | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [href, setHref] = useState('')

  const broadcast = useMutation(
    trpc.admin.notifications.broadcast.mutationOptions({
      onSuccess: (result) => {
        toast.success(`Broadcast sent to ${result.count} user(s).`)
        setTitle('')
        setBody('')
        setHref('')
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const audience =
    audienceKind === 'all'
      ? { kind: 'all' as const }
      : audienceKind === 'role:admin'
        ? { kind: 'role' as const, roleId: SystemRoleId.Admin }
        : audienceKind === 'role:user'
          ? { kind: 'role' as const, roleId: SystemRoleId.User }
          : { kind: 'user' as const, userId: pickedUser?.id ?? '' }

  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) {
          toast.error('Title is required')
          return
        }
        if (audienceKind === 'user' && !pickedUser) {
          toast.error('Pick a recipient')
          return
        }
        broadcast.mutate({
          audience,
          title: title.trim(),
          body: body.trim() || null,
          href: href.trim() || null,
        })
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="prose-label-md mb-1">Audience</legend>
        {(
          [
            { value: 'all', label: 'All users' },
            { value: 'role:admin', label: 'Admins only' },
            { value: 'role:user', label: 'Regular users only' },
            { value: 'user', label: 'Single user' },
          ] as { value: AudienceKind; label: string }[]
        ).map((opt) => (
          <label key={opt.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="audience"
              checked={audienceKind === opt.value}
              onChange={() => setAudienceKind(opt.value)}
              className="accent-interaction-main-default dark:border-zinc-600 dark:bg-zinc-800"
            />
            <span className="prose-body-2">{opt.label}</span>
          </label>
        ))}
      </fieldset>

      {audienceKind === 'user' && (
        <UserPicker value={pickedUser} onChange={setPickedUser} />
      )}

      <TextField
        label="Title"
        inputProps={{ placeholder: 'Heads up…', name: 'title', maxLength: 120 }}
        value={title}
        onChange={setTitle}
        isRequired
      />
      <TextField
        label="Body (optional)"
        inputProps={{ placeholder: 'Details', name: 'body' }}
        value={body}
        onChange={setBody}
      />
      <TextField
        label="Link (optional)"
        inputProps={{ placeholder: '/dashboard', name: 'href' }}
        value={href}
        onChange={setHref}
      />

      <Infobox variant="info">
        Recipients will see this in their notification bell within 15 seconds
        (poll interval).
      </Infobox>

      <Button type="submit" isPending={broadcast.isPending}>
        Send broadcast
      </Button>
    </form>
  )
}
