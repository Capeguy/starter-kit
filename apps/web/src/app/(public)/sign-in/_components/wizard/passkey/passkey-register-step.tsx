'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@opengovsg/oui/button'
import { startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'

import { TextField } from '@acme/ui/text-field'

import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

interface PasskeyRegisterStepProps {
  onSuccess?: () => void
}

export const PasskeyRegisterStep = ({
  onSuccess,
}: PasskeyRegisterStepProps) => {
  const [error, setError] = useState<string>()
  const router = useRouter()
  const trpc = useTRPC()
  const { control, handleSubmit } = useForm<{ name: string }>({
    defaultValues: { name: '' },
  })

  const verifyMutation = useMutation(
    trpc.auth.passkey.verifyRegistration.mutationOptions({
      onSuccess: () => {
        router.push(AUTHED_ROOT_ROUTE)
        onSuccess?.()
      },
      onError: (err) => {
        setError(err.message)
      },
    }),
  )

  const registerMutation = useMutation(
    trpc.auth.passkey.generateRegistrationOptions.mutationOptions({
      onSuccess: async (options, variables: { name: string }) => {
        try {
          const registrationResponse = await startRegistration({
            optionsJSON: options,
          })

          await verifyMutation.mutateAsync({
            name: variables.name,
            response: registrationResponse,
            expectedChallenge: options.challenge,
          })
        } catch (err: unknown) {
          console.error('Registration error:', err)
          const message = err instanceof Error ? err.message : 'Unknown error'
          const name =
            err && typeof err === 'object' && 'name' in err
              ? (err.name as string)
              : ''
          if (name === 'InvalidStateError') {
            setError('This passkey is already registered for this account.')
          } else if (name === 'NotAllowedError') {
            setError('Account creation was cancelled.')
          } else {
            setError(message)
          }
        }
      },
      onError: (err) => {
        setError(err.message)
      },
    }),
  )

  const isLoading = registerMutation.isPending || verifyMutation.isPending

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) => registerMutation.mutate(data))}
      className="flex flex-1 flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Create your account</h3>
        <p className="text-sm text-gray-600">
          Enter a name and create a passkey to securely access your account.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Controller
        control={control}
        name="name"
        rules={{ required: 'Name is required' }}
        render={({ field, fieldState: { error } }) => (
          <TextField
            inputProps={{
              placeholder: 'e.g. Jane Doe',
              autoFocus: true,
              name: 'name',
            }}
            errorMessage={error?.message}
            isRequired
            isInvalid={!!error}
            {...field}
            label="Your name"
          />
        )}
      />

      <Button size="sm" isPending={isLoading} type="submit">
        {isLoading ? 'Creating passkey…' : 'Create Passkey'}
      </Button>

      <div className="text-center text-xs text-gray-500">
        <p>
          Passkeys use your device&apos;s biometrics or screen lock for secure,
          password-free authentication.
        </p>
      </div>
    </form>
  )
}
