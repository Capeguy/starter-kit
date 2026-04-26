import { AlertTriangle } from 'lucide-react'

import { env } from '~/env'

export function EnvBanner() {
  if (env.NEXT_PUBLIC_APP_ENV === 'production') {
    return null
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>This is a {env.NEXT_PUBLIC_APP_ENV} testing environment.</span>
    </div>
  )
}
