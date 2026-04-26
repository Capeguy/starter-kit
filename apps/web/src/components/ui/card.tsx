import type { ComponentProps, ReactNode } from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
  CardHeader as ShadcnCardHeader,
} from '~/components/ui/_card-primitives'

export type CardHeaderProps = ComponentProps<'div'> & {
  title?: string
  actions?: ReactNode
  children?: ReactNode
}

/**
 * Backwards-compatible CardHeader.
 *
 * Legacy callers use `<CardHeader title="…" actions={…} />`. When either
 * `title` or `actions` is provided, this renders the equivalent shadcn
 * composition (`CardHeader > CardTitle` + optional `CardAction`).
 *
 * Modern callers can also pass `children` directly to compose freely
 * against the shadcn primitives, mirroring the underlying shadcn
 * `CardHeader` API.
 */
function CardHeader({ title, actions, children, ...rest }: CardHeaderProps) {
  if (title !== undefined || actions !== undefined) {
    return (
      <ShadcnCardHeader {...rest}>
        {title !== undefined && <CardTitle>{title}</CardTitle>}
        {actions !== undefined && <CardAction>{actions}</CardAction>}
        {children}
      </ShadcnCardHeader>
    )
  }
  return <ShadcnCardHeader {...rest}>{children}</ShadcnCardHeader>
}

/**
 * Backwards-compatible alias for shadcn's `CardContent`. New code should
 * prefer `CardContent` directly.
 */
const CardBody = CardContent

export {
  Card,
  CardAction,
  CardBody,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
}
