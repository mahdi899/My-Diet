-- Up Migration

CREATE TABLE specialist_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz
);

-- Down Migration

DROP TABLE IF EXISTS specialist_credentials;
