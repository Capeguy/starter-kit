'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface RelativeTimeProps {
  date: Date
  className?: string
}

const TICK_INTERVAL_MS = 30_000

const formatAbsolute = (date: Date): string =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)

/**
 * Renders a date as "2 minutes ago" / "3 days ago" and keeps it fresh on a
 * 30s tick so the value doesn't go stale on long-lived pages. Click toggles
 * to the absolute timestamp (works on touch devices where hover doesn't);
 * hover also still surfaces the absolute via the title attribute.
 *
 * `suppressHydrationWarning` is set because the rendered text depends on
 * `now`, which can differ by a few seconds between server render and client
 * mount; the value reconciles correctly after hydration either way.
 */
export const RelativeTime = ({ date, className }: RelativeTimeProps) => {
  const [, setTick] = useState(0)
  const [showAbsolute, setShowAbsolute] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const absolute = formatAbsolute(date)

  return (
    <time
      dateTime={date.toISOString()}
      title={absolute}
      className={`${className ?? ''} cursor-pointer`}
      onClick={() => setShowAbsolute((v) => !v)}
      suppressHydrationWarning
    >
      {showAbsolute ? absolute : formatDistanceToNow(date, { addSuffix: true })}
    </time>
  )
}
