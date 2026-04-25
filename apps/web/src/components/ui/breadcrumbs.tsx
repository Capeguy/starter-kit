import { Breadcrumb, Breadcrumbs as OuiBreadcrumbs } from '@opengovsg/oui'

export interface BreadcrumbItem {
  label: string
  /** Omit href for the current page (last item). */
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

/**
 * Thin wrapper around `@opengovsg/oui` Breadcrumbs.
 * The last item should have no href — it represents the current page and is
 * rendered as plain text by the underlying OUI Breadcrumb component.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <OuiBreadcrumbs>
      {items.map((item) => (
        <Breadcrumb key={item.label} href={item.href}>
          {item.label}
        </Breadcrumb>
      ))}
    </OuiBreadcrumbs>
  )
}
