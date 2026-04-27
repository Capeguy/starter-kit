'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { XCircle } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { AUTHED_ROOT_ROUTE } from '~/constants'
import { useTRPC } from '~/trpc/react'

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

/**
 * Passkey-only sign-in. Two explicit intent paths so we never auto-fork on an
 * ambiguous WebAuthn `NotAllowedError` (which collapses cancel / no-credential
 * / biometric-fail / timeout into one error code):
 *
 * - **Continue with passkey** runs a modal `navigator.credentials.get()`. On
 *   any failure we stay on the same screen with an inline retry hint — the
 *   user is never silently pushed into registration.
 * - **Create new account** is a separate button next to the typed name, so
 *   registration only happens when the user explicitly asks for it.
 *
 * On top of that, conditional UI (`useBrowserAutofill: true`) runs in the
 * background as soon as the page mounts: returning users see their passkey
 * inline in the browser's autofill dropdown when they tap the name field, and
 * one tap signs them in without ever opening a modal. The conditional ceremony
 * is aborted via `WebAuthnAbortService.cancelCeremony()` before any modal flow
 * starts so the two don't race.
 */
export const PasskeyFlow = () => {
  const router = useRouter()
  const trpc = useTRPC()

  const [error, setError] = useState<string>()

  const { control, handleSubmit, watch } = useForm<{ name: string }>({
    defaultValues: { name: '' },
  })
  // Subscribe so the "Create new account" button re-renders when the user
  // types — `getValues` alone doesn't trigger React updates.
  const typedName = watch('name')

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

  const isBusy =
    authStart.isPending ||
    authVerify.isPending ||
    regStart.isPending ||
    regVerify.isPending

  // ── Conditional UI ────────────────────────────────────────────────────
  // Fire-and-forget background ceremony. The browser surfaces the user's
  // passkey in the autofill dropdown when they focus an input that has
  // `autocomplete` containing `webauthn`. The cleanup aborts via the
  // simplewebauthn singleton so the two ceremonies don't race a modal flow.
  useEffect(() => {
    const ac = new AbortController()
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- signal mutates via closure after the cleanup runs; TS can't narrow that.
    const isAborted = () => ac.signal.aborted
    const setup = async () => {
      const supported = await browserSupportsWebAuthnAutofill()
      if (!supported || isAborted()) return
      try {
        const options = await authStart.mutateAsync()
        if (isAborted()) return
        const response = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
        })
        if (isAborted()) return
        // User picked a passkey from autofill — verify + redirect.
        await authVerify.mutateAsync({
          response,
          expectedChallenge: options.challenge,
        })
        router.push(AUTHED_ROOT_ROUTE)
      } catch (err) {
        // AbortError fires when we cancel for a modal flow; NotAllowedError
        // fires when the user dismisses without picking. Both are normal
        // background-flow exits — silent.
        const name = errorName(err)
        if (name === 'AbortError' || name === 'NotAllowedError') return
        if (!isAborted()) console.error('conditional passkey error:', err)
      }
    }
    void setup()
    return () => {
      ac.abort()
      WebAuthnAbortService.cancelCeremony()
    }
    // Mutation refs are stable; we want this to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Modal sign-in ────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setError(undefined)
    // Cancel the conditional ceremony so we can start a fresh modal one.
    WebAuthnAbortService.cancelCeremony()
    try {
      const options = await authStart.mutateAsync()

      let response
      try {
        response = await startAuthentication({ optionsJSON: options })
      } catch (browserErr: unknown) {
        const name = errorName(browserErr)
        if (name === 'NotAllowedError') {
          // Could be cancel, no credential, biometric fail, timeout — we don't
          // know and the spec deliberately doesn't tell us. Stay on the screen
          // with a neutral message so the user can retry or pick the explicit
          // "Create new account" path.
          setError(
            "Sign-in didn't complete. Try again, or create a new account if this is your first visit.",
          )
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
          // Server doesn't recognise this credential. Same neutral framing —
          // user knows their passkey best, they can pick "Create new account"
          // if they meant to register.
          setError(
            "We don't recognise that passkey. Create a new account, or try again with a different one.",
          )
          return
        }
        setError(errorMessage(verifyErr))
      }
    } catch (err) {
      console.error('passkey continue error:', err)
      setError(errorMessage(err))
    }
  }

  // ── Modal registration ───────────────────────────────────────────────
  const handleRegister = handleSubmit(async ({ name }) => {
    setError(undefined)
    WebAuthnAbortService.cancelCeremony()
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
          setError('Passkey creation cancelled. Try again when you’re ready.')
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // Submitting the form (Enter key) should sign in by default; the
        // explicit "Create new account" button handles registration.
        void handleSignIn()
      }}
      className="flex flex-col gap-4"
    >
      {error && (
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="signin-name">Your name</Label>
            <Input
              {...field}
              id="signin-name"
              type="text"
              placeholder="Jane Doe"
              autoComplete="username webauthn"
              autoFocus
              aria-invalid={fieldState.invalid}
              aria-describedby="signin-name-help"
            />
            <p id="signin-name-help" className="text-muted-foreground text-xs">
              Tap above to pick a saved passkey, or type a name to create an
              account.
            </p>
          </div>
        )}
      />

      <Button type="submit" disabled={isBusy} className="w-full" size="lg">
        Continue with passkey
      </Button>

      <div className="text-muted-foreground relative my-1 text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
        <span className="bg-background relative z-10 px-2">or</span>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isBusy || typedName.trim().length === 0}
        onClick={() => void handleRegister()}
        className="w-full"
        size="lg"
      >
        Create new account
      </Button>
    </form>
  )
}
