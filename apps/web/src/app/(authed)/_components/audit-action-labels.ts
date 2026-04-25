/**
 * Human-readable labels for audit action codes (mirrors `AuditAction` in
 * `server/modules/audit/audit.service.ts`). Kept here as a UI-only mapping so
 * the canonical codes — which filters and persisted rows key on — stay stable.
 *
 * If/when an i18n framework lands, migrate these into the message catalogue
 * keyed by the same action codes.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'auth.passkey.register': 'Registered a passkey',
  'auth.passkey.authenticate': 'Signed in',
  'auth.passkey.reset.issue': 'Issued a passkey reset link',
  'auth.passkey.reset.claim': 'Reset their passkey',
  'auth.logout': 'Signed out',
  'user.role.change': 'Role changed',
  'user.delete': 'Account deleted',
  'user.profile.update': 'Updated profile',
}

export const formatAuditAction = (action: string): string =>
  AUDIT_ACTION_LABEL[action] ?? action
