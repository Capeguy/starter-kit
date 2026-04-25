import crypto from 'crypto'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { TRPCError } from '@trpc/server'

import type { TransactionClient } from '@acme/db'
import { db } from '@acme/db'

import type { CapabilityCode } from '~/lib/rbac'
import { env } from '~/env'
import { Capability } from '~/lib/rbac'
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
  /** Filter to a single role by id. */
  roleId?: string | null
  cursor?: string | null
  limit: number
}

const userListSelect = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  role: {
    select: { id: true, name: true, isSystem: true, capabilities: true },
  },
  avatarUrl: true,
  createdAt: true,
  lastLogin: true,
  _count: { select: { passkeys: true } },
} as const

export const listUsers = async ({
  q,
  roleId,
  cursor,
  limit,
}: ListUsersInput) => {
  const items = await db.user.findMany({
    where: {
      ...(roleId ? { roleId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: userListSelect,
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
      roleId: true,
      role: {
        select: { id: true, name: true, isSystem: true, capabilities: true },
      },
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

/**
 * Anti-lockout guard: ensure at least one *other* user (excluding `excludingUserId`)
 * still has a role granting `capability`. The classic case is `rbac.role.update` —
 * if the only user who could grant or edit roles loses it, the system can no
 * longer be administered without DB surgery.
 */
const assertNotLastWithCapability = async (
  tx: TransactionClient,
  capability: CapabilityCode,
  excludingUserId: string,
) => {
  const remaining = await tx.user.count({
    where: {
      id: { not: excludingUserId },
      role: { capabilities: { has: capability } },
    },
  })
  if (remaining === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot perform this change: it would leave no user with the "${capability}" capability.`,
    })
  }
}

interface SetUserRoleInput {
  userId: string
  roleId: string
  actingUserId: string
}

export const setUserRole = async ({
  userId,
  roleId,
  actingUserId,
}: SetUserRoleInput) => {
  return db.$transaction(async (tx: TransactionClient) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roleId: true,
        name: true,
        role: { select: { id: true, name: true, capabilities: true } },
      },
    })
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    if (target.roleId === roleId) {
      return { id: target.id, roleId: target.roleId, changed: false }
    }
    const newRole = await tx.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, capabilities: true },
    })
    if (!newRole) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' })
    }

    // If we're stripping the rbac.role.update capability from this user, make
    // sure someone else still has it (otherwise nobody can ever fix RBAC again).
    const had = target.role.capabilities.includes(Capability.RbacRoleUpdate)
    const has = newRole.capabilities.includes(Capability.RbacRoleUpdate)
    if (had && !has) {
      await assertNotLastWithCapability(tx, Capability.RbacRoleUpdate, userId)
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { roleId },
      select: { id: true, roleId: true, name: true },
    })

    if (userId !== actingUserId) {
      await tx.notification.create({
        data: {
          userId,
          title: `Your role was changed to ${newRole.name}`,
          body: 'An administrator updated your account permissions.',
        },
      })
    }

    return { id: updated.id, roleId: updated.roleId, changed: true }
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
      select: { role: { select: { capabilities: true } } },
    })
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    // Same lockout guard as `setUserRole`.
    if (target.role.capabilities.includes(Capability.RbacRoleUpdate)) {
      await assertNotLastWithCapability(tx, Capability.RbacRoleUpdate, userId)
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
    include: {
      user: {
        select: {
          id: true,
          name: true,
          roleId: true,
          role: { select: { capabilities: true } },
        },
      },
    },
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
