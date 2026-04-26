-- Self-hosted feature flags. `enabled` is the master switch; when on,
-- `allowed_user_ids` is the always-on overlay and `rollout_percent` is the
-- percent-of-users-by-stable-hash bucket. Evaluation lives in
-- `apps/web/src/server/modules/feature-flag/feature-flag.service.ts`.

-- CreateTable
CREATE TABLE "vibe_stack"."FeatureFlag" (
    "key" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percent" INTEGER NOT NULL DEFAULT 0,
    "allowed_user_ids" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);
