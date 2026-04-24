import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { TRPCError } from '@trpc/server'

import type { TransactionClient } from '@acme/db'
import { db } from '@acme/db'

import { env } from '~/env'
import { AccountProvider } from './auth.constants'

const RP_NAME = env.NEXT_PUBLIC_APP_NAME
const CHALLENGE_TTL_MS = 5 * 60 * 1000

const getRequestOrigin = (headers: Headers) => {
  const host =
    headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000'
  const proto = headers.get('x-forwarded-proto') ?? 'https'
  return { origin: `${proto}://${host}`, rpId: host.split(':')[0] ?? host }
}

const expectedOrigins = (origin: string) => [
  origin,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3111',
]

export const generatePasskeyRegistrationOptions = async ({
  name,
  headers,
}: {
  name: string
  headers: Headers
}) => {
  const { rpId } = getRequestOrigin(headers)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId,
    userName: name,
    userDisplayName: name,
    attestationType: 'none',
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  })

  await db.passkeyChallenge.create({
    data: {
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      userId: null,
    },
  })

  return options
}

export const verifyPasskeyRegistration = async ({
  name,
  response,
  expectedChallenge,
  headers,
}: {
  name: string
  response: RegistrationResponseJSON
  expectedChallenge: string
  headers: Headers
}) => {
  const { origin, rpId } = getRequestOrigin(headers)

  const challengeRecord = await db.passkeyChallenge.findUnique({
    where: { challenge: expectedChallenge },
  })

  if (!challengeRecord) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge not found or invalid',
    })
  }

  if (challengeRecord.expiresAt < new Date()) {
    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge has expired',
    })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(origin),
      expectedRPID: rpId,
    })

    if (!verification.verified) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Passkey verification failed',
      })
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo

    const user = await db.$transaction(async (tx: TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: null,
        },
      })

      await tx.passkey.create({
        data: {
          userId: newUser.id,
          credentialId: credential.id,
          credentialPublicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          credentialDeviceType,
          credentialBackedUp,
          transports: credential.transports ?? [],
          name,
        },
      })

      await tx.account.create({
        data: {
          userId: newUser.id,
          provider: AccountProvider.Passkey,
          providerAccountId: credential.id,
        },
      })

      return newUser
    })

    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })

    return {
      userId: user.id,
      verified: true,
    }
  } catch (error) {
    await db.passkeyChallenge
      .delete({ where: { challenge: expectedChallenge } })
      .catch(() => undefined)

    if (error instanceof TRPCError) {
      throw error
    }

    console.error('passkey.registration.error', error)

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify passkey registration',
      cause: error,
    })
  }
}

export const generatePasskeyAuthenticationOptions = async ({
  headers,
}: {
  headers: Headers
}) => {
  const { rpId } = getRequestOrigin(headers)

  const passkeys = await db.passkey.findMany({
    select: { credentialId: true, transports: true },
  })

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials:
      passkeys.length > 0
        ? passkeys.map((p) => ({
            id: p.credentialId,
            transports: p.transports as AuthenticatorTransportFuture[],
          }))
        : undefined,
    userVerification: 'preferred',
  })

  await db.passkeyChallenge.create({
    data: {
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      userId: null,
    },
  })

  return options
}

const autoRegisterNewUser = async ({
  response,
  expectedChallenge,
}: {
  response: AuthenticationResponseJSON
  expectedChallenge: string
}): Promise<{ userId: string; verified: boolean; isNewUser: boolean }> => {
  try {
    const user = await db.$transaction(async (tx: TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          name: 'Passkey User',
          email: null,
        },
      })

      await tx.passkey.create({
        data: {
          userId: newUser.id,
          credentialId: response.id,
          credentialPublicKey: Buffer.from([]),
          counter: 0n,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          transports: [],
        },
      })

      await tx.account.create({
        data: {
          userId: newUser.id,
          provider: AccountProvider.Passkey,
          providerAccountId: response.id,
        },
      })

      return newUser
    })

    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })

    return { userId: user.id, verified: true, isNewUser: true }
  } catch (error) {
    await db.passkeyChallenge
      .delete({ where: { challenge: expectedChallenge } })
      .catch(() => undefined)

    if (error instanceof TRPCError) {
      throw error
    }

    console.error('passkey.auto_registration.error', error)

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to auto-register new user',
      cause: error,
    })
  }
}

export const verifyPasskeyAuthentication = async ({
  response,
  expectedChallenge,
  headers,
}: {
  response: AuthenticationResponseJSON
  expectedChallenge: string
  headers: Headers
}): Promise<{ userId: string; verified: boolean; isNewUser: boolean }> => {
  const challengeRecord = await db.passkeyChallenge.findUnique({
    where: { challenge: expectedChallenge },
  })

  if (!challengeRecord) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge not found or invalid',
    })
  }

  if (challengeRecord.expiresAt < new Date()) {
    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge has expired',
    })
  }

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
  })

  if (!passkey) {
    return autoRegisterNewUser({ response, expectedChallenge })
  }

  const { origin, rpId } = getRequestOrigin(headers)

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(origin),
      expectedRPID: rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.credentialPublicKey),
        counter: Number(passkey.counter),
      },
    })

    if (!verification.verified) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Passkey authentication failed',
      })
    }

    await db.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    })

    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })

    return { userId: passkey.userId, verified: true, isNewUser: false }
  } catch (error) {
    await db.passkeyChallenge
      .delete({ where: { challenge: expectedChallenge } })
      .catch(() => undefined)

    if (error instanceof TRPCError) {
      throw error
    }

    console.error('passkey.authentication.error', error)

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify passkey authentication',
      cause: error,
    })
  }
}
