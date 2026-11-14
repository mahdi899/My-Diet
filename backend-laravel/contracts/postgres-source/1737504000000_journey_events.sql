-- Up Migration
CREATE TABLE journey_installs (
  id uuid PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  linked_user_id uuid REFERENCES users (id),
  linked_at timestamptz,
  CONSTRAINT journey_installs_link_pair CHECK ((linked_user_id IS NULL) = (linked_at IS NULL))
);

CREATE TABLE journey_sessions (
  id uuid PRIMARY KEY,
  install_id uuid NOT NULL REFERENCES journey_installs (id),
  user_id uuid REFERENCES users (id),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  app_version text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('first_visit', 'returning')),
  first_authenticated boolean NOT NULL,
  gapped boolean NOT NULL DEFAULT false,
  started_on date NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journey_sessions_report ON journey_sessions (started_on, session_type);

CREATE TABLE journey_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES journey_sessions (id),
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  properties jsonb NOT NULL,
  payload_hash text NOT NULL
);

CREATE INDEX journey_events_session ON journey_events (session_id, occurred_at);

CREATE TABLE journey_batches (
  id uuid PRIMARY KEY,
  install_id uuid NOT NULL REFERENCES journey_installs (id),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journey_batches_install ON journey_batches (install_id, received_at DESC);

-- Down Migration
DROP TABLE journey_batches;
DROP TABLE journey_events;
DROP TABLE journey_sessions;
DROP TABLE journey_installs;
