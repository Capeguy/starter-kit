/**
 * Backwards-compatible re-exports of the shadcn `Table` primitives under
 * the legacy `DataTable*` names that consumer pages already use. New code
 * should prefer importing the shadcn `Table*` components directly.
 *
 * The wrapper preserves the legacy `DataTableEmpty` helper and the outer
 * scrollable container (with the `scroll-shadow-x` accent) that the old
 * OUI-era component provided.
 */
import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

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

export const DataTable = ({ className, ...rest }: DataTableProps) => (
  <div
    className={cn(
      'border-border scroll-shadow-x overflow-x-auto rounded-md border',
      className,
    )}
    {...rest}
  />
)

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
