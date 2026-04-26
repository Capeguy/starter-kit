'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'

import { TextField } from '@acme/ui/text-field'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

const errorName = (err: unknown): string =>
  err && typeof err === 'object' && 'name' in err ? String(err.name) : ''

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

interface Props {
  token: string
}

export const InviteClient = ({ token }: Props) => {
  const trpc = useTRPC()
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)

  const startMutation = useMutation(
    trpc.auth.passkey.inviteWithToken.start.mutationOptions(),
  )
  const finishMutation = useMutation(
    trpc.auth.passkey.inviteWithToken.finish.mutationOptions(),
  )

  const isPending = startMutation.isPending || finishMutation.isPending

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Pick a name to use for your account.')
      return
    }
    try {
      const { options } = await startMutation.mutateAsync({
        token,
        name: trimmedName,
      })
      let response
      try {
        response = await startRegistration({ optionsJSON: options })
      } catch (browserErr) {
        const n = errorName(browserErr)
        if (n === 'NotAllowedError') {
          setError('Passkey creation was cancelled.')
        } else if (n === 'InvalidStateError') {
          setError('A passkey for this site already exists on this device.')
        } else {
          setError(errorMessage(browserErr))
        }
        return
      }
      await finishMutation.mutateAsync({
        token,
        name: trimmedName,
        response,
        expectedChallenge: options.challenge,
      })
      setDone(true)
      // Small delay so the success state is visible before redirect.
      setTimeout(() => router.push(AUTHED_ROOT_ROUTE), 800)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (done) {
    return (
      <div className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="text-foreground text-2xl font-bold">Welcome</h1>
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription>
            Your account is set up. Redirecting…
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleClaim}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold">
          Accept your invite
        </h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ve been invited to join. Pick a display name and register a
          passkey to create your account.
        </p>
      </header>
      <TextField
        label="Your name"
        inputProps={{
          placeholder: 'Jane Doe',
          name: 'name',
          maxLength: 50,
          autoComplete: 'name',
        }}
        value={name}
        onChange={setName}
        isRequired
      />
      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Working…' : 'Register passkey'}
      </Button>
      <p className="text-muted-foreground text-xs">
        Single-use link. If it doesn&apos;t work, ask the admin for a fresh one.
      </p>
    </form>
  )
}
