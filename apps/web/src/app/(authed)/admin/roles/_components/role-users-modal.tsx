'use client'

import { Suspense, useMemo, useState } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useTRPC } from '~/trpc/react'

interface RoleUsersModalProps {
  role: { id: string; name: string }
  onClose: () => void
}

export const RoleUsersModal = ({ role, onClose }: RoleUsersModalProps) => {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Users in role: {role.name}</DialogTitle>
        </DialogHeader>
        <Suspense fallback={<ModalLoading />}>
          <RoleUsersBody role={role} onClose={onClose} />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}

const ModalLoading = () => (
  <div className="py-2">
    <p className="text-muted-foreground text-sm">Loading users…</p>
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
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
        {usersData.items.length === 0 ? (
          <Alert variant="info">
            <Info />
            <AlertDescription>
              No users are assigned to this role.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="border-border flex flex-col gap-1 rounded-md border">
              <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Select all users"
                  id="select-all"
                />
                <label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  Select all ({usersData.items.length})
                </label>
              </div>
              <ul className="divide-border flex flex-col divide-y">
                {usersData.items.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 px-3 py-2">
                    <Checkbox
                      id={`u-${u.id}`}
                      checked={selected.has(u.id)}
                      onCheckedChange={(checked) =>
                        toggleOne(u.id, checked === true)
                      }
                      aria-label={`Select ${u.name ?? u.email ?? u.id}`}
                    />
                    <label
                      htmlFor={`u-${u.id}`}
                      className="flex flex-1 cursor-pointer flex-col"
                    >
                      <span className="text-sm">{u.name ?? '(no name)'}</span>
                      <span className="text-muted-foreground text-xs">
                        {u.email ?? '(no email)'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="reassign-target-role"
                className="text-sm font-medium"
              >
                Reassign selected to…
              </label>
              <Select
                value={targetRoleId}
                onValueChange={setTargetRoleId}
                disabled={isPending}
              >
                <SelectTrigger id="reassign-target-role">
                  <SelectValue placeholder="Select a target role…" />
                </SelectTrigger>
                <SelectContent>
                  {targetRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleReassign} disabled={!canReassign}>
          {selected.size > 0
            ? `Reassign ${selected.size} selected`
            : 'Reassign selected'}
        </Button>
      </DialogFooter>
    </>
  )
}
