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
import { useMutation } from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'

const TTL_PRESETS = [
  { label: '1 hour', seconds: 60 * 60 },
  { label: '2 hours (default)', seconds: 2 * 60 * 60 },
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days', seconds: 7 * 24 * 60 * 60 },
  { label: 'No expiry', seconds: null },
] as const

interface ResetPasskeyModalProps {
  userId: string
  targetName: string | null
  onClose: () => void
}

export const ResetPasskeyModal = ({
  userId,
  targetName,
  onClose,
}: ResetPasskeyModalProps) => {
  const trpc = useTRPC()
  const [ttlIdx, setTtlIdx] = useState(1) // default = 2h
  const [issued, setIssued] = useState<{
    url: string
    expiresAt: Date | null
  } | null>(null)

  const issueMutation = useMutation(
    trpc.admin.users.issuePasskeyReset.mutationOptions({
      onSuccess: (result) => setIssued(result),
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleIssue = () => {
    const preset = TTL_PRESETS[ttlIdx]
    if (!preset) return
    issueMutation.mutate({
      userId,
      expiresInSeconds: preset.seconds,
    })
  }

  const handleCopy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.url)
      toast.success('Reset URL copied to clipboard')
    } catch {
      toast.error('Could not copy. Select the URL manually.')
    }
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>Reset passkey for {targetName ?? userId}</ModalHeader>
            <div className="flex flex-col gap-4 px-6 pb-2">
              {!issued ? (
                <>
                  <p className="prose-body-2 text-base-content-medium">
                    Generates a one-time URL the user can open to register a new
                    passkey. Their existing passkeys will be wiped on use.
                  </p>
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
                    Reset link generated.{' '}
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
                    Send this URL to the user via your own channel (Slack,
                    email, in person). The link is single-use.
                  </p>
                </>
              )}
            </div>
            <ModalFooter>
              <Button variant="clear" onPress={onClose}>
                {issued ? 'Done' : 'Cancel'}
              </Button>
              {!issued ? (
                <Button
                  onPress={handleIssue}
                  isPending={issueMutation.isPending}
                >
                  Generate reset link
                </Button>
              ) : (
                <Button onPress={handleCopy}>Copy URL</Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
