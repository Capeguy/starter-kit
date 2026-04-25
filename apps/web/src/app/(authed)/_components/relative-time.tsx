'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface RelativeTimeProps {
  date: Date
  className?: string
}

const TICK_INTERVAL_MS = 30_000

/**
 * Renders a date as "2 minutes ago" / "3 days ago" and keeps it fresh on a
 * 30s tick so the value doesn't go stale on long-lived pages. Hover reveals
 * the full local timestamp for precision.
 *
 * `suppressHydrationWarning` is set because the rendered text depends on
 * `now`, which can differ by a few seconds between server render and client
 * mount; the value reconciles correctly after hydration either way.
 */
export const RelativeTime = ({ date, className }: RelativeTimeProps) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      className={className}
      suppressHydrationWarning
    >
      {formatDistanceToNow(date, { addSuffix: true })}
    </time>
  )
}
