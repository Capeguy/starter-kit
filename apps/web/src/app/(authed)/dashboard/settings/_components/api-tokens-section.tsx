'use client'

import { useState, useSyncExternalStore } from 'react'
import { Badge } from '@opengovsg/oui/badge'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@opengovsg/oui/modal'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import { TextField } from '@acme/ui/text-field'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from '~/components/ui/data-table'
import { useTRPC } from '~/trpc/react'
import { RelativeTime } from '../../../_components/relative-time'

type ExpiryPreset = 7 | 30 | 90 | null

const EXPIRY_PRESETS: { label: string; value: ExpiryPreset }[] = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'Never', value: null },
]

const formatDate = (date: Date | null): string =>
  date
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : 'Never'

const isExpired = (expiresAt: Date | null): boolean =>
  expiresAt !== null && expiresAt.getTime() <= Date.now()

export const ApiTokensSection = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: tokens } = useSuspenseQuery(
    trpc.apiToken.listMine.queryOptions(),
  )
  const [isCreating, setIsCreating] = useState(false)

  const revokeMutation = useMutation(
    trpc.apiToken.revoke.mutationOptions({
      onSuccess: async () => {
        toast.success('Token revoked')
        await queryClient.invalidateQueries({
          queryKey: trpc.apiToken.listMine.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="prose-body-2 text-base-content-medium">
          Personal API tokens authenticate calls to the REST API (
          <code>/api/v1/*</code>) and the MCP server (<code>/api/mcp</code>).
          Tokens are scoped to your account and inherit your role&apos;s
          capabilities.
        </p>
        <Button onPress={() => setIsCreating(true)}>New token</Button>
      </div>

      <DataTable>
        <DataTableRoot>
          <DataTableHeader>
            <tr>
              <DataTableHead>Name</DataTableHead>
              <DataTableHead>Prefix</DataTableHead>
              <DataTableHead>Created</DataTableHead>
              <DataTableHead>Last used</DataTableHead>
              <DataTableHead>Expires</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead className="text-right">Actions</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {tokens.length === 0 ? (
              <DataTableEmpty colSpan={7}>
                No tokens yet. Create one to call the REST API or MCP server.
              </DataTableEmpty>
            ) : (
              tokens.map((token) => {
                const expired = isExpired(token.expiresAt)
                const revoked = token.revokedAt !== null
                const status: 'active' | 'expired' | 'revoked' = revoked
                  ? 'revoked'
                  : expired
                    ? 'expired'
                    : 'active'
                return (
                  <DataTableRow key={token.id}>
                    <DataTableCell className="prose-label-md text-base-content-strong">
                      {token.name}
                    </DataTableCell>
                    <DataTableCell>
                      <code className="prose-caption-2">{token.prefix}…</code>
                    </DataTableCell>
                    <DataTableCell>
                      <RelativeTime date={token.createdAt} />
                    </DataTableCell>
                    <DataTableCell>
                      {token.lastUsedAt ? (
                        <RelativeTime date={token.lastUsedAt} />
                      ) : (
                        <span className="text-base-content-medium">Never</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>{formatDate(token.expiresAt)}</DataTableCell>
                    <DataTableCell>
                      {status === 'active' ? (
                        <Badge color="success" variant="subtle" size="sm">
                          Active
                        </Badge>
                      ) : status === 'expired' ? (
                        <Badge color="warning" variant="subtle" size="sm">
                          Expired
                        </Badge>
                      ) : (
                        <Badge color="critical" variant="subtle" size="sm">
                          Revoked
                        </Badge>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      {!revoked && (
                        <Button
                          size="sm"
                          variant="clear"
                          color="critical"
                          isPending={
                            revokeMutation.isPending &&
                            revokeMutation.variables.id === token.id
                          }
                          onPress={() =>
                            revokeMutation.mutate({ id: token.id })
                          }
                        >
                          Revoke
                        </Button>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                )
              })
            )}
          </DataTableBody>
        </DataTableRoot>
      </DataTable>

      <HowToUseHelp />

      {isCreating && <NewTokenModal onClose={() => setIsCreating(false)} />}
    </div>
  )
}

interface IssuedToken {
  plaintext: string
  prefix: string
  expiresAt: Date | null
}

interface NewTokenModalProps {
  onClose: () => void
}

const NewTokenModal = ({ onClose }: NewTokenModalProps) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<ExpiryPreset>(30)
  const [issued, setIssued] = useState<IssuedToken | null>(null)

  const issueMutation = useMutation(
    trpc.apiToken.issue.mutationOptions({
      onSuccess: async (result) => {
        setIssued({
          plaintext: result.plaintext,
          prefix: result.prefix,
          expiresAt: result.expiresAt,
        })
        await queryClient.invalidateQueries({
          queryKey: trpc.apiToken.listMine.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    issueMutation.mutate({ name: name.trim(), expiresInDays })
  }

  const handleCopy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.plaintext)
      toast.success('Token copied to clipboard')
    } catch {
      toast.error('Could not copy. Select the token text manually.')
    }
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader>
              {issued ? 'Token created' : 'New personal API token'}
            </ModalHeader>
            <div className="flex flex-col gap-4 px-6 pb-2">
              {!issued ? (
                <>
                  <p className="prose-body-2 text-base-content-medium">
                    Tokens carry your account&apos;s capabilities. Treat them
                    like passwords.
                  </p>
                  <TextField
                    label="Name"
                    inputProps={{
                      placeholder: 'CLI on laptop',
                      name: 'name',
                      maxLength: 120,
                    }}
                    value={name}
                    onChange={setName}
                    isRequired
                  />
                  <fieldset className="flex flex-col gap-2">
                    <legend className="prose-label-md mb-1">Expires in</legend>
                    {EXPIRY_PRESETS.map((preset) => (
                      <label
                        key={preset.label}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="radio"
                          name="expiresInDays"
                          checked={expiresInDays === preset.value}
                          onChange={() => setExpiresInDays(preset.value)}
                          className="accent-interaction-main-default dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        <span className="prose-body-2">{preset.label}</span>
                      </label>
                    ))}
                  </fieldset>
                </>
              ) : (
                <>
                  <Infobox variant="warning">
                    This is the only time you&apos;ll see this token. Copy it
                    now — once this dialog closes, only the prefix
                    <code className="mx-1">{issued.prefix}…</code>
                    will be visible in the tokens list.
                  </Infobox>
                  <textarea
                    readOnly
                    value={issued.plaintext}
                    rows={2}
                    className="border-base-divider-medium prose-body-2 w-full rounded-md border p-2 font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    onClick={(e) => e.currentTarget.select()}
                    aria-label="Personal API token plaintext"
                  />
                  {issued.expiresAt && (
                    <p className="prose-caption-2 text-base-content-medium">
                      Expires {formatDate(issued.expiresAt)}.
                    </p>
                  )}
                </>
              )}
            </div>
            <ModalFooter>
              <Button variant="clear" onPress={onClose}>
                {issued ? 'Done' : 'Cancel'}
              </Button>
              {!issued ? (
                <Button
                  onPress={handleSubmit}
                  isPending={issueMutation.isPending}
                >
                  Create token
                </Button>
              ) : (
                <Button onPress={handleCopy}>Copy token</Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

// useSyncExternalStore lets us read window.location.origin client-side
// without triggering a setState-in-effect (eslint rejects that pattern) and
// without an SSR/CSR hydration mismatch on the initial render.
// origin never changes mid-session, so subscribe is a no-op unsubscribe.
const subscribeNoop = () => () => {
  /* no-op: window.location.origin is immutable for the session */
}
const useOrigin = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  )

const HowToUseHelp = () => {
  const [open, setOpen] = useState(false)
  const origin = useOrigin()
  const host = origin || 'https://your-domain'
  return (
    <details
      className="border-base-divider-subtle rounded-md border p-3"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="prose-label-md text-base-content-strong cursor-pointer">
        How to use these tokens
      </summary>
      <div className="prose-body-2 text-base-content-medium mt-3 flex flex-col gap-3">
        <p>
          Send your token in the <code>Authorization</code> header as a Bearer
          credential. Same-origin scope: requests must originate from this
          domain (curl from your machine works fine; browser-based cross-origin
          requests will be blocked).
        </p>
        <div>
          <p className="prose-label-sm mb-1">REST: GET /api/v1/me</p>
          <pre className="prose-caption-2 border-base-divider-subtle overflow-x-auto rounded-md border p-2 font-mono dark:border-zinc-600 dark:bg-zinc-800">
            {`curl -H "Authorization: Bearer vibe_pat_…" \\
  ${host}/api/v1/me`}
          </pre>
        </div>
        <div>
          <p className="prose-label-sm mb-1">MCP: tools/list (JSON-RPC)</p>
          <pre className="prose-caption-2 border-base-divider-subtle overflow-x-auto rounded-md border p-2 font-mono dark:border-zinc-600 dark:bg-zinc-800">
            {`curl -H "Authorization: Bearer vibe_pat_…" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \\
  ${host}/api/mcp`}
          </pre>
        </div>
      </div>
    </details>
  )
}
