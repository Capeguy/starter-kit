'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'

import { Button } from '~/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { useTRPC } from '~/trpc/react'

const POLL_INTERVAL_MS = 15_000

export const NotificationBell = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  const { data: unread = 0 } = useQuery(
    trpc.notification.unreadCount.queryOptions(undefined, {
      refetchInterval: POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }),
  )

  const { data: list } = useQuery(
    trpc.notification.list.queryOptions({ limit: 10 }),
  )

  const markRead = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.notification.unreadCount.queryKey(),
        })
        await queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        })
      },
    }),
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    // Mark all as read on open. Matches the "panel = inbox view" mental model.
    if (open && unread > 0) markRead.mutate({})
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unread > 0 ? `${unread} unread notifications` : 'Notifications'
          }
          className="relative"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-foreground text-sm font-semibold">
            Notifications
          </h3>
          {!list || list.items.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-sm">
              No notifications yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.items.map((n) => {
                const item = (
                  <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0">
                    <div className="flex items-center gap-2">
                      {!n.readAt && (
                        <span className="bg-primary inline-block h-2 w-2 rounded-full" />
                      )}
                      <span className="text-foreground text-sm font-medium">
                        {n.title}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-muted-foreground text-sm">{n.body}</p>
                    )}
                  </div>
                )
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <NextLink
                        href={n.href}
                        className="block"
                        onClick={() => setIsOpen(false)}
                      >
                        {item}
                      </NextLink>
                    ) : (
                      item
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
