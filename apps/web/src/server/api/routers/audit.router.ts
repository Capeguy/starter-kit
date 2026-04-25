import z from 'zod'

import { db } from '@acme/db'

import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc'

const listInputSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
  userId: z.string().nullish(),
  action: z.string().nullish(),
})

export const auditRouter = createTRPCRouter({
  // Admin: query the full audit log with optional filters.
  list: adminProcedure.input(listInputSchema).query(async ({ input }) => {
    const items = await db.auditLog.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.action ? { action: input.action } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })

    const hasNext = items.length > input.limit
    const trimmed = hasNext ? items.slice(0, -1) : items

    return {
      items: trimmed,
      nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
    }
  }),

  // Caller's own audit history. Same shape as `list` but scoped to the session user.
  listMine: protectedProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const items = await db.auditLog.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      })

      const hasNext = items.length > input.limit
      const trimmed = hasNext ? items.slice(0, -1) : items

      return {
        items: trimmed,
        nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
      }
    }),
})
