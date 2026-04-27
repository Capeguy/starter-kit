import { createEnv } from '@t3-oss/env-core'
import z from 'zod'

export const env = createEnv({
  server: {
    CACHE_HOSTNAME: z.string().trim().min(1).optional(),
    CACHE_PORT: z.coerce.number().default(6379).optional(),
    CACHE_USERNAME: z.string().optional(),
    CACHE_PASSWORD: z.string().optional(),
    /**
     * Per-project key prefix so multiple apps sharing a single Redis Cloud DB
     * don't collide on session, rate-limit, BullMQ, or cache keys. Set to the
     * project slug (e.g. `vibe-stack`, `acme-app`); ioredis prepends this to
     * every key before sending to the server.
     */
    CACHE_KEY_PREFIX: z.string().trim().min(1).optional(),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === 'lint',
})
