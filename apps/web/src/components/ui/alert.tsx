import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '~/lib/utils'

/**
 * Grid layout (icon column + content column) with `items-center` so the icon
 * stays vertically centered with the text block — including when the message
 * wraps to multiple lines on narrow viewports. Replaces the older
 * absolute-positioned svg pattern from shadcn's first-gen Alert, which pinned
 * the icon to the top-left of the box and produced a visible misalignment
 * once content wrapped past one line.
 */
const alertVariants = cva(
  cn(
    'relative grid w-full grid-cols-[0_1fr] items-center gap-y-0.5 rounded-lg border p-4 text-sm',
    'has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3',
    '[&>svg]:size-4 [&>svg]:text-current',
  ),
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        info: 'border-sky-300/60 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-100 [&>svg]:text-sky-600 dark:[&>svg]:text-sky-300',
        success:
          'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300',
        warning:
          'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      'col-start-2 mb-1 leading-none font-medium tracking-tight',
      className,
    )}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('col-start-2 text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription, alertVariants }
