-- Up Migration
ALTER TABLE food_catalog ADD COLUMN nutrition jsonb;
CREATE TABLE food_catalog_replacements (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  previous_foods jsonb NOT NULL,
  replacement_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE food_catalog_replacements;
ALTER TABLE food_catalog DROP COLUMN nutrition;
