-- Up Migration
CREATE TABLE shopping_projections (
 user_id uuid NOT NULL REFERENCES users(id),projection_key text NOT NULL,week_start date NOT NULL,
 revision integer NOT NULL DEFAULT 1,source_hash text NOT NULL,document jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,projection_key)
);
CREATE TABLE shopping_flags (
 user_id uuid NOT NULL REFERENCES users(id),week_start date NOT NULL,ingredient_key text NOT NULL,
 already_have boolean NOT NULL DEFAULT false,purchased boolean NOT NULL DEFAULT false,
 quantity numeric,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,week_start,ingredient_key)
);
-- Down Migration
DROP TABLE shopping_flags;
DROP TABLE shopping_projections;
