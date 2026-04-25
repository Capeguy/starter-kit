/**
 * Canonical capability catalogue. Every capability code that any procedure or
 * UI surface checks against must appear here. Capabilities are stored on
 * `Role.capabilities` (string[]) and matched by exact code.
 *
 * Conventions:
 * - Lowercase dotted codes — `<resource>.<verb>` or `<resource>.<verb>.<scope>`.
 * - `*.any` suffix means "act on any resource of this kind, not just your own".
 *   Implicit "own-resource" actions (manage your own profile, delete your own
 *   files, view your own audit log, upload an avatar) require no capability.
 * - When you add a new capability, add it here AND in a data migration that
 *   grants it to the seeded `role_admin` row.
 */
export const Capability = {
  // Admin surface
  AdminAccess: 'admin.access',

  // User management
  UserList: 'user.list',
  UserUpdate: 'user.update',
  UserDelete: 'user.delete',
  UserRoleAssign: 'user.role.assign',
  UserImpersonate: 'user.impersonate',

  // RBAC management
  RbacRoleCreate: 'rbac.role.create',
  RbacRoleUpdate: 'rbac.role.update',
  RbacRoleDelete: 'rbac.role.delete',

  // Observability
  AuditRead: 'audit.read',

  // Notifications
  NotificationBroadcast: 'notification.broadcast',

  // Files
  FileUpload: 'file.upload',
  FileReadAny: 'file.read.any',
  FileDeleteAny: 'file.delete.any',
} as const

export type CapabilityCode = (typeof Capability)[keyof typeof Capability]

/**
 * Every capability code currently in the catalogue. Used by the seeded admin
 * role bootstrap and by the role-edit UI to render the capability list.
 */
export const ALL_CAPABILITIES: readonly CapabilityCode[] =
  Object.values(Capability)

/**
 * Stable IDs of the seeded system roles (see RBAC migration). Used by the
 * passkey-service first-user bootstrap, role guards, and tests.
 */
export const SystemRoleId = {
  Admin: 'role_admin',
  User: 'role_user',
} as const

export type SystemRoleIdValue = (typeof SystemRoleId)[keyof typeof SystemRoleId]

/**
 * True iff the role has the given capability. Capability strings are matched
 * exactly — no wildcards, no inheritance.
 */
export const hasCapability = (
  capabilities: readonly string[] | null | undefined,
  cap: CapabilityCode,
): boolean => !!capabilities && capabilities.includes(cap)
