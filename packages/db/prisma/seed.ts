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
import { Role } from '../src/generated/prisma/enums'
import { db } from '../src/index'

async function main() {
  const admin = await db.user.upsert({
    where: { name: 'Admin User' },
    update: { role: Role.ADMIN },
    create: { name: 'Admin User', role: Role.ADMIN },
  })

  const userNames = ['Alice', 'Bob', 'Carol']
  const users = await Promise.all(
    userNames.map((name) =>
      db.user.upsert({
        where: { name },
        update: {},
        create: { name, role: Role.USER },
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
