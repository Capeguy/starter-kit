'use client'

import { useState, useSyncExternalStore } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { TextField } from '@acme/ui/text-field'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
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
        <p className="text-muted-foreground text-sm">
          Personal API tokens authenticate calls to the REST API (
          <code>/api/v1/*</code>) and the MCP server (<code>/api/mcp</code>).
          Tokens are scoped to your account and inherit your role&apos;s
          capabilities.
        </p>
        <Button onClick={() => setIsCreating(true)}>New token</Button>
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
                    <DataTableCell className="text-foreground font-medium">
                      {token.name}
                    </DataTableCell>
                    <DataTableCell>
                      <code className="text-xs">{token.prefix}…</code>
                    </DataTableCell>
                    <DataTableCell>
                      <RelativeTime date={token.createdAt} />
                    </DataTableCell>
                    <DataTableCell>
                      {token.lastUsedAt ? (
                        <RelativeTime date={token.lastUsedAt} />
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>{formatDate(token.expiresAt)}</DataTableCell>
                    <DataTableCell>
                      {status === 'active' ? (
                        <Badge variant="success">Active</Badge>
                      ) : status === 'expired' ? (
                        <Badge variant="warning">Expired</Badge>
                      ) : (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      {!revoked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={
                            revokeMutation.isPending &&
                            revokeMutation.variables.id === token.id
                          }
                          onClick={() =>
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {issued ? 'Token created' : 'New personal API token'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!issued ? (
            <>
              <p className="text-muted-foreground text-sm">
                Tokens carry your account&apos;s capabilities. Treat them like
                passwords.
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
                <legend className="mb-1 text-sm font-medium">Expires in</legend>
                {EXPIRY_PRESETS.map((preset) => (
                  <label key={preset.label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="expiresInDays"
                      checked={expiresInDays === preset.value}
                      onChange={() => setExpiresInDays(preset.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{preset.label}</span>
                  </label>
                ))}
              </fieldset>
            </>
          ) : (
            <>
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>
                  This is the only time you&apos;ll see this token. Copy it now
                  — once this dialog closes, only the prefix
                  <code className="mx-1">{issued.prefix}…</code>
                  will be visible in the tokens list.
                </AlertDescription>
              </Alert>
              <textarea
                readOnly
                value={issued.plaintext}
                rows={2}
                className="border-border bg-muted/50 w-full rounded-md border p-2 font-mono text-sm"
                onClick={(e) => e.currentTarget.select()}
                aria-label="Personal API token plaintext"
              />
              {issued.expiresAt && (
                <p className="text-muted-foreground text-xs">
                  Expires {formatDate(issued.expiresAt)}.
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {issued ? 'Done' : 'Cancel'}
          </Button>
          {!issued ? (
            <Button onClick={handleSubmit} disabled={issueMutation.isPending}>
              Create token
            </Button>
          ) : (
            <Button onClick={handleCopy}>Copy token</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      className="border-border rounded-md border p-3"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="text-foreground cursor-pointer text-sm font-medium">
        How to use these tokens
      </summary>
      <div className="text-muted-foreground mt-3 flex flex-col gap-3 text-sm">
        <p>
          Send your token in the <code>Authorization</code> header as a Bearer
          credential. Same-origin scope: requests must originate from this
          domain (curl from your machine works fine; browser-based cross-origin
          requests will be blocked).
        </p>
        <div>
          <p className="mb-1 text-xs font-medium">REST: GET /api/v1/me</p>
          <pre className="border-border bg-muted/50 overflow-x-auto rounded-md border p-2 font-mono text-xs">
            {`curl -H "Authorization: Bearer vibe_pat_…" \\
  ${host}/api/v1/me`}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">MCP: tools/list (JSON-RPC)</p>
          <pre className="border-border bg-muted/50 overflow-x-auto rounded-md border p-2 font-mono text-xs">
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
