import { db } from '@acme/db'
import { Prisma } from '@acme/db/client'

import { extractIpAddress } from '~/server/utils/request'

/**
 * Canonical action names. Treat as a soft enum — keep these stable, since
 * audit log filters in the admin UI key on them. Add new entries rather
 * than renaming existing ones.
 */
export const AuditAction = {
  AuthPasskeyRegister: 'auth.passkey.register',
  AuthPasskeyAuthenticate: 'auth.passkey.authenticate',
  AuthPasskeyResetIssue: 'auth.passkey.reset.issue',
  AuthPasskeyResetClaim: 'auth.passkey.reset.claim',
  AuthLogout: 'auth.logout',
  UserRoleChange: 'user.role.change',
  UserDelete: 'user.delete',
  UserProfileUpdate: 'user.profile.update',
  UserImpersonateStart: 'user.impersonate.start',
  UserImpersonateStop: 'user.impersonate.stop',
  UserInviteIssue: 'user.invite.issue',
  UserInviteClaim: 'user.invite.claim',
  FeatureFlagUpsert: 'feature_flag.upsert',
  FeatureFlagDelete: 'feature_flag.delete',
  ApiTokenIssue: 'api_token.issue',
  ApiTokenRevoke: 'api_token.revoke',
} as const

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction]

interface RecordAuditEventInput {
  userId: string | null | undefined
  action: AuditActionValue
  metadata?: Record<string, unknown>
  headers: Headers
}

/**
 * Fire-and-forget audit event recorder. Never throws — failures are logged to
 * console.error and swallowed so audit infrastructure problems don't take
 * down the user-facing flow.
 *
 * The intent is for callers to await this so the row is committed before
 * the request returns, but if the await is dropped or we ever batch, the
 * fire-and-forget semantics still hold.
 */
export const recordAuditEvent = async ({
  userId,
  action,
  metadata,
  headers,
}: RecordAuditEventInput): Promise<void> => {
  try {
    await db.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
        ip: extractIpAddress(headers),
        userAgent: headers.get('user-agent') ?? null,
      },
    })
  } catch (error) {
    console.error('audit.record.error', { action, userId, error })
  }
}
