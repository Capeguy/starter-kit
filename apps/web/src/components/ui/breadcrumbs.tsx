import { Fragment } from 'react'
import Link from 'next/link'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb'

export interface BreadcrumbItem {
  label: string
  /** Omit href for the current page (last item). */
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

/**
 * Project breadcrumbs. Wraps shadcn `Breadcrumb` so callers pass a flat
 * `items` array (label + optional href) and get the full chain rendered with
 * separators. The last item is rendered as `BreadcrumbPage` (current page,
 * not a link) regardless of whether it has an href.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <Fragment key={`${item.label}-${idx}`}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
