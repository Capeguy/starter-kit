import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { db } from '@acme/db'

import { LoadingState } from '~/components/ui/loading-state'
import { AUTHED_ROOT_ROUTE, LOGIN_ROUTE } from '~/constants'
import { Capability, hasCapability } from '~/lib/rbac'
import { getSession } from '~/server/session'
import { HydrateClient, prefetch, trpc } from '~/trpc/server'
import { FeatureFlagsPage } from './_components/feature-flags-page'

export default async function AdminFeatureFlagsRoute() {
  // Defense in depth: the admin layout already gates `admin.access`, but
  // this page additionally requires `feature_flag.manage`. Mirror the
  // pattern from admin/layout.tsx so the redirect is server-side.
  const session = await getSession()
  if (!session.userId) redirect(LOGIN_ROUTE)
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { role: { select: { capabilities: true } } },
  })
  if (!hasCapability(user?.role.capabilities, Capability.FeatureFlagManage)) {
    redirect(AUTHED_ROOT_ROUTE)
  }

  await prefetch(trpc.admin.featureFlags.list.queryOptions())

  return (
    <HydrateClient>
      <Suspense fallback={<LoadingState />}>
        <FeatureFlagsPage />
      </Suspense>
    </HydrateClient>
  )
}
