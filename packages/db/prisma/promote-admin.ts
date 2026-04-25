/**
 * Promote a user to ADMIN by their unique name (case-insensitive via citext).
 *
 * Usage:
 *   pnpm -F @acme/db promote-admin "Ben"
 *
 * Targets whichever DB the local .env's DATABASE_URL points at — for prod,
 * temporarily swap in the prod URL or run with an env var override:
 *   DATABASE_URL="<prod-url>" pnpm -F @acme/db promote-admin "Ben"
 */
import process from 'node:process'

import { Role } from '../src/generated/prisma/enums'
import { db } from '../src/index'

async function main() {
  const name = process.argv[2]?.trim()
  if (!name) {
    console.error('Usage: pnpm -F @acme/db promote-admin "<name>"')
    process.exit(2)
  }

  const user = await db.user.findFirst({
    where: { name },
    select: { id: true, name: true, role: true },
  })
  if (!user) {
    console.error(`No user with name "${name}".`)
    process.exit(1)
  }
  if (user.role === Role.ADMIN) {
    console.log(`User "${user.name}" (${user.id}) is already ADMIN.`)
    return
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { role: Role.ADMIN },
    select: { id: true, name: true, role: true },
  })

  console.log(
    `Promoted user "${updated.name}" (${updated.id}) → ${updated.role}.`,
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
