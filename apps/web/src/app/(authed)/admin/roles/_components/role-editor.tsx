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
import { useTRPC } from '~/trpc/react'

interface RoleInput {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  capabilities: string[]
}

interface RoleEditorProps {
  role: RoleInput | null // null = create new
  allCapabilities: readonly string[]
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export const RoleEditor = ({
  role,
  allCapabilities,
  onClose,
  onSaved,
}: RoleEditorProps) => {
  const trpc = useTRPC()
  const isNew = role === null

  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [capabilities, setCapabilities] = useState<Set<string>>(
    new Set(role?.capabilities ?? []),
  )

  const createMutation = useMutation(
    trpc.admin.roles.create.mutationOptions({
      onSuccess: async () => {
        toast.success('Role created')
        await onSaved()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const updateMutation = useMutation(
    trpc.admin.roles.update.mutationOptions({
      onSuccess: async () => {
        toast.success('Role updated')
        await onSaved()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const toggleCap = (cap: string) => {
    setCapabilities((prev) => {
      const next = new Set(prev)
      if (next.has(cap)) {
        next.delete(cap)
      } else {
        next.add(cap)
      }
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isNew) {
      if (!name.trim()) {
        toast.error('Name is required')
        return
      }
      createMutation.mutate({
        name: name.trim(),
        description: description.trim() || null,
        capabilities: [...capabilities],
      })
    } else {
      updateMutation.mutate({
        id: role.id,
        name: role.isSystem ? undefined : name.trim() || undefined,
        description: description.trim() || null,
        capabilities: [...capabilities],
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Create role' : `Edit role: ${role.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
            <TextField
              label="Name"
              inputProps={{
                placeholder: 'Editor',
                name: 'name',
                maxLength: 50,
              }}
              value={name}
              onChange={setName}
              isRequired={isNew}
              isDisabled={!isNew && role.isSystem}
            />
            {!isNew && role.isSystem && (
              <p className="text-muted-foreground -mt-2 text-xs">
                System role names are locked.
              </p>
            )}

            <TextField
              label="Description (optional)"
              inputProps={{
                placeholder: 'What this role is for',
                name: 'desc',
              }}
              value={description}
              onChange={setDescription}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Capabilities</legend>
              <p className="text-muted-foreground mb-1 text-xs">
                Tick the operations users with this role can perform. Codes are
                checked against the canonical catalogue in code.
              </p>
              <div className="flex flex-col gap-1">
                {allCapabilities.map((cap) => (
                  <label key={cap} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={capabilities.has(cap)}
                      onChange={() => toggleCap(cap)}
                      className="accent-primary"
                    />
                    <code className="text-sm">{cap}</code>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isNew ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
