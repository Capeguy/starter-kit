import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { resetTables } from '~tests/db/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@acme/db'

import {
  generatePasskeyAuthenticationOptions,
  generatePasskeyRegistrationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from '../passkey.service'

vi.mock('@simplewebauthn/server', async () => {
  const actual =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await vi.importActual<typeof import('@simplewebauthn/server')>(
      '@simplewebauthn/server',
    )
  return {
    ...actual,
    verifyRegistrationResponse: vi.fn().mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'mock-credential-id',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    }),
    verifyAuthenticationResponse: vi.fn().mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    }),
  }
})

const mockHeaders = new Headers({
  host: 'localhost:3000',
  'x-forwarded-proto': 'http',
})

describe('passkey.service', () => {
  beforeEach(async () => {
    await resetTables(['PasskeyChallenge', 'Passkey', 'Account', 'User'])
    vi.clearAllMocks()
  })

  describe('generatePasskeyRegistrationOptions', () => {
    it('generates registration options and stores challenge', async () => {
      const name = 'John Doe'
      const options = await generatePasskeyRegistrationOptions({
        name,
        headers: mockHeaders,
      })

      expect(options.challenge).toBeDefined()
      expect(options.user.name).toBe(name)
      expect(options.user.displayName).toBe(name)
      expect(options.rp.name).toBeDefined()
      expect(options.rp.id).toBe('localhost')
      expect(options.authenticatorSelection?.userVerification).toBe('preferred')
      expect(options.authenticatorSelection?.residentKey).toBe('required')

      const challenge = await db.passkeyChallenge.findFirst({
        where: { challenge: options.challenge },
      })
      expect(challenge).toBeDefined()
      expect(challenge?.userId).toBeNull()
    })

    it('sets ~5 minute expiry on the challenge', async () => {
      const before = new Date()
      const options = await generatePasskeyRegistrationOptions({
        name: 'John',
        headers: mockHeaders,
      })
      const challenge = await db.passkeyChallenge.findFirst({
        where: { challenge: options.challenge },
      })
      expect(challenge?.expiresAt.getTime()).toBeGreaterThan(before.getTime())
      expect(
        (challenge?.expiresAt.getTime() ?? 0) - before.getTime(),
      ).toBeLessThan(5 * 60 * 1000 + 2000)
    })
  })

  describe('verifyPasskeyRegistration', () => {
    it('creates user + passkey + account and clears challenge on valid response', async () => {
      const name = 'John Doe'
      const options = await generatePasskeyRegistrationOptions({
        name,
        headers: mockHeaders,
      })

      const mockResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: Buffer.from(
            JSON.stringify({
              type: 'webauthn.create',
              challenge: options.challenge,
              origin: 'http://localhost:3000',
            }),
          ).toString('base64url'),
          attestationObject: 'mock-attestation',
        },
        type: 'public-key',
      } as unknown as RegistrationResponseJSON

      const verification = await verifyPasskeyRegistration({
        name,
        response: mockResponse,
        expectedChallenge: options.challenge,
        headers: mockHeaders,
      })

      expect(verification.verified).toBe(true)
      expect(verification.userId).toBeDefined()

      const user = await db.user.findUnique({
        where: { id: verification.userId },
      })
      expect(user?.name).toBe(name)
      expect(user?.email).toBeNull()

      const passkey = await db.passkey.findFirst({
        where: { userId: verification.userId },
      })
      expect(passkey?.credentialId).toBe('mock-credential-id')

      const account = await db.account.findFirst({
        where: { userId: verification.userId },
      })
      expect(account?.provider).toBe('passkey')

      const challenge = await db.passkeyChallenge.findUnique({
        where: { challenge: options.challenge },
      })
      expect(challenge).toBeNull()
    })

    it('rejects an expired challenge', async () => {
      const options = await generatePasskeyRegistrationOptions({
        name: 'John',
        headers: mockHeaders,
      })
      await db.passkeyChallenge.update({
        where: { challenge: options.challenge },
        data: { expiresAt: new Date(Date.now() - 1000) },
      })

      const mockResponse = {
        id: 'mock-credential-id',
      } as unknown as RegistrationResponseJSON

      await expect(
        verifyPasskeyRegistration({
          name: 'John',
          response: mockResponse,
          expectedChallenge: options.challenge,
          headers: mockHeaders,
        }),
      ).rejects.toThrow('Challenge has expired')
    })

    it('rejects an unknown challenge', async () => {
      const mockResponse = {
        id: 'mock-credential-id',
      } as unknown as RegistrationResponseJSON

      await expect(
        verifyPasskeyRegistration({
          name: 'John',
          response: mockResponse,
          expectedChallenge: 'does-not-exist',
          headers: mockHeaders,
        }),
      ).rejects.toThrow('Challenge not found or invalid')
    })
  })

  describe('generatePasskeyAuthenticationOptions', () => {
    it('includes existing passkeys as allowCredentials', async () => {
      const user = await db.user.create({ data: { name: 'John Doe' } })
      await db.passkey.create({
        data: {
          userId: user.id,
          credentialId: 'test-credential-id',
          credentialPublicKey: Buffer.from('test-public-key'),
          counter: 0n,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          transports: ['internal'],
        },
      })

      const options = await generatePasskeyAuthenticationOptions({
        headers: mockHeaders,
      })

      expect(options.challenge).toBeDefined()
      expect(options.allowCredentials?.length).toBeGreaterThan(0)
      expect(options.allowCredentials?.[0]?.id).toBe('test-credential-id')

      const challenge = await db.passkeyChallenge.findFirst({
        where: { challenge: options.challenge },
      })
      expect(challenge).toBeDefined()
    })

    it('falls back to discoverable flow when no passkeys exist', async () => {
      const options = await generatePasskeyAuthenticationOptions({
        headers: mockHeaders,
      })
      expect(options.challenge).toBeDefined()
      expect(options.allowCredentials).toBeUndefined()
    })
  })

  describe('verifyPasskeyAuthentication', () => {
    it('verifies known credential, bumps counter and lastUsedAt', async () => {
      const user = await db.user.create({ data: { name: 'John Doe' } })
      const passkey = await db.passkey.create({
        data: {
          userId: user.id,
          credentialId: 'test-credential-id',
          credentialPublicKey: Buffer.from('test-public-key'),
          counter: 0n,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          transports: ['internal'],
        },
      })

      const options = await generatePasskeyAuthenticationOptions({
        headers: mockHeaders,
      })

      const mockResponse = {
        id: 'test-credential-id',
        rawId: 'test-credential-id',
        response: {
          clientDataJSON: Buffer.from(
            JSON.stringify({
              type: 'webauthn.get',
              challenge: options.challenge,
              origin: 'http://localhost:3000',
            }),
          ).toString('base64url'),
          authenticatorData: 'mock-authenticator-data',
          signature: 'mock-signature',
        },
        type: 'public-key',
      } as unknown as AuthenticationResponseJSON

      const verification = await verifyPasskeyAuthentication({
        response: mockResponse,
        expectedChallenge: options.challenge,
        headers: mockHeaders,
      })

      expect(verification.userId).toBe(user.id)
      expect(verification.verified).toBe(true)

      const updated = await db.passkey.findUnique({ where: { id: passkey.id } })
      expect(updated?.counter).toBeGreaterThan(0n)
      expect(updated?.lastUsedAt.getTime()).toBeGreaterThan(
        passkey.lastUsedAt.getTime() - 1,
      )

      const challenge = await db.passkeyChallenge.findUnique({
        where: { challenge: options.challenge },
      })
      expect(challenge).toBeNull()
    })

    it('throws NOT_FOUND when credential is unknown (and preserves the challenge for recovery)', async () => {
      const options = await generatePasskeyAuthenticationOptions({
        headers: mockHeaders,
      })

      const mockResponse = {
        id: 'unknown-credential-id',
      } as unknown as AuthenticationResponseJSON

      await expect(
        verifyPasskeyAuthentication({
          response: mockResponse,
          expectedChallenge: options.challenge,
          headers: mockHeaders,
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })

      // Challenge must remain so the client can immediately reuse it for register-on-recovery.
      const challenge = await db.passkeyChallenge.findUnique({
        where: { challenge: options.challenge },
      })
      expect(challenge).not.toBeNull()
    })
  })

  describe('name uniqueness', () => {
    it('rejects up-front in generateRegistrationOptions when the name is already taken (so the device passkey UI is never triggered)', async () => {
      await db.user.create({ data: { name: 'Jane Doe' } })

      await expect(
        generatePasskeyRegistrationOptions({
          name: 'jane doe',
          headers: mockHeaders,
        }),
      ).rejects.toThrow(/already taken/i)
    })

    it('rejects in verifyRegistration as a fallback when the name is taken between check and create (case-insensitive race)', async () => {
      // Get options first (name is available at this moment)
      const options = await generatePasskeyRegistrationOptions({
        name: 'jane doe',
        headers: mockHeaders,
      })

      // Simulate another user grabbing the name in the gap between
      // generateRegistrationOptions and verifyRegistration. citext makes
      // "Jane Doe" and "jane doe" collide.
      await db.user.create({ data: { name: 'Jane Doe' } })

      const mockResponse = {
        id: 'mock-credential-id',
        rawId: 'mock-credential-id',
        response: {
          clientDataJSON: Buffer.from(
            JSON.stringify({
              type: 'webauthn.create',
              challenge: options.challenge,
              origin: 'http://localhost:3000',
            }),
          ).toString('base64url'),
          attestationObject: 'mock-attestation',
        },
        type: 'public-key',
      } as unknown as RegistrationResponseJSON

      await expect(
        verifyPasskeyRegistration({
          name: 'jane doe',
          response: mockResponse,
          expectedChallenge: options.challenge,
          headers: mockHeaders,
        }),
      ).rejects.toThrow(/already taken/i)
    })
  })
})
