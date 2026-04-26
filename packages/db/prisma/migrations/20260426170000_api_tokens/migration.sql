-- CreateTable. IF NOT EXISTS keeps the e2e applyMigrations happy when it
-- re-runs against a partially-migrated DB (the runner short-circuits on
-- prior schema state but other migrations may have been applied OOB).
CREATE TABLE IF NOT EXISTS "vibe_stack"."ApiToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_token_hash_key" ON "vibe_stack"."ApiToken"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiToken_user_id_revoked_at_idx" ON "vibe_stack"."ApiToken"("user_id", "revoked_at");

-- AddForeignKey. NOT VALID skip wouldn't work here; instead wrap in a
-- DO block to swallow duplicate-constraint errors so the migration is
-- safely re-runnable when the table already exists.
DO $$
BEGIN
  ALTER TABLE "vibe_stack"."ApiToken"
    ADD CONSTRAINT "ApiToken_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
