-- Grant the new `system.message.manage` capability to the seeded Admin role.
-- Mirrors the idempotent array-with-uniqueness pattern from
-- 20260426170628_grant_feature_flag_capabilities so re-running this migration
-- is safe.
UPDATE "vibe_stack"."Role"
SET "capabilities" = ARRAY(
  SELECT DISTINCT unnest("capabilities" || ARRAY['system.message.manage']::TEXT[])
)
WHERE "id" = 'role_admin';

-- Ensure the SystemMessage singleton row exists so admins land on a populated
-- form (with `enabled=false`) rather than a blank table on first visit. The
-- row id "singleton" is the model's @default — keep it stable, the upsert
-- in the admin mutation keys on it.
INSERT INTO "vibe_stack"."SystemMessage" ("id", "enabled", "message", "severity", "updatedAt")
VALUES ('singleton', false, '', 'INFO', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
