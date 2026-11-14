-- Up Migration
CREATE TABLE plan_change_reasons (
  id text PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
INSERT INTO plan_change_reasons (id, label) VALUES
  ('schedule', 'زمان وعده‌ها مناسب نیست'),
  ('budget', 'هزینه برنامه زیاد است'),
  ('preference', 'با ذائقه جور نیست'),
  ('availability', 'مواد اولیه در دسترس نیست');

CREATE TABLE plan_change_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  plan_request_id uuid NOT NULL REFERENCES plan_requests (id),
  version_id uuid NOT NULL REFERENCES plan_versions (id),
  command_id uuid NOT NULL,
  explanation text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('awaiting_review', 'under_review', 'rejected', 'approved')),
  substate text NOT NULL DEFAULT 'none' CHECK (substate IN ('none', 'awaiting_clarification')),
  rejection_explanation text,
  published_version_id uuid REFERENCES plan_versions (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, command_id),
  CHECK (char_length(explanation) <= 2000),
  CHECK (status <> 'rejected' OR char_length(coalesce(rejection_explanation, '')) > 0),
  CHECK (status <> 'approved' OR published_version_id IS NOT NULL)
);
CREATE UNIQUE INDEX plan_changes_one_open ON plan_change_requests (user_id)
  WHERE status IN ('awaiting_review', 'under_review');

CREATE TABLE plan_change_reason_snapshots (
  request_id uuid NOT NULL REFERENCES plan_change_requests (id),
  reason_id text NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (request_id, reason_id)
);

CREATE TABLE plan_change_targets (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_change_requests (id),
  day_index integer NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  meal_uid uuid,
  UNIQUE NULLS NOT DISTINCT (request_id, day_index, meal_uid)
);

CREATE TABLE plan_change_questions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_change_requests (id),
  prompt text NOT NULL,
  answer text,
  status text NOT NULL CHECK (status IN ('open', 'answered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(prompt) <= 1000),
  CHECK (answer IS NULL OR char_length(answer) <= 2000)
);
CREATE UNIQUE INDEX plan_change_one_open_question ON plan_change_questions (request_id)
  WHERE status = 'open';

ALTER TABLE messages ADD COLUMN change_request_id uuid REFERENCES plan_change_requests (id);

-- Down Migration
ALTER TABLE messages DROP COLUMN change_request_id;
DROP TABLE plan_change_questions;
DROP TABLE plan_change_targets;
DROP TABLE plan_change_reason_snapshots;
DROP TABLE plan_change_requests;
DROP TABLE plan_change_reasons;
