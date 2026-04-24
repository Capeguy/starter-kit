import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import z from 'zod'

export const passkeyRegistrationOptionsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

export const passkeyRegistrationVerificationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  response: z.any() as z.ZodType<RegistrationResponseJSON>,
  expectedChallenge: z.string(),
})

export const passkeyAuthenticationVerificationSchema = z.object({
  response: z.any() as z.ZodType<AuthenticationResponseJSON>,
  expectedChallenge: z.string(),
})
