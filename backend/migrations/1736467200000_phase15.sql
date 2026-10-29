-- Up Migration

CREATE TABLE daily_messages (
  civil_date date PRIMARY KEY,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS daily_messages;
