/**
 * Human-readable labels for audit action codes (mirrors `AuditAction` in
 * `server/modules/audit/audit.service.ts`). Kept here as a UI-only mapping so
 * the canonical codes — which filters and persisted rows key on — stay stable.
 *
 * If/when an i18n framework lands, migrate these into the message catalogue
 * keyed by the same action codes.
 */
import type { ReactNode } from 'react'
import NextLink from 'next/link'

export type AuditPerspective = 'self' | 'admin'

export interface AuditSubject {
  id: string
  name: string | null
  email?: string | null
}

export type AuditRelatedUsers = Record<string, AuditSubject>

export interface AuditEventRow {
  action: string
  metadata: unknown
  /** The user the row is "about" (the audit log row's `userId`). */
  user?: AuditSubject | null
}

const subjectLabel = (user: AuditSubject | null | undefined): string =>
  user?.name ?? user?.email ?? '(deleted user)'

const getMetaString = (meta: unknown, key: string): string | undefined => {
  if (typeof meta !== 'object' || meta === null) return undefined
  const v = (meta as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : undefined
}

const userLabel = (
  id: string,
  related: AuditRelatedUsers | undefined,
): string => {
  const u = related?.[id]
  return u?.name ?? u?.email ?? `user ${id}`
}

const UserRef = ({
  id,
  related,
}: {
  id: string
  related: AuditRelatedUsers | undefined
}): ReactNode => (
  <NextLink
    href={`/admin/users/${id}`}
    className="text-base-content-brand hover:underline"
  >
    {userLabel(id, related)}
  </NextLink>
)

/**
 * Renders an audit event as an explicit human sentence. Two perspectives:
 * - `self`: viewer is the subject (e.g. dashboard's "Recent activity").
 * - `admin`: third-person with subject names (e.g. /admin/audit).
 *
 * For actions where the actor differs from the subject (passkey reset,
 * role change), we surface that distinction explicitly. User-id references in
 * metadata (impersonation target, role-change actor, etc.) render as a link
 * to /admin/users/{id} when `relatedUsers` provides the name.
 */
export const formatAuditEvent = (
  row: AuditEventRow,
  perspective: AuditPerspective = 'admin',
  relatedUsers?: AuditRelatedUsers,
): ReactNode => {
  const isSelf = perspective === 'self'
  const subject = subjectLabel(row.user)
  const actorId = getMetaString(row.metadata, 'actingUserId')
  const issuerId = getMetaString(row.metadata, 'issuedById')
  const newRole = getMetaString(row.metadata, 'newRole')
  const deletedUserId = getMetaString(row.metadata, 'deletedUserId')

  switch (row.action) {
    case 'auth.passkey.register':
      return isSelf
        ? 'You registered a passkey'
        : `${subject} registered a passkey`

    case 'auth.passkey.authenticate':
      return isSelf ? 'You signed in' : `${subject} signed in`

    case 'auth.logout':
      return isSelf ? 'You signed out' : `${subject} signed out`

    case 'auth.passkey.reset.issue':
      return isSelf ? (
        <>
          An admin issued a passkey reset link for you
          {issuerId && (
            <>
              {' ('}
              <UserRef id={issuerId} related={relatedUsers} />
              {')'}
            </>
          )}
        </>
      ) : (
        <>
          {issuerId ? (
            <UserRef id={issuerId} related={relatedUsers} />
          ) : (
            'An admin'
          )}{' '}
          issued a passkey reset link for {subject}
        </>
      )

    case 'auth.passkey.reset.claim':
      return isSelf
        ? 'You reset your passkey using a reset link'
        : `${subject} reset their own passkey using a reset link`

    case 'user.role.change':
      return isSelf ? (
        <>
          An admin changed your role to {newRole ?? 'a new role'}
          {actorId && (
            <>
              {' ('}
              <UserRef id={actorId} related={relatedUsers} />
              {')'}
            </>
          )}
        </>
      ) : (
        <>
          {actorId ? (
            <UserRef id={actorId} related={relatedUsers} />
          ) : (
            'An admin'
          )}{' '}
          changed {subject}&apos;s role to {newRole ?? '?'}
        </>
      )

    case 'user.delete':
      // The row's user is the admin who performed the deletion; the deleted
      // user is in metadata. Self-perspective only happens for the acting admin.
      return isSelf ? (
        <>
          You deleted an account
          {deletedUserId && (
            <>
              {' ('}
              <UserRef id={deletedUserId} related={relatedUsers} />
              {')'}
            </>
          )}
        </>
      ) : (
        <>
          {subject} deleted an account
          {deletedUserId && (
            <>
              {' ('}
              <UserRef id={deletedUserId} related={relatedUsers} />
              {')'}
            </>
          )}
        </>
      )

    case 'user.profile.update':
      return isSelf
        ? 'You updated your profile'
        : `${subject} updated their profile`

    case 'user.impersonate.start': {
      const targetId = getMetaString(row.metadata, 'targetUserId')
      return isSelf ? (
        <>
          You started impersonating{' '}
          {targetId ? (
            <UserRef id={targetId} related={relatedUsers} />
          ) : (
            'a user'
          )}
        </>
      ) : (
        <>
          {subject} started impersonating{' '}
          {targetId ? (
            <UserRef id={targetId} related={relatedUsers} />
          ) : (
            'a user'
          )}
        </>
      )
    }

    case 'user.impersonate.stop': {
      const impId = getMetaString(row.metadata, 'impersonatedUserId')
      return isSelf ? (
        <>
          You stopped impersonating{' '}
          {impId ? <UserRef id={impId} related={relatedUsers} /> : 'a user'}
        </>
      ) : (
        <>
          {subject} stopped impersonating{' '}
          {impId ? <UserRef id={impId} related={relatedUsers} /> : 'a user'}
        </>
      )
    }

    default:
      return row.action
  }
}
