-- Adds a generated tsvector column on File.filename for full-text search.
-- Generated columns stay in sync automatically; no triggers needed.
ALTER TABLE "vibe_stack"."File"
  ADD COLUMN "searchable" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "filename")) STORED;

CREATE INDEX "File_searchable_idx"
  ON "vibe_stack"."File"
  USING GIN ("searchable");
