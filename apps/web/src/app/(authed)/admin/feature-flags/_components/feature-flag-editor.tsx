'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { TextField } from '@acme/ui/text-field'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Switch } from '~/components/ui/switch'
import { useTRPC } from '~/trpc/react'
import { AllowedUsersPicker } from './allowed-users-picker'

interface FeatureFlagInput {
  key: string
  name: string
  description: string | null
  enabled: boolean
  rolloutPercent: number
  allowedUserIds: string[]
}

interface FeatureFlagEditorProps {
  flag: FeatureFlagInput | null // null = create new
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export const FeatureFlagEditor = ({
  flag,
  onClose,
  onSaved,
}: FeatureFlagEditorProps) => {
  const trpc = useTRPC()
  const isNew = flag === null

  const [key, setKey] = useState(flag?.key ?? '')
  const [name, setName] = useState(flag?.name ?? '')
  const [description, setDescription] = useState(flag?.description ?? '')
  const [enabled, setEnabled] = useState(flag?.enabled ?? false)
  const [rolloutPercent, setRolloutPercent] = useState<number>(
    flag?.rolloutPercent ?? 0,
  )
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>(
    flag?.allowedUserIds ?? [],
  )

  const upsertMutation = useMutation(
    trpc.admin.featureFlags.upsert.mutationOptions({
      onSuccess: async () => {
        toast.success(isNew ? 'Flag created' : 'Flag updated')
        await onSaved()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedKey = key.trim()
    const trimmedName = name.trim()

    if (!trimmedKey) {
      toast.error('Key is required')
      return
    }
    if (!KEY_PATTERN.test(trimmedKey)) {
      toast.error(
        'Key must be lowercase letters, digits, dots, underscores, or hyphens.',
      )
      return
    }
    if (!trimmedName) {
      toast.error('Name is required')
      return
    }
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      toast.error('Rollout percent must be between 0 and 100.')
      return
    }

    upsertMutation.mutate({
      key: trimmedKey,
      name: trimmedName,
      description: description.trim() || null,
      enabled,
      rolloutPercent,
      allowedUserIds,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Create feature flag' : `Edit flag: ${flag.key}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <TextField
              label="Key"
              inputProps={{
                placeholder: 'new.checkout.flow',
                name: 'key',
                maxLength: 64,
              }}
              value={key}
              onChange={setKey}
              isRequired={isNew}
              isDisabled={!isNew}
              description="Lowercase, dotted slug. Immutable once created."
            />

            <TextField
              label="Name"
              inputProps={{
                placeholder: 'New checkout flow',
                name: 'name',
                maxLength: 120,
              }}
              value={name}
              onChange={setName}
              isRequired
            />

            <TextField
              label="Description (optional)"
              inputProps={{
                placeholder: 'What this flag controls',
                name: 'description',
                maxLength: 500,
              }}
              value={description}
              onChange={setDescription}
            />

            <label className="flex items-center gap-3">
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Enabled"
              />
              <span className="text-sm font-medium">
                Enabled (master switch)
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <label htmlFor="ff-rollout" className="text-sm font-medium">
                Rollout percent
              </label>
              <input
                id="ff-rollout"
                type="number"
                min={0}
                max={100}
                value={rolloutPercent}
                onChange={(e) =>
                  setRolloutPercent(
                    Number.isFinite(e.target.valueAsNumber)
                      ? e.target.valueAsNumber
                      : 0,
                  )
                }
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
              <p className="text-muted-foreground text-xs">
                Percentage of users (by stable hash) the flag is on for.
                Allowlisted users are always on regardless of this value.
              </p>
            </div>

            <AllowedUsersPicker
              value={allowedUserIds}
              onChange={setAllowedUserIds}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsertMutation.isPending}>
              {isNew ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
