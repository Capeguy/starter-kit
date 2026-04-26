import { AlertCircle } from 'lucide-react'

import { Button } from '~/components/ui/button'

export interface ErrorStateProps {
  title?: string
  error?: Error | string
  onRetry?: () => void
}

export const ErrorState = ({
  title = 'Something went wrong',
  error,
  onRetry,
}: ErrorStateProps) => {
  const message = error instanceof Error ? error.message : (error ?? undefined)
  const stack = error instanceof Error ? error.stack : undefined

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertCircle className="text-destructive h-8 w-8" />
      <p className="text-foreground text-base font-semibold">{title}</p>
      {message !== undefined && (
        <details className="text-left">
          <summary className="text-destructive cursor-pointer text-sm">
            {message}
          </summary>
          {stack !== undefined && (
            <pre className="text-muted-foreground mt-2 overflow-auto text-xs whitespace-pre-wrap">
              {stack}
            </pre>
          )}
        </details>
      )}
      {onRetry !== undefined && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
