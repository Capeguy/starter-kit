-- CreateExtension. WITH SCHEMA public so the type lives in a known place
-- regardless of which app schema (`vibe_stack`, `vibe_stack_2`, …) is the
-- current search_path. References below are public.citext-qualified for the
-- same reason — Prisma's migrate runs with `search_path = <schema>` only.
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA public;

-- AlterTable
ALTER TABLE "vibe_stack"."User" ALTER COLUMN "name" SET DATA TYPE public.citext;

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "vibe_stack"."User"("name");

