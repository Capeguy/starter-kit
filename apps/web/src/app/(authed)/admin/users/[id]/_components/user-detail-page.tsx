'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { EmptyState } from '~/components/ui/empty-state'
import { PageHeader } from '~/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useTRPC } from '~/trpc/react'

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

const initials = (name: string | null | undefined): string =>
  name ? name.slice(0, 2).toUpperCase() : '?'

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
      <RegistryBreadcrumbs trailing={user.name ?? '(unnamed)'} />

      <PageHeader
        title={user.name ?? '(unnamed)'}
        description={[user.email, user.role.name].filter(Boolean).join(' · ')}
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile">
          <div className="mt-4">
            <Card>
              <CardHeader title="Profile" />
              <CardBody className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    {user.avatarUrl && (
                      <AvatarImage
                        src={user.avatarUrl}
                        alt={user.name ?? 'User'}
                      />
                    )}
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground text-sm font-medium">
                      {user.name ?? '(unnamed)'}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {user.email ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="border-border grid grid-cols-2 gap-x-8 gap-y-3 border-t pt-4">
                  <div>
                    <p className="text-muted-foreground mb-0.5 text-xs">Role</p>
                    <p className="text-foreground text-sm font-medium">
                      {user.role.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5 text-xs">
                      Capabilities
                    </p>
                    <p className="text-foreground text-sm font-medium">
                      {user.role.capabilities.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5 text-xs">
                      Member since
                    </p>
                    <p className="text-foreground text-sm font-medium">
                      {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5 text-xs">
                      Last login
                    </p>
                    <p className="text-foreground text-sm font-medium">
                      {user.lastLogin ? formatDateTime(user.lastLogin) : '—'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* Audit tab */}
        <TabsContent value="audit">
          <div className="mt-4">
            <EmptyState
              title="Audit history coming soon"
              description="Per-user audit log will live here."
            />
          </div>
        </TabsContent>

        {/* Sessions tab */}
        <TabsContent value="sessions">
          <div className="mt-4">
            <EmptyState title="Active sessions coming soon" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
