import type { HTMLAttributes } from 'react'
import { cn } from '@opengovsg/oui-theme'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from './data-table'

// ---------------------------------------------------------------------------
// Skeleton — base pulsing block
// ---------------------------------------------------------------------------

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Base pulsing block. Width/height are set via className.
 * Defaults to a single line of body-text height (1rem).
 */
export const Skeleton = ({ className, ...rest }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn(
      'bg-base-canvas-alt h-4 w-full animate-pulse rounded',
      className,
    )}
    {...rest}
  />
)

// ---------------------------------------------------------------------------
// SkeletonText — a stack of body-text-shaped skeletons
// ---------------------------------------------------------------------------

export interface SkeletonTextProps {
  /** Number of lines to render. Defaults to 3. */
  lines?: number
  className?: string
}

/**
 * Multiple horizontally-stacked text-shaped skeletons.
 * The last line is shortened to mimic real text wrapping.
 */
export const SkeletonText = ({ lines = 3, className }: SkeletonTextProps) => (
  <div
    aria-hidden="true"
    role="status"
    aria-label="Loading content"
    className={cn('flex flex-col gap-2', className)}
  >
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        // Last line shorter so the block doesn't read as a perfect rectangle.
        className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')}
      />
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// SkeletonCard — Card-shaped skeleton (header bar + body block)
// ---------------------------------------------------------------------------

export interface SkeletonCardProps {
  className?: string
  /** Body line count. Defaults to 3. */
  lines?: number
}

/**
 * Matches the visual of `~/components/ui/card`'s Card:
 * bordered/rounded section with a header bar (h2) + body block.
 */
export const SkeletonCard = ({ className, lines = 3 }: SkeletonCardProps) => (
  <section
    aria-hidden="true"
    role="status"
    aria-label="Loading card"
    className={cn(
      'border-base-divider-medium bg-base-canvas-default rounded-md border',
      className,
    )}
  >
    {/* Header — matches `<CardHeader />`'s px-4 py-3 + bottom-border */}
    <header className="border-base-divider-subtle flex items-center justify-between gap-3 border-b px-4 py-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-16" />
    </header>
    {/* Body — matches `<CardBody />`'s px-4 py-4 */}
    <div className="flex flex-col gap-3 px-4 py-4">
      <SkeletonText lines={lines} />
    </div>
  </section>
)

// ---------------------------------------------------------------------------
// SkeletonTable — table-row-shaped skeletons inside DataTable wrapper
// ---------------------------------------------------------------------------

export interface SkeletonTableProps {
  /** Number of body rows. Defaults to 5. */
  rows?: number
  /** Number of columns. Defaults to 4. */
  cols?: number
  className?: string
}

/**
 * Matches the visual of a `~/components/ui/data-table` DataTable:
 * the same bordered/rounded container, header row of column-name skeletons,
 * and `rows` × `cols` body cells of pulsing blocks.
 */
export const SkeletonTable = ({
  rows = 5,
  cols = 4,
  className,
}: SkeletonTableProps) => (
  <DataTable
    aria-hidden="true"
    role="status"
    aria-label="Loading table"
    className={className}
  >
    <DataTableRoot>
      <DataTableHeader>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <DataTableHead key={i}>
              <Skeleton className="h-4 w-20" />
            </DataTableHead>
          ))}
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <DataTableRow key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <DataTableCell key={c}>
                <Skeleton
                  // Vary widths per column so it doesn't read as a flat grid.
                  className={cn(
                    'h-4',
                    c === 0 ? 'w-32' : c === cols - 1 ? 'w-16' : 'w-24',
                  )}
                />
              </DataTableCell>
            ))}
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTableRoot>
  </DataTable>
)
