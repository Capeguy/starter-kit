import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => {
  return (
    <div className="border-base-divide-subtle flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
      {icon !== undefined && (
        <span className="text-base-content-medium text-4xl">{icon}</span>
      )}
      <p className="prose-h4 text-base-content-strong">{title}</p>
      {description !== undefined && (
        <p className="prose-body-2 text-base-content-medium">{description}</p>
      )}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
