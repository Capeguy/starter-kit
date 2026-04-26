'use client'

import { useRouter } from 'next/navigation'

import { ErrorSvg } from '@acme/ui/svgs'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface ErrorCardProps {
  fullscreen?: boolean
  title?: string
  message?: string
  svg?: React.ReactNode
}

const DEFAULT_ERROR_SVG = <ErrorSvg />

export const ErrorCard = ({
  fullscreen = true,
  title,
  message,
  svg = DEFAULT_ERROR_SVG,
}: ErrorCardProps) => {
  const router = useRouter()

  const canGoBack = typeof window !== 'undefined' && window.history.length > 0
  const handleBack = () => {
    if (typeof window === 'undefined') return
    if (canGoBack) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center',
        fullscreen ? 'gap-8 p-8' : 'gap-0 p-0',
      )}
    >
      {svg}

      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-foreground text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground text-base">{message}</p>
      </div>

      {canGoBack && (
        <Button onClick={handleBack} variant="secondary">
          Go Back
        </Button>
      )}
    </div>
  )
}
