'use client'

import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '~/trpc/react'

/**
 * Returns whether a feature flag is on for the current authenticated user.
 *
 * Defaults to `false` while the query is loading or if anything goes wrong
 * (no flag, server error). Default-false is the safe stance for any "is
 * this experimental thing on?" branch — fall back to existing behavior.
 *
 * Server-side equivalent:
 *   `await isEnabled({ key, userId })` from
 *   `apps/web/src/server/modules/feature-flag/feature-flag.service.ts`.
 */
export function useFeatureFlag(key: string): boolean {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.featureFlag.evaluate.queryOptions({ key }))
  return data?.enabled ?? false
}
