import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

import type { InfoboxSlots, InfoboxVariantProps } from './infobox.styles'
import { cn } from '../utils'
import { infoboxBase, infoboxIcon } from './infobox.styles'

interface InfoboxProps extends InfoboxVariantProps {
  /** The content of the infobox. */
  children: ReactNode
  /**
   * Icon to show on the left of the infobox. If not specified, a default
   * icon will be used according to the variant. Provide `null` to hide.
   */
  icon?: ReactNode | null
  className?: string
  classNames?: Partial<Record<InfoboxSlots, string>>
}

export const Infobox = ({
  variant = 'info',
  size = 'md',
  icon,
  className,
  classNames,
  children,
}: InfoboxProps) => {
  const iconClassName = infoboxIcon({
    variant,
    size,
    className: classNames?.icon,
  })

  const renderedIcon = useMemo(() => {
    if (icon === null) return null
    if (icon !== undefined) return <span className={iconClassName}>{icon}</span>
    switch (variant) {
      case 'error':
        return <XCircle className={iconClassName} aria-hidden />
      case 'success':
        return <CheckCircle2 className={iconClassName} aria-hidden />
      default:
        return <Info className={iconClassName} aria-hidden />
    }
  }, [icon, iconClassName, variant])

  return (
    <div
      className={cn(
        infoboxBase({ variant, size }),
        className ?? classNames?.base,
      )}
    >
      {renderedIcon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
