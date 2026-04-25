import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@opengovsg/oui-theme'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  className?: string
}

export const Card = ({ className, ...rest }: CardProps) => (
  <section
    className={cn(
      'border-base-divider-medium bg-base-canvas-default rounded-md border',
      className,
    )}
    {...rest}
  />
)

export interface CardHeaderProps extends HTMLAttributes<HTMLElement> {
  title?: string
  actions?: ReactNode
  className?: string
}

export const CardHeader = ({
  title,
  actions,
  children,
  className,
  ...rest
}: CardHeaderProps) => (
  <header
    className={cn(
      'border-base-divider-subtle flex items-center justify-between gap-3 border-b px-4 py-3',
      className,
    )}
    {...rest}
  >
    {title !== undefined || actions !== undefined ? (
      <>
        {title !== undefined && (
          <h2 className="prose-h4 text-base-content-strong">{title}</h2>
        )}
        {actions}
      </>
    ) : (
      children
    )}
  </header>
)

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const CardBody = ({ className, ...rest }: CardBodyProps) => (
  <div className={cn('px-4 py-4', className)} {...rest} />
)

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const CardFooter = ({ className, ...rest }: CardFooterProps) => (
  <div
    className={cn('border-base-divider-subtle border-t px-4 py-3', className)}
    {...rest}
  />
)
