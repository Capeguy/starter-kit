/**
 * Backwards-compatible re-exports of the shadcn `Table` primitives under
 * the legacy `DataTable*` names that consumer pages already use. New code
 * should prefer importing the shadcn `Table*` components directly.
 *
 * The outer `DataTable` adds the project's standard scroll behavior — a
 * rounded bordered card with horizontal/vertical scroll-shadow gradients
 * that appear ONLY on edges where there's hidden content (driven by
 * `useScrollEdges`).
 */
'use client'

import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

import { useScrollEdges } from '~/hooks/use-scroll-edges'
import { cn } from '~/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

// ---------------------------------------------------------------------------
// DataTable — outer container
// ---------------------------------------------------------------------------

export interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const DataTable = ({ className, children, ...rest }: DataTableProps) => {
  const { ref, edges } = useScrollEdges<HTMLDivElement>()
  return (
    <div
      className={cn(
        'border-border relative overflow-hidden rounded-md border',
        className,
      )}
    >
      <div ref={ref} className="overflow-auto" {...rest}>
        {children}
      </div>
      {/*
       * Edge gradients sit absolutely above the scroll container and only
       * render when that edge has more content to reveal. `pointer-events-
       * none` so they never intercept clicks on rows/buttons underneath.
       */}
      {edges.left && (
        <div className="from-foreground/15 pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r to-transparent" />
      )}
      {edges.right && (
        <div className="from-foreground/15 pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l to-transparent" />
      )}
      {edges.top && (
        <div className="from-foreground/15 pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b to-transparent" />
      )}
      {edges.bottom && (
        <div className="from-foreground/15 pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t to-transparent" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataTableHeader — <thead>
// ---------------------------------------------------------------------------

export interface DataTableHeaderProps
  extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

export const DataTableHeader = ({
  className,
  ...rest
}: DataTableHeaderProps) => (
  <TableHeader
    className={cn('bg-muted/50 text-muted-foreground text-xs', className)}
    {...rest}
  />
)

// ---------------------------------------------------------------------------
// DataTableHead — <th>
// ---------------------------------------------------------------------------

export interface DataTableHeadProps
  extends ThHTMLAttributes<HTMLTableCellElement> {
  className?: string
}

export const DataTableHead = ({ className, ...rest }: DataTableHeadProps) => (
  <TableHead className={cn('h-9 px-3 py-2', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableBody — <tbody>
// ---------------------------------------------------------------------------

export interface DataTableBodyProps
  extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

export const DataTableBody = ({ className, ...rest }: DataTableBodyProps) => (
  <TableBody className={cn('text-sm', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableRow — <tr>
// ---------------------------------------------------------------------------

export interface DataTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  className?: string
}

export const DataTableRow = ({ className, ...rest }: DataTableRowProps) => (
  <TableRow className={cn(className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableCell — <td>
// ---------------------------------------------------------------------------

export interface DataTableCellProps
  extends TdHTMLAttributes<HTMLTableCellElement> {
  className?: string
}

export const DataTableCell = ({ className, ...rest }: DataTableCellProps) => (
  <TableCell className={cn('px-3 py-2', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableEmpty — renders inside <tbody> when there are zero rows
// ---------------------------------------------------------------------------

export interface DataTableEmptyProps {
  colSpan?: number
  children?: ReactNode
}

export const DataTableEmpty = ({
  colSpan = 1,
  children,
}: DataTableEmptyProps) => (
  <TableRow>
    <TableCell
      colSpan={colSpan}
      className="text-muted-foreground px-3 py-8 text-center"
    >
      {children}
    </TableCell>
  </TableRow>
)

// ---------------------------------------------------------------------------
// DataTableRoot — convenience <table> wrapper with standard width/alignment
// ---------------------------------------------------------------------------

export interface DataTableRootProps extends HTMLAttributes<HTMLTableElement> {
  className?: string
}

export const DataTableRoot = ({ className, ...rest }: DataTableRootProps) => (
  <Table className={cn('w-full min-w-max text-left', className)} {...rest} />
)
