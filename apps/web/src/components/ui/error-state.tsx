import { Button } from '@opengovsg/oui/button'
import { BiErrorCircle } from 'react-icons/bi'

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
      <BiErrorCircle className="text-utility-feedback-critical h-8 w-8" />
      <p className="prose-h4 text-base-content-strong">{title}</p>
      {message !== undefined && (
        <details className="text-left">
          <summary className="prose-body-2 text-utility-feedback-critical cursor-pointer">
            {message}
          </summary>
          {stack !== undefined && (
            <pre className="prose-caption-2 text-base-content-medium mt-2 overflow-auto whitespace-pre-wrap">
              {stack}
            </pre>
          )}
        </details>
      )}
      {onRetry !== undefined && (
        <Button variant="outline" size="sm" onPress={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
