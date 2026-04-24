'use client'

import { useState } from 'react'

import { PasskeyLoginStep } from './passkey/passkey-login-step'
import { PasskeyRegisterStep } from './passkey/passkey-register-step'

type PasskeyFlowStep = 'choice' | 'register' | 'login'

export const PasskeyFlow = () => {
  const [step, setStep] = useState<PasskeyFlowStep>('choice')

  if (step === 'register') {
    return (
      <div className="flex flex-col gap-4">
        <PasskeyRegisterStep />
        <button
          type="button"
          onClick={() => setStep('choice')}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>
    )
  }

  if (step === 'login') {
    return (
      <div className="flex flex-col gap-4">
        <PasskeyLoginStep />
        <button
          type="button"
          onClick={() => setStep('choice')}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Welcome</h3>
        <p className="text-sm text-gray-600">
          Sign in or create a new account with passkeys.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setStep('login')}
          className="rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
        >
          Sign In with Passkey
        </button>

        <button
          type="button"
          onClick={() => setStep('register')}
          className="rounded-md border border-gray-300 bg-white px-4 py-3 text-gray-700 hover:bg-gray-50"
        >
          Create New Account
        </button>
      </div>

      <div className="text-center text-xs text-gray-500">
        <p>
          Passkeys use your device&apos;s biometrics or screen lock for secure,
          password-free authentication.
        </p>
      </div>
    </div>
  )
}
