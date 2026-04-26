-- Grant the new `feature_flag.read` and `feature_flag.manage` capabilities
-- to the seeded Admin role. Mirrors the idempotent array-with-uniqueness
-- pattern from 20260426000000_grant_user_impersonate so re-running this
-- migration is safe.
UPDATE "vibe_stack"."Role"
SET "capabilities" = ARRAY(
  SELECT DISTINCT unnest("capabilities" || ARRAY['feature_flag.read', 'feature_flag.manage']::TEXT[])
)
WHERE "id" = 'role_admin';
