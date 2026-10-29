-- Up Migration

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted'));
ALTER TABLE users ADD COLUMN deleted_at timestamptz;

CREATE OR REPLACE FUNCTION reject_submission_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('sabzine.anonymize', true) = 'on' THEN
    IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'questionnaire submission is immutable';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'questionnaire submission is immutable';
END;
$$ LANGUAGE plpgsql;

ALTER TABLE questionnaire_schemas
  ADD COLUMN status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'retired'));

CREATE UNIQUE INDEX questionnaire_one_published
  ON questionnaire_schemas (status)
  WHERE status = 'published';

CREATE TABLE devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  session_id uuid REFERENCES sessions (id),
  platform text NOT NULL,
  push_token text NOT NULL UNIQUE,
  provider text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX devices_user ON devices (user_id) WHERE revoked_at IS NULL;

CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES devices (id),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_totp (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  secret_encrypted text NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE totp_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  device_label text,
  platform text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meal_log_anomalies (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  scheduled_date date NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheduled_date, kind)
);

-- Down Migration

DROP TABLE IF EXISTS meal_log_anomalies;
DROP TABLE IF EXISTS totp_challenges;
DROP TABLE IF EXISTS staff_totp;
DROP TABLE IF EXISTS push_deliveries;
DROP TABLE IF EXISTS devices;
DROP INDEX IF EXISTS questionnaire_one_published;
ALTER TABLE questionnaire_schemas DROP COLUMN IF EXISTS status;
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended'));

CREATE OR REPLACE FUNCTION reject_submission_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'questionnaire submission is immutable';
END;
$$ LANGUAGE plpgsql;
