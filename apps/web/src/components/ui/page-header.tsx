import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export const PageHeader = ({
  title,
  description,
  actions,
}: PageHeaderProps) => (
  <header className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <h1 className="prose-h2 text-base-content-strong">{title}</h1>
      {description && (
        <p className="prose-body-2 text-base-content-medium">{description}</p>
      )}
    </div>
    {actions}
  </header>
)
