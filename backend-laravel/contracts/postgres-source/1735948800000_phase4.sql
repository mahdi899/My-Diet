-- Up Migration

ALTER TABLE ai_generations ADD COLUMN raw_output text;

-- Down Migration

ALTER TABLE ai_generations DROP COLUMN IF EXISTS raw_output;
