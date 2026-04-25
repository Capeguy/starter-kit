-- CreateEnum
CREATE TYPE "vibe_stack"."Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "vibe_stack"."User" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "role" "vibe_stack"."Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "vibe_stack"."PasskeyResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."File" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyResetToken_token_key" ON "vibe_stack"."PasskeyResetToken"("token");

-- CreateIndex
CREATE INDEX "PasskeyResetToken_user_id_idx" ON "vibe_stack"."PasskeyResetToken"("user_id");

-- CreateIndex
CREATE INDEX "PasskeyResetToken_issued_by_id_idx" ON "vibe_stack"."PasskeyResetToken"("issued_by_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_createdAt_idx" ON "vibe_stack"."AuditLog"("user_id", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "vibe_stack"."AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_at_idx" ON "vibe_stack"."Notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_createdAt_idx" ON "vibe_stack"."Notification"("user_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "File_pathname_key" ON "vibe_stack"."File"("pathname");

-- CreateIndex
CREATE INDEX "File_user_id_createdAt_idx" ON "vibe_stack"."File"("user_id", "createdAt");

-- AddForeignKey
ALTER TABLE "vibe_stack"."PasskeyResetToken" ADD CONSTRAINT "PasskeyResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."PasskeyResetToken" ADD CONSTRAINT "PasskeyResetToken_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "vibe_stack"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."File" ADD CONSTRAINT "File_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

