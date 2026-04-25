'use client'

import { Avatar } from '@opengovsg/oui/avatar'
import { Tab, TabList, TabPanel, Tabs } from '@opengovsg/oui/tabs'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Breadcrumbs } from '~/components/ui/breadcrumbs'
import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { EmptyState } from '~/components/ui/empty-state'
import { PageHeader } from '~/components/ui/page-header'
import { useTRPC } from '~/trpc/react'

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

interface UserDetailPageProps {
  userId: string
}

export function UserDetailPage({ userId }: UserDetailPageProps) {
  const trpc = useTRPC()
  const { data: user } = useSuspenseQuery(
    trpc.admin.users.get.queryOptions({ userId }),
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: user.name ?? '(unnamed)' },
        ]}
      />

      <PageHeader
        title={user.name ?? '(unnamed)'}
        description={[user.email, user.role.name].filter(Boolean).join(' · ')}
      />

      <Tabs>
        <TabList aria-label="User detail sections">
          <Tab id="profile">Profile</Tab>
          <Tab id="audit">Audit</Tab>
          <Tab id="sessions">Sessions</Tab>
        </TabList>

        {/* Profile tab */}
        <TabPanel id="profile">
          <div className="mt-4">
            <Card>
              <CardHeader title="Profile" />
              <CardBody className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Avatar size="md" name={user.name ?? 'User'}>
                    {user.avatarUrl && (
                      <Avatar.Image src={user.avatarUrl} alt="" />
                    )}
                    <Avatar.Fallback />
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <span className="prose-label-md text-base-content-strong">
                      {user.name ?? '(unnamed)'}
                    </span>
                    <span className="prose-body-2 text-base-content-medium">
                      {user.email ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="border-base-divider-subtle grid grid-cols-2 gap-x-8 gap-y-3 border-t pt-4">
                  <div>
                    <p className="prose-caption-1 text-base-content-medium mb-0.5">
                      Role
                    </p>
                    <p className="prose-label-md text-base-content-strong">
                      {user.role.name}
                    </p>
                  </div>
                  <div>
                    <p className="prose-caption-1 text-base-content-medium mb-0.5">
                      Capabilities
                    </p>
                    <p className="prose-label-md text-base-content-strong">
                      {user.role.capabilities.length}
                    </p>
                  </div>
                  <div>
                    <p className="prose-caption-1 text-base-content-medium mb-0.5">
                      Member since
                    </p>
                    <p className="prose-label-md text-base-content-strong">
                      {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="prose-caption-1 text-base-content-medium mb-0.5">
                      Last login
                    </p>
                    <p className="prose-label-md text-base-content-strong">
                      {user.lastLogin ? formatDateTime(user.lastLogin) : '—'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        {/* Audit tab */}
        <TabPanel id="audit">
          <div className="mt-4">
            <EmptyState
              title="Audit history coming soon"
              description="Per-user audit log will live here."
            />
          </div>
        </TabPanel>

        {/* Sessions tab */}
        <TabPanel id="sessions">
          <div className="mt-4">
            <EmptyState title="Active sessions coming soon" />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
