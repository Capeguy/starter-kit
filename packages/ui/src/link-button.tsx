'use client'

import type { VariantProps } from 'class-variance-authority'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'

import { cn } from './utils'

/**
 * Button-styled anchor. Consumer pages use this for "Sign in", "Get
 * started" calls-to-action and similar — anywhere we want a button look
 * but href-driven navigation. The variant/size vocabulary maps to the
 * shadcn `Button` cva so the chrome stays consistent.
 */
const linkButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'whitespace-nowrap transition-colors focus-visible:outline-none ' +
    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'ring-offset-background disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-input bg-background hover:bg-accent hover:text-accent-foreground border',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        clear: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        md: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'solid',
      size: 'default',
    },
  },
)

export interface LinkButtonProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>,
    VariantProps<typeof linkButtonVariants> {
  href: string
  children: ReactNode
  startContent?: ReactNode
  endContent?: ReactNode
  /**
   * Reserved for parity with the legacy OUI-era API. Currently ignored.
   * `radius` / `isAttached` / `isIconOnly` / `color` were OUI-only knobs.
   */
  radius?: string
  isAttached?: boolean
  isIconOnly?: boolean
  color?: string
}

export const LinkButton = ({
  variant,
  size,
  className,
  startContent,
  endContent,
  children,
  href,
  // Drop the legacy-only knobs so they don't leak into the DOM.
  radius: _radius,
  isAttached: _isAttached,
  isIconOnly: _isIconOnly,
  color: _color,
  ...props
}: LinkButtonProps) => {
  return (
    <a
      href={href}
      {...props}
      className={cn(linkButtonVariants({ variant, size, className }))}
    >
      {startContent}
      {children}
      {endContent}
    </a>
  )
}
