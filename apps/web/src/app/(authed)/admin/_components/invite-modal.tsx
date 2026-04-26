'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@opengovsg/oui/modal'
import { toast } from '@opengovsg/oui/toast'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

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
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <form onSubmit={handleIssue}>
            <ModalHeader>New invite</ModalHeader>
            <div className="flex flex-col gap-4 px-6 pb-2">
              {!issued ? (
                <>
                  <p className="prose-body-2 text-base-content-medium">
                    Generates a one-time URL the recipient can open to register
                    a passkey. They'll land in the app under the role you pick.
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
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="invite-role"
                      className="prose-label-md mb-1"
                    >
                      Role
                    </label>
                    <select
                      id="invite-role"
                      name="roleId"
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      className="border-base-divider-medium bg-base-canvas-default rounded border px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {rolesData.items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="prose-label-md mb-1">
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
                          className="accent-interaction-main-default dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="prose-body-2">{preset.label}</span>
                      </label>
                    ))}
                  </fieldset>
                </>
              ) : (
                <>
                  <Infobox variant="success">
                    Invite link generated for role &ldquo;{issued.roleName}
                    &rdquo;.{' '}
                    {issued.expiresAt
                      ? `Expires ${new Intl.DateTimeFormat('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(issued.expiresAt)}.`
                      : 'No expiry.'}
                  </Infobox>
                  <textarea
                    readOnly
                    value={issued.url}
                    rows={3}
                    className="border-base-divider-medium prose-body-2 w-full rounded-md border p-2 font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <p className="prose-caption-2 text-base-content-medium">
                    Send this URL to the recipient via your own channel (Slack,
                    email, in person). The link is single-use.
                  </p>
                </>
              )}
            </div>
            <ModalFooter>
              <Button variant="clear" type="button" onPress={onClose}>
                {issued ? 'Done' : 'Cancel'}
              </Button>
              {!issued ? (
                <Button type="submit" isPending={issueMutation.isPending}>
                  Generate invite link
                </Button>
              ) : (
                <Button type="button" onPress={handleCopy}>
                  Copy URL
                </Button>
              )}
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
