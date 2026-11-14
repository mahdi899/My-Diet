-- Up Migration

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 120),
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX outbox_events_pending
  ON outbox_events (created_at)
  WHERE dispatched_at IS NULL;

INSERT INTO app_settings (key, value) VALUES
  ('meal_log.grace_minutes', '0'::jsonb),
  ('reward.weekly_completion_toman', '200000'::jsonb);

-- Down Migration

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS app_settings;
