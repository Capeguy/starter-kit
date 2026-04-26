'use client'

import { useState } from 'react'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { TextField } from '@acme/ui/text-field'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
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

const TTL_PRESETS = [
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days (default)', seconds: 7 * 24 * 60 * 60 },
  { label: '30 days', seconds: 30 * 24 * 60 * 60 },
  { label: 'No expiry', seconds: null },
] as const

interface InviteModalProps {
  onClose: () => void
  onIssued: () => Promise<void> | void
}

export const InviteModal = ({ onClose, onIssued }: InviteModalProps) => {
  const trpc = useTRPC()
  const { data: rolesData } = useSuspenseQuery(
    trpc.admin.roles.list.queryOptions(),
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  // Default to the seeded "User" role if it's present; otherwise pick the
  // first role in the list. This avoids picking "Admin" by accident.
  const defaultRoleId =
    rolesData.items.find((r) => r.id === 'role_user')?.id ??
    rolesData.items[0]?.id ??
    ''
  const [roleId, setRoleId] = useState(defaultRoleId)
  const [ttlIdx, setTtlIdx] = useState(1) // default = 7 days
  const [issued, setIssued] = useState<{
    url: string
    expiresAt: Date | null
    roleName: string
  } | null>(null)

  const issueMutation = useMutation(
    trpc.admin.invites.issue.mutationOptions({
      onSuccess: async (result) => {
        setIssued({
          url: result.url,
          expiresAt: result.expiresAt,
          roleName: result.roleName,
        })
        await onIssued()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleId) {
      toast.error('Pick a role')
      return
    }
    const preset = TTL_PRESETS[ttlIdx]
    if (!preset) return
    issueMutation.mutate({
      name: name.trim() || null,
      email: email.trim() || null,
      roleId,
      expiresInSeconds: preset.seconds,
    })
  }

  const handleCopy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.url)
      toast.success('Invite URL copied to clipboard')
    } catch {
      toast.error('Could not copy. Select the URL manually.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleIssue}>
          <DialogHeader>
            <DialogTitle>New invite</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {!issued ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Generates a one-time URL the recipient can open to register a
                  passkey. They&apos;ll land in the app under the role you pick.
                </p>
                <TextField
                  label="Name (optional)"
                  inputProps={{
                    placeholder: 'Jane Doe',
                    name: 'name',
                    maxLength: 50,
                  }}
                  value={name}
                  onChange={setName}
                />
                <TextField
                  label="Email (optional)"
                  inputProps={{
                    placeholder: 'jane@example.com',
                    name: 'email',
                    type: 'email',
                  }}
                  value={email}
                  onChange={setEmail}
                />
                <div className="flex flex-col gap-2">
                  <label htmlFor="invite-role" className="text-sm font-medium">
                    Role
                  </label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder="Pick a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesData.items.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">
                    Link expires in
                  </legend>
                  {TTL_PRESETS.map((preset, i) => (
                    <label
                      key={preset.label}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="ttl"
                        checked={ttlIdx === i}
                        onChange={() => setTtlIdx(i)}
                        className="accent-primary"
                      />
                      <span className="text-sm">{preset.label}</span>
                    </label>
                  ))}
                </fieldset>
              </>
            ) : (
              <>
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertDescription>
                    Invite link generated for role &ldquo;{issued.roleName}
                    &rdquo;.{' '}
                    {issued.expiresAt
                      ? `Expires ${new Intl.DateTimeFormat('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(issued.expiresAt)}.`
                      : 'No expiry.'}
                  </AlertDescription>
                </Alert>
                <textarea
                  readOnly
                  value={issued.url}
                  rows={3}
                  className="border-border bg-muted/50 w-full rounded-md border p-2 font-mono text-sm"
                  onClick={(e) => e.currentTarget.select()}
                />
                <p className="text-muted-foreground text-xs">
                  Send this URL to the recipient via your own channel (Slack,
                  email, in person). The link is single-use.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              {issued ? 'Done' : 'Cancel'}
            </Button>
            {!issued ? (
              <Button type="submit" disabled={issueMutation.isPending}>
                Generate invite link
              </Button>
            ) : (
              <Button type="button" onClick={handleCopy}>
                Copy URL
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
