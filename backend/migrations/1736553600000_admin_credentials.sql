-- Up Migration
CREATE TABLE admin_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 username text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 failed_attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz
);
-- Down Migration
DROP TABLE admin_credentials;
