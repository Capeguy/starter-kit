import Redis from 'ioredis'
import type { RedisOptions } from 'ioredis'

import { env } from './env'

const globalForRedis = global as unknown as {
  redis: ReturnType<typeof createRedisClient> | undefined
}

const sharedOptions: RedisOptions = {
  // Per-project namespacing — ioredis prepends this to every key it sends.
  // REDIS_PREFIX is the preferred name; CACHE_KEY_PREFIX is the legacy alias.
  // See docs in env.ts. Defaults to no prefix in dev.
  keyPrefix:
    (env.REDIS_PREFIX ?? env.CACHE_KEY_PREFIX)
      ? `${env.REDIS_PREFIX ?? env.CACHE_KEY_PREFIX}:`
      : undefined,
  retryStrategy: (attempt) => {
    return Math.min(attempt * 100, 5000)
  },
  // Only reconnect when the error contains "READONLY"
  // during node failover, this is thrown: 149: -READONLY You can't write against a read only replica.
  reconnectOnError: (error) => error.message.includes('READONLY'),
}

const createRedisClient = (): Redis | null => {
  if (env.REDIS_URL) {
    // URL form wins — a rediss:// scheme makes ioredis negotiate TLS, which
    // Upstash (and most managed Redis) requires.
    const redisClient = new Redis(env.REDIS_URL, sharedOptions)
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err.message)
    })
    return redisClient
  }

  if (!env.CACHE_HOSTNAME) {
    console.warn(
      '!!!! Neither REDIS_URL nor CACHE_HOSTNAME is set, Redis client will not be created. !!!!'
    )
    return null
  }

  const redisClient = new Redis({
    host: env.CACHE_HOSTNAME,
    port: env.CACHE_PORT,
    username: env.CACHE_USERNAME,
    password: env.CACHE_PASSWORD,
    ...sharedOptions,
  })

  redisClient.on('error', (err) => {
    console.error('Redis client error:', err.message)
  })

  return redisClient
}

export const redis =
  globalForRedis.redis !== undefined
    ? globalForRedis.redis
    : createRedisClient()
