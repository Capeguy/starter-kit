'use client'

import NextLink from 'next/link'
import { Button } from '@opengovsg/oui/button'
import { Infobox } from '@opengovsg/oui/infobox'
import { Popover } from '@opengovsg/oui/popover'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogTrigger } from 'react-aria-components'
import { BiBell } from 'react-icons/bi'

import { useTRPC } from '~/trpc/react'

const POLL_INTERVAL_MS = 15_000

export const NotificationBell = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

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

  return (
    <DialogTrigger>
      <Button
        variant="clear"
        size="md"
        aria-label={
          unread > 0 ? `${unread} unread notifications` : 'Notifications'
        }
        onPress={() => {
          // Mark all as read on open. Matches the "panel = inbox view" mental model.
          if (unread > 0) markRead.mutate({})
        }}
      >
        <span className="relative inline-flex">
          <BiBell className="h-5 w-5" />
          {unread > 0 && (
            <span className="bg-utility-feedback-critical text-base-canvas absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </Button>
      <Popover>
        <Dialog>
          <div className="flex w-80 flex-col gap-2 p-3">
            <h3 className="prose-label-md text-base-content-strong">
              Notifications
            </h3>
            {!list || list.items.length === 0 ? (
              <Infobox variant="info">No notifications yet.</Infobox>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.items.map((n) => {
                  const item = (
                    <div className="border-base-divide-subtle flex flex-col gap-0.5 border-b py-2 last:border-b-0">
                      <div className="flex items-center gap-2">
                        {!n.readAt && (
                          <span className="bg-utility-feedback-info inline-block h-2 w-2 rounded-full" />
                        )}
                        <span className="prose-label-md text-base-content-strong">
                          {n.title}
                        </span>
                      </div>
                      {n.body && (
                        <p className="prose-body-2 text-base-content-medium">
                          {n.body}
                        </p>
                      )}
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <NextLink href={n.href} className="block">
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
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
