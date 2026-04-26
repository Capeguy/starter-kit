'use client'

import { usePathname } from 'next/navigation'

import { resolveBreadcrumbs } from '~/lib/nav'
import { Breadcrumbs } from './ui/breadcrumbs'

interface RegistryBreadcrumbsProps {
  /**
   * Optional trailing label for dynamic sub-pages. e.g. `/admin/users/[id]`
   * passes the user's name; the registry can't know it. When provided, the
   * matching nav item becomes a clickable mid-crumb back to the parent.
   */
  trailing?: string
}

/**
 * Breadcrumbs that auto-resolve from the navigation registry. Pass `trailing`
 * for dynamic sub-pages (e.g. user detail). Replaces the per-page hardcoded
 * `<Breadcrumbs items={[...]} />` calls — adding a new page in `~/lib/nav`
 * automatically gives it a correct breadcrumb chain.
 */
export function RegistryBreadcrumbs({ trailing }: RegistryBreadcrumbsProps) {
  const pathname = usePathname()
  const items = resolveBreadcrumbs(pathname, trailing)
  return <Breadcrumbs items={items} />
}
