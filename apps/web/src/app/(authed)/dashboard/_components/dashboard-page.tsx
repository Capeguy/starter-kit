'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { LinkButton } from '@acme/ui/link-button'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { EmptyState } from '~/components/ui/empty-state'
import { useTRPC } from '~/trpc/react'
import { formatAuditEvent } from '../../_components/audit-action-labels'
import { ErrorBomb } from '../../_components/error-bomb'
import { FilePickerButton } from '../../_components/file-picker-button'
import { RelativeTime } from '../../_components/relative-time'

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)

const initials = (name: string | null | undefined): string => {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

export const DashboardPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: me } = useSuspenseQuery(trpc.me.get.queryOptions())
  const { data: filesData } = useQuery(
    trpc.file.listMine.queryOptions({ limit: 5 }),
  )
  const { data: activityData } = useQuery(
    trpc.audit.listMine.queryOptions({ limit: 5 }),
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
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold">
          Welcome, {me.name ?? 'there'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Member since {formatDate(me.createdAt)}.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {me.avatarUrl && (
                  <AvatarImage src={me.avatarUrl} alt={me.name ?? 'You'} />
                )}
                <AvatarFallback>{initials(me.name ?? 'You')}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  {me.name ?? '(unnamed)'}
                </span>
                <Badge variant="info" className="mt-1 w-fit">
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

        <Card>
          <CardHeader title="Summary" />
          <CardBody className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Files uploaded
              </span>
              <span className="text-foreground text-sm font-medium">
                {fileCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Role</span>
              <span className="text-foreground text-sm font-medium">
                {me.role.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Member since
              </span>
              <span className="text-foreground text-sm font-medium">
                {formatDate(me.createdAt)}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent files"
            actions={
              <NextLink
                href="/dashboard/files"
                className="text-primary text-sm font-medium hover:underline"
              >
                See all →
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
              <ul className="flex flex-col gap-1 text-sm">
                {filesData.items.map((f) => (
                  <li
                    key={f.id}
                    className="border-border flex items-center justify-between border-b py-1 last:border-b-0"
                  >
                    <a
                      href={`/api/files/${f.id}/download`}
                      className="text-primary truncate hover:underline"
                    >
                      {f.filename}
                    </a>
                    <RelativeTime
                      date={f.createdAt}
                      className="text-muted-foreground ml-2 shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            actions={
              <NextLink
                href="/dashboard/activity"
                className="text-primary text-sm font-medium hover:underline"
              >
                See all →
              </NextLink>
            }
          />
          <CardBody>
            {!activityData || activityData.items.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Your recent actions will appear here."
              />
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {activityData.items.map((a) => (
                  <li
                    key={a.id}
                    className="border-border flex items-center justify-between gap-2 border-b py-1 last:border-b-0"
                  >
                    <span className="text-foreground">
                      {formatAuditEvent(
                        { action: a.action, metadata: a.metadata },
                        'self',
                        activityData.relatedUsers,
                      )}
                    </span>
                    <RelativeTime
                      date={a.createdAt}
                      className="text-muted-foreground shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
