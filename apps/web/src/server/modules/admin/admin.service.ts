import crypto from 'crypto'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { TRPCError } from '@trpc/server'

import type { TransactionClient } from '@acme/db'
import { db } from '@acme/db'
import { Role } from '@acme/db/enums'

import { env } from '~/env'
import { AccountProvider } from '../auth/auth.constants'

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

interface ListUsersInput {
  q?: string | null
  role?: typeof Role.USER | typeof Role.ADMIN | null
  cursor?: string | null
  limit: number
}

export const listUsers = async ({ q, role, cursor, limit }: ListUsersInput) => {
  const items = await db.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      lastLogin: true,
      _count: { select: { passkeys: true } },
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

export const getUser = async ({ userId }: { userId: string }) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      lastLogin: true,
      _count: { select: { passkeys: true, files: true } },
    },
  })
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
  }
  return user
}

const assertNotLastAdmin = async (
  tx: TransactionClient,
  excludingUserId: string,
) => {
  const remainingAdmins = await tx.user.count({
    where: { role: Role.ADMIN, id: { not: excludingUserId } },
  })
  if (remainingAdmins === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Cannot demote or delete the last admin. Promote another user first.',
    })
  }
}

interface SetUserRoleInput {
  userId: string
  role: typeof Role.USER | typeof Role.ADMIN
  actingUserId: string
}

export const setUserRole = async ({
  userId,
  role,
  actingUserId,
}: SetUserRoleInput) => {
  return db.$transaction(async (tx: TransactionClient) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true },
    })
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    if (target.role === role) {
      return { id: target.id, role: target.role, changed: false }
    }
    // Demoting an admin (or yourself) requires another admin to exist.
    if (target.role === Role.ADMIN && role === Role.USER) {
      await assertNotLastAdmin(tx, userId)
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true, name: true },
    })

    // Notification to the affected user (silent if the change is for self).
    if (userId !== actingUserId) {
      await tx.notification.create({
        data: {
          userId,
          title: `Your role was changed to ${role}`,
          body: 'An administrator updated your account permissions.',
        },
      })
    }

    return { id: updated.id, role: updated.role, changed: true }
  })
}

export const deleteUser = async ({
  userId,
  actingUserId,
}: {
  userId: string
  actingUserId: string
}) => {
  if (userId === actingUserId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Use account-self-deletion for your own account.',
    })
  }
  return db.$transaction(async (tx: TransactionClient) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    if (target.role === Role.ADMIN) {
      await assertNotLastAdmin(tx, userId)
    }
    await tx.user.delete({ where: { id: userId } })
    return { id: userId, deleted: true }
  })
}

interface IssueResetInput {
  userId: string
  expiresInSeconds: number | null // null = no expiry
  issuedById: string
  origin: string
}

const DEFAULT_RESET_TTL_SECONDS = 2 * 60 * 60 // 2 hours

export const issuePasskeyReset = async ({
  userId,
  expiresInSeconds,
  issuedById,
  origin,
}: IssueResetInput) => {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  })
  if (!target) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
  }

  const token = crypto.randomUUID()
  const expiresAt =
    expiresInSeconds === null
      ? null
      : new Date(Date.now() + expiresInSeconds * 1000)

  const record = await db.passkeyResetToken.create({
    data: { token, userId, issuedById, expiresAt },
  })

  return {
    token: record.token,
    url: `${origin}/reset-passkey/${record.token}`,
    expiresAt: record.expiresAt,
    targetName: target.name,
  }
}

const findValidResetToken = async (token: string) => {
  const record = await db.passkeyResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, role: true } } },
  })
  if (!record || record.consumedAt) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Reset link is invalid or has already been used.',
    })
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Reset link has expired. Ask an admin for a new one.',
    })
  }
  return record
}

/**
 * Step 1 of a public reset flow: validate the token and return WebAuthn
 * registration options for the target user. The token is NOT consumed yet —
 * that happens in step 2 after the browser produces a registration response.
 */
export const startResetWithToken = async ({
  token,
  headers,
}: {
  token: string
  headers: Headers
}) => {
  const record = await findValidResetToken(token)
  const { rpId } = getRequestOrigin(headers)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId,
    userName: record.user.name ?? 'User',
    userDisplayName: record.user.name ?? 'User',
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
      userId: record.userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return { options, targetName: record.user.name }
}

/**
 * Step 2: verify the registration response, wipe ALL existing passkeys for
 * the target user (the lockout-recovery scenario), record the new one, mark
 * the token consumed, and return the user id so the router can sign them in.
 */
export const finishResetWithToken = async ({
  token,
  response,
  expectedChallenge,
  headers,
}: {
  token: string
  response: RegistrationResponseJSON
  expectedChallenge: string
  headers: Headers
}) => {
  const record = await findValidResetToken(token)
  const { origin, rpId } = getRequestOrigin(headers)

  const challengeRecord = await db.passkeyChallenge.findUnique({
    where: { challenge: expectedChallenge },
  })
  if (!challengeRecord || challengeRecord.userId !== record.userId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Challenge is invalid or does not match this reset.',
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

  await db.$transaction(async (tx: TransactionClient) => {
    // Wipe existing passkeys + email-OTP-style accounts for this user.
    await tx.passkey.deleteMany({ where: { userId: record.userId } })
    await tx.account.deleteMany({
      where: {
        userId: record.userId,
        provider: AccountProvider.Passkey,
      },
    })

    await tx.passkey.create({
      data: {
        userId: record.userId,
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        credentialDeviceType,
        credentialBackedUp,
        transports: credential.transports ?? [],
      },
    })

    await tx.account.create({
      data: {
        userId: record.userId,
        provider: AccountProvider.Passkey,
        providerAccountId: credential.id,
      },
    })

    await tx.passkeyResetToken.update({
      where: { token },
      data: { consumedAt: new Date() },
    })

    // Notification: trust signal for the user that their account was reset.
    await tx.notification.create({
      data: {
        userId: record.userId,
        title: 'Your passkey was reset',
        body: 'A new passkey was registered via an admin-issued reset link.',
      },
    })
  })

  await db.passkeyChallenge
    .delete({ where: { challenge: expectedChallenge } })
    .catch(() => undefined)

  return { userId: record.userId }
}

export const RESET_DEFAULT_TTL_SECONDS = DEFAULT_RESET_TTL_SECONDS
