'use client'

import { useState } from 'react'
import { toast } from '@opengovsg/oui/toast'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { AlertTriangle, Info, OctagonX } from 'lucide-react'

import { RegistryBreadcrumbs } from '~/components/registry-breadcrumbs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/_card-primitives'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { Textarea } from '~/components/ui/textarea'
import { useTRPC } from '~/trpc/react'

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const
type Severity = (typeof SEVERITIES)[number]

const MESSAGE_MAX_LENGTH = 500

const SEVERITY_LABEL: Record<Severity, string> = {
  INFO: 'Info',
  WARNING: 'Warning',
  CRITICAL: 'Critical',
}

const SEVERITY_HINT: Record<Severity, string> = {
  INFO: 'Neutral, informational message — e.g. an upcoming feature or schedule.',
  WARNING:
    'Heads-up about something users should be aware of — e.g. a planned outage.',
  CRITICAL:
    'Urgent issue — e.g. an active incident or required immediate action.',
}

export const SystemMessagePage = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data } = useSuspenseQuery(trpc.systemMessage.get.queryOptions())

  // Local form state initialised from the server snapshot. The form is
  // dirty-checked against `data` rather than tracking a separate `pristine`
  // flag — keeps the save button accurate without a useEffect loop.
  const [enabled, setEnabled] = useState(data.enabled)
  const [severity, setSeverity] = useState<Severity>(data.severity as Severity)
  const [message, setMessage] = useState(data.message)

  const isDirty =
    enabled !== data.enabled ||
    severity !== data.severity ||
    message !== data.message

  const updateMutation = useMutation(
    trpc.admin.systemMessage.update.mutationOptions({
      onSuccess: async () => {
        toast.success('System message saved')
        // Invalidate so the chrome banner picks up the change without a
        // page reload. The page itself re-syncs its local state via the
        // suspense query rerunning.
        await queryClient.invalidateQueries({
          queryKey: trpc.systemMessage.get.queryKey(),
        })
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  const handleSave = () => {
    updateMutation.mutate({ enabled, severity, message })
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RegistryBreadcrumbs />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          System message
        </h1>
        <p className="text-muted-foreground text-sm">
          App-wide banner shown at the top of every signed-in page. Use it for
          maintenance windows, incident updates, or roll-out announcements.
          Toggle off to hide it; saved changes appear instantly without a
          reload.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Banner content</CardTitle>
          <CardDescription>
            Edit the text, severity, and visibility. The preview below shows
            exactly what users will see while the banner is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Show banner</span>
              <span className="text-muted-foreground text-sm">
                When off, the banner is hidden from every authed page.
              </span>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Show or hide the system message banner"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="system-message-severity"
              className="text-sm font-medium"
            >
              Severity
            </label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as Severity)}
            >
              <SelectTrigger id="system-message-severity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">
              {SEVERITY_HINT[severity]}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="system-message-text"
              className="text-sm font-medium"
            >
              Message
            </label>
            <Textarea
              id="system-message-text"
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))
              }
              placeholder="e.g. We will be performing scheduled maintenance on Saturday at 02:00 UTC."
              rows={4}
              maxLength={MESSAGE_MAX_LENGTH}
            />
            <span className="text-muted-foreground self-end text-xs">
              {message.length} / {MESSAGE_MAX_LENGTH}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
          <CardDescription>
            Renders the banner exactly as it will appear at the top of the
            authed app. Hidden when the banner is disabled or the message is
            blank.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enabled && message.trim().length > 0 ? (
            <SystemMessagePreview severity={severity} message={message} />
          ) : (
            <p className="text-muted-foreground text-sm italic">
              {enabled
                ? 'Add a message to preview the banner.'
                : 'Banner is disabled — turn it on above to preview.'}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          variant="default"
          disabled={!isDirty || updateMutation.isPending}
          onClick={handleSave}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Inline preview banner — same visual treatment as the chrome `EnvBanner`,
 * kept inline so this page renders without depending on the chrome
 * component (which has different layout assumptions: full-width sticky etc).
 */
const SystemMessagePreview = ({
  severity,
  message,
}: {
  severity: Severity
  message: string
}) => {
  const Icon =
    severity === 'CRITICAL'
      ? OctagonX
      : severity === 'WARNING'
        ? AlertTriangle
        : Info

  // Keep these classes in sync with `apps/web/src/app/_components/env-banner.tsx`
  // — the preview's job is to be exact, not pretty-on-its-own.
  const variantClass =
    severity === 'CRITICAL'
      ? 'border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive'
      : severity === 'WARNING'
        ? 'border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300'
        : 'border-sky-500/40 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-300'

  return (
    <Alert className={variantClass}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="sr-only">
        {SEVERITY_LABEL[severity]} message
      </AlertTitle>
      <AlertDescription className="whitespace-pre-wrap">
        {message}
      </AlertDescription>
    </Alert>
  )
}
