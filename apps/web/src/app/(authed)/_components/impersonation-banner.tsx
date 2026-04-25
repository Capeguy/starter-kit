'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@opengovsg/oui/button'
import { toast } from '@opengovsg/oui/toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'

export const ImpersonationBanner = () => {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: me } = useQuery(trpc.me.get.queryOptions())

  const stop = useMutation(
    trpc.impersonation.stop.mutationOptions({
      onSuccess: async () => {
        toast.success('Impersonation stopped')
        await queryClient.invalidateQueries()
        router.push('/admin/users')
        router.refresh()
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  if (!me?.impersonator) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-utility-feedback-warning text-base-content-strong flex items-center justify-between gap-3 px-4 py-2"
    >
      <span className="prose-label-md">
        You are impersonating <strong>{me.name ?? '(unnamed)'}</strong> as{' '}
        <strong>{me.impersonator.name ?? '(unnamed)'}</strong>.
      </span>
      <Button
        size="sm"
        variant="outline"
        isPending={stop.isPending}
        onPress={() => stop.mutate()}
      >
        Stop impersonation
      </Button>
    </div>
  )
}
