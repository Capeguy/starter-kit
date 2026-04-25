import { db } from '@acme/db'

export const listMine = async ({
  userId,
  cursor,
  limit,
}: {
  userId: string
  cursor: string | null | undefined
  limit: number
}) => {
  const items = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasNext = items.length > limit
  const trimmed = hasNext ? items.slice(0, -1) : items

  return {
    items: trimmed,
    nextCursor: hasNext ? trimmed[trimmed.length - 1]?.id : null,
  }
}

export const unreadCount = async (userId: string): Promise<number> =>
  db.notification.count({ where: { userId, readAt: null } })

export const markRead = async ({
  userId,
  ids,
}: {
  userId: string
  ids?: string[]
}) =>
  db.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  })

interface BroadcastInput {
  audience:
    | { kind: 'all' }
    | { kind: 'role'; roleId: string }
    | { kind: 'user'; userId: string }
  title: string
  body: string | null
  href: string | null
}

export const broadcast = async (input: BroadcastInput) => {
  const where =
    input.audience.kind === 'all'
      ? {}
      : input.audience.kind === 'role'
        ? { roleId: input.audience.roleId }
        : { id: input.audience.userId }

  const userIds = await db.user.findMany({
    where,
    select: { id: true },
  })

  if (userIds.length === 0) return { count: 0 }

  await db.notification.createMany({
    data: userIds.map((u) => ({
      userId: u.id,
      title: input.title,
      body: input.body,
      href: input.href,
    })),
  })

  return { count: userIds.length }
}
