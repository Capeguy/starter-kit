import type { PropsWithChildren } from 'react'

import { cn } from '~/lib/utils'

export const LandingSection = ({
  children,
  className,
  classNames,
}: PropsWithChildren<{
  className?: string
  classNames?: { section?: string; inner?: string }
}>) => {
  return (
    <section className={className ?? classNames?.section}>
      <div
        className={cn(
          'container mx-auto flex flex-col gap-4 px-4 py-14 md:py-22',
          classNames?.inner,
        )}
      >
        {children}
      </div>
    </section>
  )
}

export const SectionHeader = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <h2
      className={cn(
        'text-foreground text-3xl font-bold tracking-tight md:text-4xl',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export const SectionBody = ({ children }: PropsWithChildren) => {
  return <p className="text-foreground text-base">{children}</p>
}
