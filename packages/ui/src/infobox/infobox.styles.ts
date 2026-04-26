import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

/**
 * Variant + size styles for the Infobox base container.
 *
 * Mirrors the legacy OUI Infobox variant set (info / warning / error /
 * success) and sizes (sm / md), but expressed as plain Tailwind utilities
 * over the shadcn token palette instead of OUI's `tv()` slot machinery.
 */
export const infoboxBase = cva(
  'flex w-full items-start justify-start gap-2 rounded-md border',
  {
    variants: {
      variant: {
        info: 'border-sky-300/60 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-100',
        warning:
          'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100',
        error:
          'border-destructive/40 bg-destructive/5 text-foreground dark:border-destructive/40 dark:bg-destructive/10',
        success:
          'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100',
      },
      size: {
        sm: 'p-2 text-sm',
        md: 'p-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'info',
      size: 'md',
    },
  },
)

export const infoboxIcon = cva('shrink-0', {
  variants: {
    variant: {
      info: 'text-sky-600 dark:text-sky-300',
      warning: 'text-amber-600 dark:text-amber-300',
      error: 'text-destructive',
      success: 'text-emerald-600 dark:text-emerald-300',
    },
    size: {
      sm: 'mt-0.5 h-4 w-4',
      md: 'mt-0.5 h-5 w-5',
    },
  },
  defaultVariants: {
    variant: 'info',
    size: 'md',
  },
})

export type InfoboxVariantProps = VariantProps<typeof infoboxBase>
export type InfoboxSlots = 'base' | 'icon'
