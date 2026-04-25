import z from 'zod'

import {
  listMine,
  markRead,
  unreadCount,
} from '~/server/modules/notification/notification.service'
import { createTRPCRouter, protectedProcedure } from '../trpc'

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(({ input, ctx }) =>
      listMine({
        userId: ctx.user.id,
        cursor: input.cursor,
        limit: input.limit,
      }),
    ),

  unreadCount: protectedProcedure
    // Polled every 15s — exempt from the rate limiter so we don't 429 on
    // multiple browser tabs.
    .meta({ rateLimitOptions: null })
    .query(({ ctx }) => unreadCount(ctx.user.id)),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).optional() }))
    .mutation(({ input, ctx }) =>
      markRead({ userId: ctx.user.id, ids: input.ids }),
    ),
})
