import z from 'zod'

import { db } from '@acme/db'

import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc'

const listInputSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
  userId: z.string().nullish(),
  action: z.string().nullish(),
})

// Metadata keys whose values are user IDs we may want to render as a name.
// Keep in sync with `formatAuditEvent` in app/(authed)/_components/audit-action-labels.tsx.
const USER_ID_METADATA_KEYS = [
  'actingUserId',
  'issuedById',
  'deletedUserId',
  'targetUserId',
  'impersonatedUserId',
] as const

const collectRelatedUserIds = (rows: { metadata: unknown }[]): string[] => {
  const ids = new Set<string>()
  for (const row of rows) {
    if (typeof row.metadata !== 'object' || row.metadata === null) continue
    const meta = row.metadata as Record<string, unknown>
    for (const key of USER_ID_METADATA_KEYS) {
      const v = meta[key]
      if (typeof v === 'string') ids.add(v)
    }
  }
  return [...ids]
}

const fetchRelatedUsers = async (
  rows: { metadata: unknown }[],
): Promise<
  Record<string, { id: string; name: string | null; email: string | null }>
> => {
  const ids = collectRelatedUserIds(rows)
  if (ids.length === 0) return {}
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  })
  return Object.fromEntries(users.map((u) => [u.id, u]))
}

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
      relatedUsers: await fetchRelatedUsers(trimmed),
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
        relatedUsers: await fetchRelatedUsers(trimmed),
        nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
      }
    }),
})
