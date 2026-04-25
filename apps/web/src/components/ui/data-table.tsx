import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@opengovsg/oui-theme'

// ---------------------------------------------------------------------------
// DataTable — outer container
// ---------------------------------------------------------------------------

export interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Scrollable, bordered container that wraps a <table>.
 * Mirrors the hand-rolled pattern:
 *   <div className="border-base-divider-medium overflow-x-auto rounded-md border">
 */
export const DataTable = ({ className, ...rest }: DataTableProps) => (
  <div
    className={cn(
      'border-base-divider-medium overflow-x-auto rounded-md border',
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
  <thead
    className={cn(
      'prose-label-sm bg-base-canvas-alt text-base-content-medium',
      className,
    )}
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
  <th className={cn('px-3 py-2', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableBody — <tbody>
// ---------------------------------------------------------------------------

export interface DataTableBodyProps
  extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

export const DataTableBody = ({ className, ...rest }: DataTableBodyProps) => (
  <tbody className={cn('prose-body-2', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableRow — <tr>
// ---------------------------------------------------------------------------

export interface DataTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  className?: string
}

export const DataTableRow = ({ className, ...rest }: DataTableRowProps) => (
  <tr
    className={cn(
      'border-base-divider-subtle hover:bg-base-canvas-alt border-t',
      className,
    )}
    {...rest}
  />
)

// ---------------------------------------------------------------------------
// DataTableCell — <td>
// ---------------------------------------------------------------------------

export interface DataTableCellProps
  extends TdHTMLAttributes<HTMLTableCellElement> {
  className?: string
}

export const DataTableCell = ({ className, ...rest }: DataTableCellProps) => (
  <td className={cn('px-3 py-2', className)} {...rest} />
)

// ---------------------------------------------------------------------------
// DataTableEmpty — renders inside <tbody> when there are zero rows
// ---------------------------------------------------------------------------

export interface DataTableEmptyProps {
  colSpan?: number
  children?: React.ReactNode
}

export const DataTableEmpty = ({
  colSpan = 1,
  children,
}: DataTableEmptyProps) => (
  <tr>
    <td
      colSpan={colSpan}
      className="text-base-content-medium px-3 py-8 text-center"
    >
      {children}
    </td>
  </tr>
)

// ---------------------------------------------------------------------------
// DataTableRoot — convenience <table> wrapper with standard width/alignment
// ---------------------------------------------------------------------------

export interface DataTableRootProps extends HTMLAttributes<HTMLTableElement> {
  className?: string
}

export const DataTableRoot = ({ className, ...rest }: DataTableRootProps) => (
  <table className={cn('w-full min-w-max text-left', className)} {...rest} />
)
