'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Card, CardBody } from '~/components/ui/card'
import { EmptyState } from '~/components/ui/empty-state'
import { useTRPC } from '~/trpc/react'
import { formatAuditEvent } from '../../../_components/audit-action-labels'
import { RelativeTime } from '../../../_components/relative-time'

export const ActivityPage = () => {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(
    trpc.audit.listMine.queryOptions({ limit: 50 }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">Activity</h1>
        <p className="prose-body-2 text-base-content-medium">
          Your recent sign-ins, passkey events, and account changes.
        </p>
      </header>

      <Card>
        <CardBody>
          {data.items.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Your recent actions will appear here."
            />
          ) : (
            <ul className="prose-body-2 flex flex-col gap-1">
              {data.items.map((a) => (
                <li
                  key={a.id}
                  className="border-base-divider-subtle flex items-center justify-between gap-2 border-b py-2 last:border-b-0"
                >
                  <span className="text-base-content-default">
                    {formatAuditEvent(
                      { action: a.action, metadata: a.metadata },
                      'self',
                      data.relatedUsers,
                    )}
                  </span>
                  <RelativeTime
                    date={a.createdAt}
                    className="text-base-content-medium shrink-0"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
