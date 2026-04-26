import type { HTMLAttributes } from 'react'

import { cn } from '~/lib/utils'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
} from './data-table'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const Skeleton = ({ className, ...rest }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn('bg-muted h-4 w-full animate-pulse rounded', className)}
    {...rest}
  />
)

export interface SkeletonTextProps {
  lines?: number
  className?: string
}

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
        className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')}
      />
    ))}
  </div>
)

export interface SkeletonCardProps {
  className?: string
  lines?: number
}

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
    <header className="border-base-divider-subtle flex items-center justify-between gap-3 border-b px-4 py-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-16" />
    </header>
    <div className="flex flex-col gap-3 px-4 py-4">
      <SkeletonText lines={lines} />
    </div>
  </section>
)

export interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

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
