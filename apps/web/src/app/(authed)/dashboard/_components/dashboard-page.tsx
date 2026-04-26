'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import { Avatar } from '@opengovsg/oui/avatar'
import { Badge } from '@opengovsg/oui/badge'
import { Tab, TabList, TabPanel, Tabs } from '@opengovsg/oui/tabs'
import { toast } from '@opengovsg/oui/toast'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { LinkButton } from '@acme/ui/link-button'

import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { EmptyState } from '~/components/ui/empty-state'
import { useTRPC } from '~/trpc/react'
import { formatAuditEvent } from '../../_components/audit-action-labels'
import { ErrorBomb } from '../../_components/error-bomb'
import { FilePickerButton } from '../../_components/file-picker-button'
import { RelativeTime } from '../../_components/relative-time'

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)

export const DashboardPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: me } = useSuspenseQuery(trpc.me.get.queryOptions())
  const { data: filesData } = useQuery(
    trpc.file.listMine.queryOptions({ limit: 5 }),
  )
  const { data: activityData } = useQuery(
    trpc.audit.listMine.queryOptions({ limit: 8 }),
  )

  if (!me) return null

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      toast.success('Avatar updated')
      await queryClient.invalidateQueries({
        queryKey: trpc.me.get.queryKey(),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const fileCount = filesData?.items.length ?? 0

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/*
       * Test-only escape hatch — throws on `?_throw=1` so e2e can verify the
       * authed ErrorBoundary fallback renders. No-ops otherwise; gated to
       * non-prod inside ErrorBomb itself.
       */}
      <ErrorBomb />
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">
          Welcome, {me.name ?? 'there'}
        </h1>
        <p className="prose-body-2 text-base-content-medium">
          Member since {formatDate(me.createdAt)}.
        </p>
      </header>

      <Tabs>
        <TabList
          aria-label="Dashboard sections"
          className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Tab id="overview">Overview</Tab>
          <Tab id="files">Files</Tab>
          <Tab id="activity">Activity</Tab>
          <Tab id="settings">Settings</Tab>
        </TabList>

        {/* Overview tab */}
        <TabPanel id="overview">
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Profile card */}
            <Card>
              <CardHeader title="Profile" />
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar size="md" name={me.name ?? 'You'}>
                    {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt="" />}
                    <Avatar.Fallback />
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="prose-label-md text-base-content-strong">
                      {me.name ?? '(unnamed)'}
                    </span>
                    <Badge
                      variant="subtle"
                      color="main"
                      size="sm"
                      className="mt-1 w-fit"
                    >
                      {me.role.name}
                    </Badge>
                  </div>
                </div>
                <FilePickerButton
                  label="Change avatar"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  isPending={uploadingAvatar}
                  onFileSelected={(f) => void handleAvatarUpload(f)}
                />
              </CardBody>
            </Card>

            {/* Summary stats card */}
            <Card>
              <CardHeader title="Summary" />
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="prose-body-2 text-base-content-medium">
                    Files uploaded
                  </span>
                  <span className="prose-label-md text-base-content-strong">
                    {fileCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="prose-body-2 text-base-content-medium">
                    Role
                  </span>
                  <span className="prose-label-md text-base-content-strong">
                    {me.role.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="prose-body-2 text-base-content-medium">
                    Member since
                  </span>
                  <span className="prose-label-md text-base-content-strong">
                    {formatDate(me.createdAt)}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>

          <p className="prose-caption-2 text-base-content-medium mt-4">
            Notifications appear in the bell icon top-right and refresh every 15
            seconds.
          </p>
        </TabPanel>

        {/* Files tab */}
        <TabPanel id="files">
          <div className="mt-4">
            <Card>
              <CardHeader
                title="Recent files"
                actions={
                  <NextLink
                    href="/dashboard/files"
                    className="prose-label-md text-base-content-brand hover:underline"
                  >
                    See all in Files →
                  </NextLink>
                }
              />
              <CardBody>
                {!filesData || filesData.items.length === 0 ? (
                  <EmptyState
                    title="No files yet"
                    description="Upload a file to get started."
                    action={
                      <LinkButton
                        href="/dashboard/files"
                        variant="outline"
                        size="sm"
                      >
                        Go to Files
                      </LinkButton>
                    }
                  />
                ) : (
                  <ul className="prose-body-2 flex flex-col gap-1">
                    {filesData.items.map((f) => (
                      <li
                        key={f.id}
                        className="border-base-divider-subtle flex items-center justify-between border-b py-1 last:border-b-0"
                      >
                        <a
                          href={`/api/files/${f.id}/download`}
                          className="text-base-content-brand truncate hover:underline"
                        >
                          {f.filename}
                        </a>
                        <RelativeTime
                          date={f.createdAt}
                          className="text-base-content-medium ml-2 shrink-0"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        {/* Activity tab */}
        <TabPanel id="activity">
          <div className="mt-4">
            <Card>
              <CardHeader title="Recent activity" />
              <CardBody>
                {!activityData || activityData.items.length === 0 ? (
                  <EmptyState
                    title="No activity yet"
                    description="Your recent actions will appear here."
                  />
                ) : (
                  <ul className="prose-body-2 flex flex-col gap-1">
                    {activityData.items.map((a) => (
                      <li
                        key={a.id}
                        className="border-base-divider-subtle flex items-center justify-between gap-2 border-b py-1 last:border-b-0"
                      >
                        <span className="text-base-content-default">
                          {formatAuditEvent(
                            { action: a.action, metadata: a.metadata },
                            'self',
                            activityData.relatedUsers,
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
        </TabPanel>

        {/* Settings tab */}
        <TabPanel id="settings">
          <div className="mt-4">
            <EmptyState
              title="Settings coming soon"
              description="Account settings will live here."
            />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}
