-- Up Migration
ALTER TABLE users
  ADD COLUMN signup_channel text NOT NULL DEFAULT 'app';

CREATE TABLE user_service_access (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  service_code text NOT NULL REFERENCES services (code),
  ends_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE user_service_access;
ALTER TABLE users DROP COLUMN signup_channel;
