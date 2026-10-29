-- Up Migration

ALTER TABLE ai_generations
  ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Down Migration

ALTER TABLE ai_generations DROP COLUMN IF EXISTS warnings;
