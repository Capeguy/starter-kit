'use client'

import { useSyncExternalStore } from 'react'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Card, CardBody, CardHeader } from '~/components/ui/card'
import { Switch } from '~/components/ui/switch'
import { useTRPC } from '~/trpc/react'

const subscribeNoop = () => () => {
  /* origin is immutable for the session */
}
const useOrigin = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => '',
  )

export const McpSettingsPage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const origin = useOrigin()
  const host = origin || 'https://your-domain'

  const { data } = useSuspenseQuery(trpc.admin.mcp.getSettings.queryOptions())

  const setEnabledMutation = useMutation(
    trpc.admin.mcp.setEnabled.mutationOptions({
      onSuccess: async (res) => {
        toast.success(`MCP server ${res.enabled ? 'enabled' : 'disabled'}`)
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.mcp.getSettings.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const setToolMutation = useMutation(
    trpc.admin.mcp.setToolEnabled.mutationOptions({
      onSuccess: async (res) => {
        toast.success(
          `Tool ${res.name} ${res.enabled ? 'enabled' : 'disabled'}`,
        )
        await queryClient.invalidateQueries({
          queryKey: trpc.admin.mcp.getSettings.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const enabledToolCount = data.tools.filter((t) => t.enabled).length

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold">MCP server</h1>
        <p className="text-muted-foreground text-sm">
          Expose a Model Context Protocol JSON-RPC endpoint at{' '}
          <code>/api/mcp</code> so users can connect their Claude / IDE
          assistants to this app via a personal API token. While disabled, the
          endpoint returns 404 to all callers.
        </p>
      </header>

      <Card>
        <CardHeader title="Server status" />
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-sm font-medium">
                MCP server
              </span>
              <span className="text-muted-foreground text-sm">
                {data.enabled
                  ? `Accepting requests at ${host}/api/mcp.`
                  : 'Disabled — /api/mcp returns 404 to all callers.'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={data.enabled ? 'success' : 'secondary'}>
                {data.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={data.enabled}
                onCheckedChange={(next) =>
                  setEnabledMutation.mutate({ enabled: next })
                }
                aria-label="Enable or disable the MCP server"
              />
            </div>
          </div>

          {!data.enabled && (
            <Alert variant="info">
              <Info />
              <AlertDescription>
                Turn the server on to begin accepting MCP JSON-RPC requests.
                Per-tool toggles below take effect once the server is enabled.
              </AlertDescription>
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Tools"
          actions={
            <span className="text-muted-foreground text-xs">
              {enabledToolCount} of {data.tools.length} enabled
            </span>
          }
        />
        <CardBody>
          <p className="text-muted-foreground mb-4 text-sm">
            Disabled tools are hidden from <code>tools/list</code> and reject{' '}
            <code>tools/call</code> with the same <code>method not found</code>{' '}
            error a non-existent tool would — callers can&apos;t probe which
            tools exist but are turned off.
          </p>
          <ul className="border-border divide-border divide-y rounded-md border">
            {data.tools.map((t) => (
              <li
                key={t.name}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <code className="text-foreground text-sm font-medium">
                    {t.name}
                  </code>
                  <span className="text-muted-foreground text-sm">
                    {t.description}
                  </span>
                </div>
                <Switch
                  checked={t.enabled}
                  disabled={!data.enabled}
                  onCheckedChange={(next) =>
                    setToolMutation.mutate({ name: t.name, enabled: next })
                  }
                  aria-label={`Toggle MCP tool ${t.name}`}
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How to connect" />
        <CardBody className="text-muted-foreground flex flex-col gap-3 text-sm">
          <p>
            Users mint a personal API token in <code>/dashboard/settings</code>,
            then register this server with the Claude CLI:
          </p>
          <pre className="border-border bg-muted/50 overflow-x-auto rounded-md border p-2 font-mono text-xs">
            {`claude mcp add vibe-stack \\
  ${host}/api/mcp \\
  -t http -s user \\
  -H "Authorization: Bearer vibe_pat_…"`}
          </pre>
          <p>Or hit it directly via JSON-RPC:</p>
          <pre className="border-border bg-muted/50 overflow-x-auto rounded-md border p-2 font-mono text-xs">
            {`curl -H "Authorization: Bearer vibe_pat_…" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \\
  ${host}/api/mcp`}
          </pre>
        </CardBody>
      </Card>
    </div>
  )
}
