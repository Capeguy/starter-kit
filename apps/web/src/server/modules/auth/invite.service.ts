import crypto from 'crypto'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { TRPCError } from '@trpc/server'

import type { TransactionClient } from '@acme/db'
import { db } from '@acme/db'
import { Prisma } from '@acme/db/client'

import { env } from '~/env'
import { AccountProvider } from './auth.constants'

const RP_NAME = env.NEXT_PUBLIC_APP_NAME

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

export const INVITE_DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

interface IssueInviteInput {
  /** Optional pre-fill — purely informational; recipient can pick any name. */
  name?: string | null
  /** Optional pre-fill — purely informational. */
  email?: string | null
  roleId: string
  expiresInSeconds: number | null // null = no expiry
  issuedById: string
  origin: string
}

export const issueInvite = async ({
  name,
  email,
  roleId,
  expiresInSeconds,
  issuedById,
  origin,
}: IssueInviteInput) => {
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true },
  })
  if (!role) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' })
  }

  const token = crypto.randomUUID()
  const expiresAt =
    expiresInSeconds === null
      ? null
      : new Date(Date.now() + expiresInSeconds * 1000)

  const trimmedName = name?.trim()
  const trimmedEmail = email?.trim()
  // Coerce falsy ('' | undefined) to null for the DB column.
  const nameForDb = trimmedName && trimmedName.length > 0 ? trimmedName : null
  const emailForDb =
    trimmedEmail && trimmedEmail.length > 0 ? trimmedEmail : null

  const record = await db.invite.create({
    data: {
      token,
      name: nameForDb,
      email: emailForDb,
      roleId,
      issuedById,
      expiresAt,
    },
  })

  return {
    id: record.id,
    token: record.token,
    url: `${origin}/invite/${record.token}`,
    expiresAt: record.expiresAt,
    roleName: role.name,
  }
}

interface ListInvitesInput {
  cursor?: string | null
  limit: number
}

export const listInvites = async ({ cursor, limit }: ListInvitesInput) => {
  const items = await db.invite.findMany({
    select: {
      id: true,
      token: true,
      name: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      issuedById: true,
      issuedBy: { select: { id: true, name: true, email: true } },
      claimedByUserId: true,
      claimedBy: { select: { id: true, name: true, email: true } },
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNext = items.length > limit
  const trimmed = hasNext ? items.slice(0, -1) : items

  return {
    items: trimmed,
    nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
  }
}

export const revokeInvite = async ({ id }: { id: string }) => {
  const existing = await db.invite.findUnique({
    where: { id },
    select: { id: true, consumedAt: true, revokedAt: true },
  })
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' })
  }
  if (existing.consumedAt) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invite has already been claimed and cannot be revoked.',
    })
  }
  if (existing.revokedAt) {
    return { id, alreadyRevoked: true }
  }
  await db.invite.update({
    where: { id },
    data: { revokedAt: new Date() },
  })
  return { id, alreadyRevoked: false }
}

const findValidInvite = async (token: string) => {
  const record = await db.invite.findUnique({
    where: { token },
    include: {
      role: { select: { id: true, name: true } },
    },
  })
  if (!record || record.consumedAt || record.revokedAt) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Invite link is invalid or has already been used.',
    })
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invite link has expired. Ask an admin for a new one.',
    })
  }
  return record
}

/**
 * Step 1 of the public invite flow: validate the token and return WebAuthn
 * registration options. The recipient picks an account name during the
 * passkey ceremony — we use the invite's pre-filled `name` if present and the
 * caller didn't override, otherwise the caller-supplied name. The token is
 * NOT consumed yet — that happens in step 2 after the browser produces a
 * registration response.
 */
export const startInviteWithToken = async ({
  token,
  name,
  headers,
}: {
  token: string
  name: string
  headers: Headers
}) => {
  const record = await findValidInvite(token)
  const { rpId } = getRequestOrigin(headers)

  // Up-front uniqueness check so the user doesn't go through the device's
  // passkey UI only to be told the name is taken afterwards. The DB unique
  // constraint is the final guard for the rare race.
  const existing = await db.user.findFirst({
    where: { name },
    select: { id: true },
  })
  if (existing) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'That name is already taken. Pick a different one.',
    })
  }

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
      userId: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return {
    options,
    invite: {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
    },
  }
}

/**
 * Step 2: verify the registration response, create the new user under the
 * invite's pre-assigned role, register the passkey, mark the invite consumed,
 * and return the user id so the router can sign them in.
 */
export const finishInviteWithToken = async ({
  token,
  name,
  response,
  expectedChallenge,
  headers,
}: {
  token: string
  name: string
  response: RegistrationResponseJSON
  expectedChallenge: string
  headers: Headers
}) => {
  const record = await findValidInvite(token)
  const { origin, rpId } = getRequestOrigin(headers)

  const challengeRecord = await db.passkeyChallenge.findUnique({
    where: { challenge: expectedChallenge },
  })
  if (!challengeRecord) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge is invalid or does not match this invite.',
    })
  }
  if (challengeRecord.expiresAt < new Date()) {
    await db.passkeyChallenge.delete({
      where: { challenge: expectedChallenge },
    })
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge has expired. Try again.',
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
        message: 'Passkey verification failed.',
      })
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo

    const user = await db.$transaction(async (tx: TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: record.email,
          roleId: record.roleId,
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

      await tx.invite.update({
        where: { token },
        data: {
          consumedAt: new Date(),
          claimedByUserId: newUser.id,
        },
      })

      return newUser
    })

    await db.passkeyChallenge
      .delete({ where: { challenge: expectedChallenge } })
      .catch(() => undefined)

    return { userId: user.id, inviteId: record.id }
  } catch (error) {
    await db.passkeyChallenge
      .delete({ where: { challenge: expectedChallenge } })
      .catch(() => undefined)

    if (error instanceof TRPCError) {
      throw error
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That name is already taken. Pick a different one.',
      })
    }

    console.error('invite.claim.error', error)

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to verify invite passkey registration.',
      cause: error,
    })
  }
}
