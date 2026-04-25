-- Migrate from User.role enum (USER|ADMIN) to a Role table with String[] of
-- capability codes. Existing users are mapped to seeded system roles
-- (role_admin / role_user) by their old enum value.

-- 1. Free up the name "Role" so we can use it for the new table.
ALTER TYPE "vibe_stack"."Role" RENAME TO "Role_old";

-- 2. Create the Role table.
CREATE TABLE "vibe_stack"."Role" (
    "id" TEXT NOT NULL,
    "name" public.citext NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "vibe_stack"."Role"("name");

-- 3. Seed the two system roles.
--    Admin starts with every capability defined in the catalogue at the time
--    of this migration. Future capabilities ship with their own data
--    migrations that grant them to role_admin.
INSERT INTO "vibe_stack"."Role" ("id", "name", "description", "is_system", "capabilities", "updatedAt")
VALUES
  (
    'role_admin',
    'Admin',
    'Full administrative access. System role; cannot be deleted.',
    true,
    ARRAY[
      'admin.access',
      'user.list',
      'user.update',
      'user.delete',
      'user.role.assign',
      'rbac.role.create',
      'rbac.role.update',
      'rbac.role.delete',
      'audit.read',
      'notification.broadcast',
      'file.upload',
      'file.read.any',
      'file.delete.any'
    ]::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'role_user',
    'User',
    'Default baseline access. System role; cannot be deleted.',
    true,
    ARRAY[]::TEXT[],
    CURRENT_TIMESTAMP
  );

-- 4. Add the FK column nullable so we can backfill.
ALTER TABLE "vibe_stack"."User" ADD COLUMN "role_id" TEXT;

-- 5. Backfill from the old enum value.
UPDATE "vibe_stack"."User"
SET "role_id" = CASE WHEN "role"::text = 'ADMIN' THEN 'role_admin' ELSE 'role_user' END;

-- 6. Make NOT NULL + add FK.
ALTER TABLE "vibe_stack"."User" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "vibe_stack"."User"
    ADD CONSTRAINT "User_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "vibe_stack"."Role"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Index.
CREATE INDEX "User_roleId_idx" ON "vibe_stack"."User"("role_id");

-- 8. Drop the old enum column + the renamed enum type.
ALTER TABLE "vibe_stack"."User" DROP COLUMN "role";
DROP TYPE "vibe_stack"."Role_old";
