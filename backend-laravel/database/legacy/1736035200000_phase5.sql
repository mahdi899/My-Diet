-- Up Migration

ALTER TABLE ai_generations
  ADD COLUMN attempt_no integer NOT NULL DEFAULT 1,
  ADD COLUMN model text NOT NULL DEFAULT '',
  ADD COLUMN prompt_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN schema_version integer,
  ADD COLUMN tokens integer NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  ADD COLUMN latency_ms integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  ADD COLUMN cost_micros bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0);

UPDATE ai_generations AS generation
SET attempt_no = numbered.n
FROM (
  SELECT id, row_number() OVER (PARTITION BY request_id ORDER BY created_at, id) AS n
  FROM ai_generations
) AS numbered
WHERE generation.id = numbered.id;

ALTER TABLE ai_generations
  ADD CONSTRAINT ai_generations_request_attempt UNIQUE (request_id, attempt_no);

CREATE TABLE ai_controls (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  kill_switch boolean NOT NULL DEFAULT false,
  daily_cost_cap_micros bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_controls_cap CHECK (daily_cost_cap_micros IS NULL OR daily_cost_cap_micros >= 0)
);

INSERT INTO ai_controls (id, kill_switch) VALUES (true, false);

-- Down Migration

DROP TABLE IF EXISTS ai_controls;
ALTER TABLE ai_generations DROP CONSTRAINT IF EXISTS ai_generations_request_attempt;
ALTER TABLE ai_generations
  DROP COLUMN IF EXISTS attempt_no,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS prompt_version,
  DROP COLUMN IF EXISTS schema_version,
  DROP COLUMN IF EXISTS tokens,
  DROP COLUMN IF EXISTS latency_ms,
  DROP COLUMN IF EXISTS cost_micros;
