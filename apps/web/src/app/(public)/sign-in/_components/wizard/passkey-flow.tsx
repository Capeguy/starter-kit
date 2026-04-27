'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { Info, XCircle } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
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
      <form noValidate onSubmit={handleCreate} className="flex flex-col gap-4">
        <Alert variant="info">
          <Info />
          <AlertDescription>
            {reason === 'unknown_passkey'
              ? "We don't have your details on file. Pick a name to create an account."
              : 'Pick a name to create a new account with a passkey.'}
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <XCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Controller
          control={control}
          name="name"
          rules={{ required: 'Name is required' }}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="signin-name">Your name</Label>
              <Input
                {...field}
                id="signin-name"
                placeholder="e.g. Jane Doe"
                autoFocus
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.error ? 'signin-name-error' : undefined
                }
              />
              {fieldState.error && (
                <p
                  id="signin-name-error"
                  className="text-destructive text-xs"
                  role="alert"
                >
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Button disabled={isRegistering} type="submit" className="w-full">
          Create account
        </Button>

        <Button
          variant="ghost"
          onClick={goBack}
          type="button"
          className="w-full"
        >
          ← Back
        </Button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        disabled={isAuthenticating}
        onClick={handleContinue}
        className="w-full"
        size="lg"
      >
        Continue with passkey
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        New here? Hit continue and your browser will prompt you to create one.
      </p>
    </div>
  )
}
