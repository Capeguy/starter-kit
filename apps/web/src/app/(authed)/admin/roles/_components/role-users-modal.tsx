'use client'

import { Suspense, useMemo, useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Checkbox } from '@opengovsg/oui/checkbox'
import { Infobox } from '@opengovsg/oui/infobox'
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@opengovsg/oui/modal'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'

interface RoleUsersModalProps {
  role: { id: string; name: string }
  onClose: () => void
}

export const RoleUsersModal = ({ role, onClose }: RoleUsersModalProps) => {
  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>Users in role: {role.name}</ModalHeader>
            <Suspense fallback={<ModalLoading />}>
              <RoleUsersBody role={role} onClose={onClose} />
            </Suspense>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

const ModalLoading = () => (
  <div className="px-6 pb-6">
    <p className="prose-body-2 text-base-content-medium">Loading users…</p>
  </div>
)

interface RoleUsersBodyProps {
  role: { id: string; name: string }
  onClose: () => void
}

const RoleUsersBody = ({ role, onClose }: RoleUsersBodyProps) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: usersData } = useSuspenseQuery(
    trpc.admin.roles.listUsers.queryOptions({ roleId: role.id }),
  )
  const { data: rolesData } = useSuspenseQuery(
    trpc.admin.roles.list.queryOptions(),
  )

  // Other roles available as reassignment targets — exclude the source role.
  const targetRoles = useMemo(
    () => rolesData.items.filter((r) => r.id !== role.id),
    [rolesData.items, role.id],
  )

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targetRoleId, setTargetRoleId] = useState<string>('')

  const reassignMutation = useMutation(
    trpc.admin.roles.reassignUsers.mutationOptions({
      onSuccess: async (result) => {
        toast.success(
          `Reassigned ${result.count} user${result.count === 1 ? '' : 's'}`,
        )
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.admin.roles.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.admin.roles.listUsers.queryKey({ roleId: role.id }),
          }),
        ])
        onClose()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const allIds = usersData.items.map((u) => u.id)
  const allSelected = allIds.length > 0 && selected.size === allIds.length
  const someSelected = selected.size > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(allIds) : new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const handleReassign = () => {
    if (selected.size === 0 || !targetRoleId) return
    reassignMutation.mutate({
      fromRoleId: role.id,
      toRoleId: targetRoleId,
      userIds: [...selected],
    })
  }

  const isPending = reassignMutation.isPending
  const canReassign = selected.size > 0 && targetRoleId !== '' && !isPending

  return (
    <>
      <div className="flex flex-col gap-4 px-6 pb-2">
        {usersData.items.length === 0 ? (
          <Infobox variant="info">No users are assigned to this role.</Infobox>
        ) : (
          <>
            <div className="border-base-divider-medium flex flex-col gap-1 rounded-md border">
              <div className="border-base-divider-medium border-b px-3 py-2">
                <Checkbox
                  isSelected={allSelected}
                  isIndeterminate={someSelected}
                  onChange={toggleAll}
                  aria-label="Select all users"
                >
                  <span className="prose-label-md">
                    Select all ({usersData.items.length})
                  </span>
                </Checkbox>
              </div>
              <ul className="divide-base-divider-subtle flex flex-col divide-y">
                {usersData.items.map((u) => (
                  <li key={u.id} className="px-3 py-2">
                    <Checkbox
                      isSelected={selected.has(u.id)}
                      onChange={(checked) => toggleOne(u.id, checked)}
                      aria-label={`Select ${u.name ?? u.email ?? u.id}`}
                    >
                      <span className="flex flex-col">
                        <span className="prose-body-2">
                          {u.name ?? '(no name)'}
                        </span>
                        <span className="prose-caption-2 text-base-content-medium">
                          {u.email ?? '(no email)'}
                        </span>
                      </span>
                    </Checkbox>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="reassign-target-role" className="prose-label-md">
                Reassign selected to…
              </label>
              <select
                id="reassign-target-role"
                aria-label="Reassign selected to"
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
                className="border-base-divider-medium rounded-md border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                disabled={isPending}
              >
                <option value="">Select a target role…</option>
                {targetRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
      <ModalFooter>
        <Button variant="clear" type="button" onPress={onClose}>
          Cancel
        </Button>
        <Button
          onPress={handleReassign}
          isPending={isPending}
          isDisabled={!canReassign}
        >
          {selected.size > 0
            ? `Reassign ${selected.size} selected`
            : 'Reassign selected'}
        </Button>
      </ModalFooter>
    </>
  )
}
