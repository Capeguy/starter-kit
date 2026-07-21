'use client'

import { useRouter } from 'next/navigation'

import { Button } from '~/components/ui/button'

export const GoBackButton = () => {
  const router = useRouter()

  // window.history.length is always >= 1 (current entry); > 1 means there's a previous entry
  const canGoBack = window.history.length > 1

  if (!canGoBack) return null

  const handleBack = () => {
    router.back()
  }

  return (
    <Button onClick={handleBack} variant="secondary">
      Go Back
    </Button>
  )
}
