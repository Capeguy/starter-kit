'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import { Avatar } from '@opengovsg/oui/avatar'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { Role } from '@acme/db/enums'

import { useTRPC } from '~/trpc/react'
import { formatAuditEvent } from '../../_components/audit-action-labels'
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="prose-h2 text-base-content-strong">
          Welcome, {me.name ?? 'there'}
        </h1>
        <p className="prose-body-2 text-base-content-medium">
          Member since {formatDate(me.createdAt)}.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Profile card */}
        <section className="border-base-divide-medium flex flex-col gap-3 rounded-md border p-4">
          <h2 className="prose-h4 text-base-content-strong">Profile</h2>
          <div className="flex items-center gap-3">
            <Avatar size="md" name={me.name ?? 'You'}>
              {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt="" />}
              <Avatar.Fallback />
            </Avatar>
            <div className="flex flex-col">
              <span className="prose-label-md text-base-content-strong">
                {me.name ?? '(unnamed)'}
              </span>
              <span className="prose-label-xs bg-base-canvas-alt mt-1 w-fit rounded px-2 py-0.5 font-mono">
                {me.role === Role.ADMIN ? 'ADMIN' : 'USER'}
              </span>
            </div>
          </div>
          <FilePickerButton
            label="Change avatar"
            accept="image/png,image/jpeg,image/webp,image/gif"
            isPending={uploadingAvatar}
            onFileSelected={(f) => void handleAvatarUpload(f)}
          />
        </section>

        {/* Files preview */}
        <section className="border-base-divide-medium flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="prose-h4 text-base-content-strong">Recent files</h2>
            <NextLink
              href="/dashboard/files"
              className="prose-label-md text-base-content-brand hover:underline"
            >
              View all →
            </NextLink>
          </div>
          {!filesData || filesData.items.length === 0 ? (
            <Infobox variant="info">
              No files yet.{' '}
              <NextLink
                href="/dashboard/files"
                className="text-base-content-brand underline"
              >
                Upload one.
              </NextLink>
            </Infobox>
          ) : (
            <ul className="prose-body-2 flex flex-col gap-1">
              {filesData.items.map((f) => (
                <li
                  key={f.id}
                  className="border-base-divide-subtle flex items-center justify-between border-b py-1 last:border-b-0"
                >
                  <a
                    href={f.url}
                    download={f.filename}
                    target="_blank"
                    rel="noreferrer"
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
        </section>
      </div>

      {/* Recent activity */}
      <section className="border-base-divide-medium flex flex-col gap-3 rounded-md border p-4">
        <h2 className="prose-h4 text-base-content-strong">Recent activity</h2>
        {!activityData || activityData.items.length === 0 ? (
          <Infobox variant="info">No activity yet.</Infobox>
        ) : (
          <ul className="prose-body-2 flex flex-col gap-1">
            {activityData.items.map((a) => (
              <li
                key={a.id}
                className="border-base-divide-subtle flex items-center justify-between gap-2 border-b py-1 last:border-b-0"
              >
                <span className="text-base-content-default">
                  {formatAuditEvent(
                    { action: a.action, metadata: a.metadata },
                    'self',
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
      </section>

      <p className="prose-caption-2 text-base-content-medium">
        Notifications appear in the bell icon top-right and refresh every 15
        seconds.
      </p>
    </div>
  )
}
