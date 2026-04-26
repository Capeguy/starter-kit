'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset passkey for {targetName ?? userId}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!issued ? (
            <>
              <p className="text-muted-foreground text-sm">
                Generates a one-time URL the user can open to register a new
                passkey. Their existing passkeys will be wiped on use.
              </p>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  Link expires in
                </legend>
                {TTL_PRESETS.map((preset, i) => (
                  <label key={preset.label} className="flex items-center gap-2">
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
                  Reset link generated.{' '}
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
                Send this URL to the user via your own channel (Slack, email, in
                person). The link is single-use.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {issued ? 'Done' : 'Cancel'}
          </Button>
          {!issued ? (
            <Button onClick={handleIssue} disabled={issueMutation.isPending}>
              Generate reset link
            </Button>
          ) : (
            <Button onClick={handleCopy}>Copy URL</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
