/**
 * App-wide system message banner. Stored as a singleton row in the
 * `SystemMessage` table (id `singleton`) — at most one banner exists. Read
 * by every authed page chrome via `systemMessage.get`; written from
 * `/admin/system-message` via `admin.systemMessage.update` (gated by
 * `Capability.SystemMessageManage`).
 *
 * The row is created by the migration so the first read/upsert always finds
 * it; the upsert here is defensive (covers test DBs spun up without seed).
 */
import { db } from '@acme/db'

export const SYSTEM_MESSAGE_SINGLETON_ID = 'singleton'

export const SYSTEM_MESSAGE_SEVERITIES = [
  'INFO',
  'WARNING',
  'CRITICAL',
] as const
export type SystemMessageSeverity = (typeof SYSTEM_MESSAGE_SEVERITIES)[number]

export interface SystemMessageState {
  enabled: boolean
  message: string
  severity: SystemMessageSeverity
  updatedAt: Date | null
  updatedById: string | null
}

const EMPTY_STATE: SystemMessageState = {
  enabled: false,
  message: '',
  severity: 'INFO',
  updatedAt: null,
  updatedById: null,
}

/**
 * Read the singleton row. Returns the empty default (`enabled=false`,
 * blank message) when no row exists yet — callers don't need to special-case
 * a missing record.
 */
export const getSystemMessage = async (): Promise<SystemMessageState> => {
  const row = await db.systemMessage.findUnique({
    where: { id: SYSTEM_MESSAGE_SINGLETON_ID },
    select: {
      enabled: true,
      message: true,
      severity: true,
      updatedAt: true,
      updatedById: true,
    },
  })
  if (!row) return EMPTY_STATE
  return {
    enabled: row.enabled,
    message: row.message,
    severity: row.severity,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  }
}

interface UpdateSystemMessageInput {
  enabled: boolean
  message: string
  severity: SystemMessageSeverity
  updatedById: string
}

/**
 * Upsert the singleton row. The migration pre-inserts the row so this is
 * usually an UPDATE; the upsert covers test DBs that didn't run the seed.
 */
export const updateSystemMessage = async (
  input: UpdateSystemMessageInput,
): Promise<SystemMessageState> => {
  const row = await db.systemMessage.upsert({
    where: { id: SYSTEM_MESSAGE_SINGLETON_ID },
    update: {
      enabled: input.enabled,
      message: input.message,
      severity: input.severity,
      updatedById: input.updatedById,
    },
    create: {
      id: SYSTEM_MESSAGE_SINGLETON_ID,
      enabled: input.enabled,
      message: input.message,
      severity: input.severity,
      updatedById: input.updatedById,
    },
    select: {
      enabled: true,
      message: true,
      severity: true,
      updatedAt: true,
      updatedById: true,
    },
  })
  return {
    enabled: row.enabled,
    message: row.message,
    severity: row.severity,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  }
}
