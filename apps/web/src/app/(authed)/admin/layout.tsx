import { redirect } from 'next/navigation'

import { db } from '@acme/db'

import type { DynamicLayoutProps } from '~/types/nextjs'
import { AUTHED_ROOT_ROUTE, LOGIN_ROUTE } from '~/constants'
import { Capability, hasCapability } from '~/lib/rbac'
import { getSession } from '~/server/session'

export default async function AdminLayout({ children }: DynamicLayoutProps) {
  // Defense in depth: (authed)/layout already gated session, but admin pages
  // additionally require the `admin.access` capability. Source from DB so
  // capability changes take effect on the next request, not the next sign-in.
  const session = await getSession()
  if (!session.userId) {
    redirect(LOGIN_ROUTE)
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: { select: { capabilities: true } } },
  })
  if (!hasCapability(user?.role.capabilities, Capability.AdminAccess)) {
    redirect(AUTHED_ROOT_ROUTE)
  }

  return <>{children}</>
}
