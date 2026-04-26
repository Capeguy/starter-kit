-- Singleton row holding the app-wide system message banner. There is at most
-- one row, identified by the literal id "singleton" so admin updates are a
-- simple upsert without a count query. See
-- `apps/web/src/server/modules/system-message/system-message.service.ts`.

-- CreateEnum
CREATE TYPE "vibe_stack"."SystemMessageSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "vibe_stack"."SystemMessage" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "severity" "vibe_stack"."SystemMessageSeverity" NOT NULL DEFAULT 'INFO',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "SystemMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemMessage_updated_by_id_idx" ON "vibe_stack"."SystemMessage"("updated_by_id");

-- AddForeignKey
ALTER TABLE "vibe_stack"."SystemMessage" ADD CONSTRAINT "SystemMessage_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "vibe_stack"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
