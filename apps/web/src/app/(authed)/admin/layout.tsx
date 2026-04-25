import { redirect } from 'next/navigation'

import { db } from '@acme/db'
import { Role } from '@acme/db/enums'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { AUTHED_ROOT_ROUTE, LOGIN_ROUTE } from '~/constants'
import { getSession } from '~/server/session'

export default async function AdminLayout({ children }: DynamicLayoutProps) {
  // Defense in depth: (authed)/layout already gated session, but admin pages
  // additionally require ADMIN role. Source role from DB so demoted admins
  // lose access on the next request.
  const session = await getSession()
  if (!session.userId) {
    redirect(LOGIN_ROUTE)
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  })
  if (!user || user.role !== Role.ADMIN) {
    redirect(AUTHED_ROOT_ROUTE)
  }

  return <>{children}</>
}
