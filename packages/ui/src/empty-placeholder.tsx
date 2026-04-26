import type { ReactNode } from 'react'

import { EmptyResultsSvg } from './svgs/empty-results-svg'
import { cn } from './utils'

export interface EmptyPlaceholderProps {
  svg?: ReactNode
  title?: string
  description?: string
  size?: 'sm' | 'lg'
  children?: ReactNode
  className?: string
}

export const EmptyPlaceholder = ({
  svg = <EmptyResultsSvg />,
  title,
  description,
  size = 'sm',
  children,
  className,
}: EmptyPlaceholderProps) => {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 py-12',
        className,
      )}
    >
      <p
        className={cn(
          'text-foreground font-semibold',
          size === 'sm' ? 'text-base' : 'text-lg',
        )}
      >
        {title ?? 'No Records'}
      </p>
      {description && (
        <p
          className={cn(
            'text-muted-foreground',
            size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          {description}
        </p>
      )}
      {svg}
      {children}
    </div>
  )
}
