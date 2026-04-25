'use client'

import { Infobox } from '@opengovsg/oui/infobox'
import { useSuspenseQuery } from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'

export const DashboardPage = () => {
  const trpc = useTRPC()
  const { data: me } = useSuspenseQuery(trpc.me.get.queryOptions())

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">
          Welcome, {me?.name ?? 'there'}
        </h1>
        <p className="prose-body-2 text-base-content-medium">
          {me?.role === 'ADMIN' ? 'Admin account' : 'Member'}
        </p>
      </header>

      <Infobox variant="info">
        Dashboard is a stub for now — profile, notifications, files, and recent
        activity panels land in Unit 5.
      </Infobox>
    </div>
  )
}
