-- Grant the new `user.invite.issue` capability to the seeded Admin role.
-- Idempotent: array_append would dup; use the array-with-uniqueness pattern
-- so re-running this migration is safe.
UPDATE "vibe_stack"."Role"
SET "capabilities" = ARRAY(
  SELECT DISTINCT unnest("capabilities" || ARRAY['user.invite.issue']::TEXT[])
)
WHERE "id" = 'role_admin';
