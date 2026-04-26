'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@opengovsg/oui/modal'
import { NumberField } from '@opengovsg/oui/number-field'
import { toast } from '@opengovsg/oui/toast'
import { Toggle } from '@opengovsg/oui/toggle'
import { useMutation } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

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
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader>
              {isNew ? 'Create feature flag' : `Edit flag: ${flag.key}`}
            </ModalHeader>
            <div className="flex flex-col gap-4 px-6 pb-2">
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

              <Toggle
                isSelected={enabled}
                onChange={setEnabled}
                aria-label="Enabled"
              >
                Enabled (master switch)
              </Toggle>

              <NumberField
                label="Rollout percent"
                value={rolloutPercent}
                onChange={(v) => setRolloutPercent(Number.isFinite(v) ? v : 0)}
                minValue={0}
                maxValue={100}
                description="Percentage of users (by stable hash) the flag is on for. Allowlisted users are always on regardless of this value."
              />

              <AllowedUsersPicker
                value={allowedUserIds}
                onChange={setAllowedUserIds}
              />
            </div>
            <ModalFooter>
              <Button variant="clear" type="button" onPress={onClose}>
                Cancel
              </Button>
              <Button type="submit" isPending={upsertMutation.isPending}>
                {isNew ? 'Create' : 'Save'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
