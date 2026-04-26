-- One-time admin-issued invite links: recipient registers a passkey and lands
-- in the app under the pre-assigned `role_id`. Mirrors the PasskeyResetToken
-- shape (token, expiry, single-use consumed_at) plus pre-fill metadata
-- (email, name) and a FK to the resulting user (claimed_by_user_id).

-- CreateTable
CREATE TABLE "vibe_stack"."Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "claimed_by_user_id" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "vibe_stack"."Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_claimed_by_user_id_key" ON "vibe_stack"."Invite"("claimed_by_user_id");

-- CreateIndex
CREATE INDEX "Invite_issued_by_id_idx" ON "vibe_stack"."Invite"("issued_by_id");

-- CreateIndex
CREATE INDEX "Invite_role_id_idx" ON "vibe_stack"."Invite"("role_id");

-- AddForeignKey
ALTER TABLE "vibe_stack"."Invite" ADD CONSTRAINT "Invite_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "vibe_stack"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."Invite" ADD CONSTRAINT "Invite_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "vibe_stack"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."Invite" ADD CONSTRAINT "Invite_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
