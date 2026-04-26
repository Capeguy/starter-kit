'use client'

import { useState } from 'react'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { toast } from '@opengovsg/oui/toast'
import { Toggle } from '@opengovsg/oui/toggle'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from '~/components/ui/data-table'
import { useTRPC } from '~/trpc/react'
import { FeatureFlagEditor } from './feature-flag-editor'

interface FeatureFlagSummary {
  key: string
  name: string
  description: string | null
  enabled: boolean
  rolloutPercent: number
  allowedUserIds: string[]
  createdAt: Date
  updatedAt: Date
}

export const FeatureFlagsPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<FeatureFlagSummary | 'new' | null>(
    null,
  )

  const { data } = useSuspenseQuery(trpc.admin.featureFlags.list.queryOptions())

  const upsertMutation = useMutation(
    trpc.admin.featureFlags.upsert.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.featureFlags.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const deleteMutation = useMutation(
    trpc.admin.featureFlags.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('Flag deleted')
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.featureFlags.list.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  // Inline toggle from the row — mutates only `enabled`, preserving the
  // existing rolloutPercent and allowedUserIds. Mirrors the editor's input
  // shape so the same audit row gets recorded.
  const handleInlineToggle = (flag: FeatureFlagSummary, next: boolean) => {
    upsertMutation.mutate(
      {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: next,
        rolloutPercent: flag.rolloutPercent,
        allowedUserIds: flag.allowedUserIds,
      },
      {
        onSuccess: () => {
          toast.success(`${flag.name} is now ${next ? 'on' : 'off'}`)
        },
      },
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RegistryBreadcrumbs />
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="prose-h2 text-base-content-strong">Feature flags</h1>
          <p className="prose-body-2 text-base-content-medium">
            Toggle features on or off, roll them out to a percentage of users,
            or always-on for a specific allowlist. Evaluation is per-user via a
            stable SHA-256 bucket — the same user always lands in the same
            bucket for a given flag.
          </p>
        </div>
        <Button className="shrink-0" onPress={() => setEditing('new')}>
          New flag
        </Button>
      </header>

      {data.items.length === 0 ? (
        <Infobox variant="info">
          No feature flags yet. Create one with the &ldquo;New flag&rdquo;
          button.
        </Infobox>
      ) : (
        <DataTable>
          <DataTableRoot>
            <DataTableHeader>
              <tr>
                <DataTableHead>Key</DataTableHead>
                <DataTableHead>Name</DataTableHead>
                <DataTableHead>Enabled</DataTableHead>
                <DataTableHead>Rollout %</DataTableHead>
                <DataTableHead>Allowed users</DataTableHead>
                <DataTableHead className="text-right">Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {data.items.map((f) => (
                <DataTableRow key={f.key}>
                  <DataTableCell>
                    <code className="prose-body-2">{f.key}</code>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span className="prose-label-md">{f.name}</span>
                      {f.description && (
                        <span className="prose-caption-2 text-base-content-medium">
                          {f.description}
                        </span>
                      )}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <Toggle
                      isSelected={f.enabled}
                      onChange={(next) => handleInlineToggle(f, next)}
                      aria-label={`Toggle ${f.name}`}
                    />
                  </DataTableCell>
                  <DataTableCell>{f.rolloutPercent}%</DataTableCell>
                  <DataTableCell>
                    {f.allowedUserIds.length === 0
                      ? '—'
                      : `${f.allowedUserIds.length} user${
                          f.allowedUserIds.length === 1 ? '' : 's'
                        }`}
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => setEditing(f)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          if (
                            confirm(
                              `Delete flag "${f.key}"? This cannot be undone.`,
                            )
                          ) {
                            deleteMutation.mutate({ key: f.key })
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableRoot>
        </DataTable>
      )}

      {editing && (
        <FeatureFlagEditor
          flag={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: trpc.admin.featureFlags.list.queryKey(),
            })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
