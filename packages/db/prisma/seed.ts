/**
 * Idempotent seed for local dev fixtures.
 *
 * Run via `pnpm -F @acme/db seed`. Safe to re-run — uses upsert keyed by name.
 *
 * What it creates:
 * - 1 ADMIN user ("Admin User")
 * - 3 USER users ("Alice", "Bob", "Carol")
 * - A welcome notification per user
 * - A handful of audit log entries
 *
 * The seeded users have NO passkeys — they exist only as DB rows. To actually
 * sign in as one, manually clear their email/passkey and use the admin reset
 * flow once Unit 2 ships, or use them as targets in admin UI tests.
 *
 * @link https://www.prisma.io/docs/guides/database/seed-database
 */
import { db } from '../src/index'

// Seeded system role IDs — must match the RBAC migration's INSERTs.
const ROLE_ADMIN = 'role_admin'
const ROLE_USER = 'role_user'

async function main() {
  const admin = await db.user.upsert({
    where: { name: 'Admin User' },
    update: { roleId: ROLE_ADMIN },
    create: { name: 'Admin User', roleId: ROLE_ADMIN },
  })

  const userNames = ['Alice', 'Bob', 'Carol']
  const users = await Promise.all(
    userNames.map((name) =>
      db.user.upsert({
        where: { name },
        update: {},
        create: { name, roleId: ROLE_USER },
      }),
    ),
  )

  // Welcome notifications for everyone — only insert if absent.
  await Promise.all(
    [admin, ...users].map(async (u) => {
      const existing = await db.notification.findFirst({
        where: { userId: u.id, title: 'Welcome to Vibe Stack' },
        select: { id: true },
      })
      if (!existing) {
        await db.notification.create({
          data: {
            userId: u.id,
            title: 'Welcome to Vibe Stack',
            body: `Hi ${u.name ?? 'there'}, your account has been seeded.`,
            href: '/dashboard',
          },
        })
      }
    }),
  )

  // Audit log entries (a sign-in trail per seeded user). Only insert if absent.
  for (const u of [admin, ...users]) {
    const existing = await db.auditLog.findFirst({
      where: { userId: u.id, action: 'auth.passkey.register' },
      select: { id: true },
    })
    if (!existing) {
      await db.auditLog.create({
        data: {
          userId: u.id,
          action: 'auth.passkey.register',
          metadata: { source: 'seed' },
        },
      })
    }
  }

  // Singleton SystemMessage row. Default `enabled: false` so freshly-seeded
  // installs don't show a banner — admins opt in via /admin/system-message.
  // The migration also inserts the row, so this upsert is just defensive in
  // case the migration ran before the default text was wired up.
  await db.systemMessage.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', enabled: false, message: '' },
  })

  console.log(
    `Seeded: 1 admin (${admin.name}), ${users.length} users (${users.map((u) => u.name).join(', ')})`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
