'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '~/components/ui/button'

export const BackButton = () => {
  const router = useRouter()

  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()}>
      <ArrowLeft />
      Back
    </Button>
  )
}
