'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Info, OctagonX } from 'lucide-react'

import { Alert, AlertDescription } from '~/components/ui/alert'
import { cn } from '~/lib/utils'
import { useTRPC } from '~/trpc/react'

/**
 * App-wide system message banner. Reads from the `systemMessage.get`
 * tRPC procedure (singleton row). Renders nothing when the row is missing,
 * `enabled === false`, or the message is empty — so the chrome stays clean
 * by default and admins opt in via `/admin/system-message`.
 *
 * Placement: this is the first child of `SidebarInset` in the (authed)
 * layout, so it sits above `SiteHeader`. Keep the file path + named
 * export stable — the layout import is load-bearing.
 *
 * Visual treatment matches the inline preview on the admin editor.
 */
export function EnvBanner() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.systemMessage.get.queryOptions())

  if (!data?.enabled) return null
  const message = data.message.trim()
  if (!message) return null

  const severity = data.severity
  const Icon =
    severity === 'CRITICAL'
      ? OctagonX
      : severity === 'WARNING'
        ? AlertTriangle
        : Info

  // Severity → border + bg + text. Keep these classes in sync with
  // SystemMessagePreview in the admin editor — the editor's preview
  // promises an exact-render of what users see here.
  const variantClass =
    severity === 'CRITICAL'
      ? 'border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive'
      : severity === 'WARNING'
        ? 'border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300'
        : 'border-sky-500/40 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-300'

  return (
    <Alert
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-none border-0 border-b px-4 py-2 [&>svg]:top-2.5',
        variantClass,
      )}
    >
      <Icon className="h-4 w-4" />
      <AlertDescription className="whitespace-pre-wrap">
        {message}
      </AlertDescription>
    </Alert>
  )
}
