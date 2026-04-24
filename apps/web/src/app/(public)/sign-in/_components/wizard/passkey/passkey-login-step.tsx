'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@opengovsg/oui/button'
import { startAuthentication } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'

import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

interface PasskeyLoginStepProps {
  onSuccess?: () => void
}

export const PasskeyLoginStep = ({ onSuccess }: PasskeyLoginStepProps) => {
  const [error, setError] = useState<string>()
  const router = useRouter()
  const trpc = useTRPC()

  const verifyMutation = useMutation(
    trpc.auth.passkey.verifyAuthentication.mutationOptions({
      onSuccess: () => {
        router.push(AUTHED_ROOT_ROUTE)
        onSuccess?.()
      },
      onError: (err) => {
        setError(err.message)
      },
    }),
  )

  const loginMutation = useMutation(
    trpc.auth.passkey.generateAuthenticationOptions.mutationOptions({
      onSuccess: async (options) => {
        try {
          const authenticationResponse = await startAuthentication({
            optionsJSON: options,
          })

          await verifyMutation.mutateAsync({
            response: authenticationResponse,
            expectedChallenge: options.challenge,
          })
        } catch (err: unknown) {
          console.error('Authentication error:', err)
          const message = err instanceof Error ? err.message : 'Unknown error'
          const name =
            err && typeof err === 'object' && 'name' in err
              ? (err.name as string)
              : ''
          if (name === 'NotAllowedError') {
            setError('Sign in was cancelled.')
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

  const isLoading = loginMutation.isPending || verifyMutation.isPending

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Sign in with passkey</h3>
        <p className="text-sm text-gray-600">
          Use your device&apos;s biometrics or screen lock to sign in securely.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Button
        size="sm"
        isPending={isLoading}
        onPress={() => loginMutation.mutate()}
      >
        {isLoading ? 'Authenticating…' : 'Sign In with Passkey'}
      </Button>

      <div className="text-center text-xs text-gray-500">
        <p>Your passkey is stored securely on your device.</p>
      </div>
    </div>
  )
}
