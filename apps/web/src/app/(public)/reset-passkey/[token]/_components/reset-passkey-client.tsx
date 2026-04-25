'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'

import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

const errorName = (err: unknown): string =>
  err && typeof err === 'object' && 'name' in err ? String(err.name) : ''

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

interface Props {
  token: string
}

export const ResetPasskeyClient = ({ token }: Props) => {
  const trpc = useTRPC()
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)

  const startMutation = useMutation(
    trpc.auth.passkey.resetWithToken.start.mutationOptions(),
  )
  const finishMutation = useMutation(
    trpc.auth.passkey.resetWithToken.finish.mutationOptions(),
  )

  const isPending = startMutation.isPending || finishMutation.isPending

  const handleClaim = async () => {
    setError(undefined)
    try {
      const { options } = await startMutation.mutateAsync({ token })
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
        <h1 className="prose-h2 text-base-content-strong">All set</h1>
        <Infobox variant="success">
          Your new passkey is registered. Redirecting…
        </Infobox>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">
          Reset your passkey
        </h1>
        <p className="prose-body-2 text-base-content-medium">
          An admin issued this link so you can register a new passkey for your
          account. Any existing passkeys on your account will be replaced.
        </p>
      </header>
      {error && <Infobox variant="error">{error}</Infobox>}
      <Button isPending={isPending} onPress={handleClaim} size="md">
        {isPending ? 'Working…' : 'Register new passkey'}
      </Button>
      <p className="prose-caption-2 text-base-content-medium">
        Single-use link. If it doesn&apos;t work, ask the admin for a fresh one.
      </p>
    </div>
  )
}
