'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'

import { TextField } from '@acme/ui/text-field'

import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

type Mode = 'initial' | 'needs_name'
type NeedsNameReason = 'no_passkey' | 'unknown_passkey'

const errorName = (err: unknown): string =>
  err && typeof err === 'object' && 'name' in err ? String(err.name) : ''

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.'

const trpcErrorCode = (err: unknown): string | null => {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { code?: unknown } }).data
    if (data && typeof data.code === 'string') return data.code
  }
  return null
}

export const PasskeyFlow = () => {
  const router = useRouter()
  const trpc = useTRPC()

  const [mode, setMode] = useState<Mode>('initial')
  const [reason, setReason] = useState<NeedsNameReason | null>(null)
  const [error, setError] = useState<string>()

  const {
    control,
    handleSubmit,
    reset: resetForm,
  } = useForm<{ name: string }>({
    defaultValues: { name: '' },
  })

  const authStart = useMutation(
    trpc.auth.passkey.generateAuthenticationOptions.mutationOptions(),
  )
  const authVerify = useMutation(
    trpc.auth.passkey.verifyAuthentication.mutationOptions(),
  )
  const regStart = useMutation(
    trpc.auth.passkey.generateRegistrationOptions.mutationOptions(),
  )
  const regVerify = useMutation(
    trpc.auth.passkey.verifyRegistration.mutationOptions(),
  )

  const isAuthenticating = authStart.isPending || authVerify.isPending
  const isRegistering = regStart.isPending || regVerify.isPending

  const switchToNeedsName = (next: NeedsNameReason) => {
    setError(undefined)
    setReason(next)
    setMode('needs_name')
  }

  const goBack = () => {
    setError(undefined)
    setReason(null)
    setMode('initial')
    resetForm({ name: '' })
  }

  const handleContinue = async () => {
    setError(undefined)
    try {
      const options = await authStart.mutateAsync()

      let response
      try {
        response = await startAuthentication({ optionsJSON: options })
      } catch (browserErr: unknown) {
        // No passkey available on this device, or the user dismissed the prompt.
        if (errorName(browserErr) === 'NotAllowedError') {
          switchToNeedsName('no_passkey')
          return
        }
        throw browserErr
      }

      try {
        await authVerify.mutateAsync({
          response,
          expectedChallenge: options.challenge,
        })
        router.push(AUTHED_ROOT_ROUTE)
      } catch (verifyErr: unknown) {
        if (trpcErrorCode(verifyErr) === 'NOT_FOUND') {
          // Server doesn't recognise this credential — recover by registering.
          switchToNeedsName('unknown_passkey')
          return
        }
        setError(errorMessage(verifyErr))
      }
    } catch (err) {
      console.error('passkey continue error:', err)
      setError(errorMessage(err))
    }
  }

  const handleCreate = handleSubmit(async ({ name }) => {
    setError(undefined)
    try {
      const options = await regStart.mutateAsync({ name })

      let response
      try {
        response = await startRegistration({ optionsJSON: options })
      } catch (browserErr: unknown) {
        const n = errorName(browserErr)
        if (n === 'InvalidStateError') {
          setError('A passkey for this site already exists on this device.')
        } else if (n === 'NotAllowedError') {
          setError('Passkey creation was cancelled.')
        } else {
          setError(errorMessage(browserErr))
        }
        return
      }

      await regVerify.mutateAsync({
        name,
        response,
        expectedChallenge: options.challenge,
      })
      router.push(AUTHED_ROOT_ROUTE)
    } catch (err) {
      console.error('passkey create error:', err)
      setError(errorMessage(err))
    }
  })

  if (mode === 'needs_name') {
    return (
      <form
        noValidate
        onSubmit={handleCreate}
        className="flex flex-1 flex-col gap-4"
      >
        <Infobox variant="info">
          {reason === 'unknown_passkey'
            ? "We don't have your details on file. Enter a name to create an account."
            : 'Enter your name to create a new account with a passkey.'}
        </Infobox>

        {error && <Infobox variant="error">{error}</Infobox>}

        <Controller
          control={control}
          name="name"
          rules={{ required: 'Name is required' }}
          render={({ field, fieldState }) => (
            <TextField
              inputProps={{
                placeholder: 'e.g. Jane Doe',
                autoFocus: true,
                name: 'name',
              }}
              errorMessage={fieldState.error?.message}
              isRequired
              isInvalid={!!fieldState.error}
              {...field}
              label="Your name"
            />
          )}
        />

        <Button size="md" isPending={isRegistering} type="submit">
          Create account
        </Button>

        <Button size="md" variant="clear" onPress={goBack}>
          ← Back
        </Button>
      </form>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="prose-body-2 text-base-content-medium">
        Sign in with an existing passkey, or we&apos;ll help you create one.
      </p>

      {error && <Infobox variant="error">{error}</Infobox>}

      <Button size="md" isPending={isAuthenticating} onPress={handleContinue}>
        Continue with Passkey
      </Button>
    </div>
  )
}
