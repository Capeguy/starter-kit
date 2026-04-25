import { TRPCError } from '@trpc/server'

import { db } from '@acme/db'
import { redis } from '@acme/redis'

export const healthcheck = async () => {
  try {
    await db.$queryRaw`SELECT 1`

    let cache: 'up' | 'disabled' | 'error' = 'disabled'
    if (redis) {
      try {
        const pong = await redis.ping()
        cache = pong === 'PONG' ? 'up' : 'error'
      } catch {
        cache = 'error'
      }
    }

    return {
      database: 'up',
      cache,
    }
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Healthcheck failed',
      cause: error,
    })
  }
}
