'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { Button } from '~/components/ui/button'

export const GoBackButton = () => {
  const router = useRouter()

  // `window.history` is unavailable on the server, so the check has to run
  // after mount: rendering nothing on both the server pass and the first
  // client pass keeps hydration in agreement, then the button appears.
  // (Upstream instead marks this `dynamic({ ssr: false })` from ErrorCard,
  // which Next 16 rejects inside a Server Component.)
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    // history.length is always >= 1 (the current entry); > 1 means there is
    // a previous entry to go back to.
    setCanGoBack(window.history.length > 1)
  }, [])

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
