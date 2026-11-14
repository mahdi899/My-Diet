-- Up Migration
-- AI nutrition coach («مربی تغذیه»): one thread per user, typed messages, memory, food entries, usage.

CREATE TABLE coach_threads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users (id),
  summary text NOT NULL DEFAULT '',
  summary_upto_seq bigint NOT NULL DEFAULT 0,
  day_brief_date date,
  last_message_at timestamptz,
  -- One model turn per user at a time; a crashed turn frees itself when this passes.
  turn_lock_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Photos sent to the coach. Kept apart from conversation media because they belong to no human conversation.
CREATE TABLE coach_media (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_media_user ON coach_media (user_id, created_at DESC);

CREATE TABLE coach_messages (
  id uuid PRIMARY KEY,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  thread_id uuid NOT NULL REFERENCES coach_threads (id),
  user_id uuid NOT NULL REFERENCES users (id),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  fallback_text text NOT NULL DEFAULT '',
  client_message_id uuid,
  reply_to uuid REFERENCES coach_messages (id),
  model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coach_messages_client ON coach_messages (thread_id, client_message_id) WHERE client_message_id IS NOT NULL;
CREATE INDEX coach_messages_thread_seq ON coach_messages (thread_id, seq DESC);
CREATE INDEX coach_messages_reply ON coach_messages (reply_to) WHERE reply_to IS NOT NULL;

CREATE TABLE coach_memory (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL CHECK (kind IN ('preference', 'dislike', 'allergy_note', 'habit', 'goal', 'schedule', 'health_note', 'other')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 3 AND 300),
  source text NOT NULL CHECK (source IN ('tool', 'extractor', 'user')),
  importance smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  archived_at timestamptz
);
CREATE UNIQUE INDEX coach_memory_unique ON coach_memory (user_id, md5(content)) WHERE archived_at IS NULL;
CREATE INDEX coach_memory_user ON coach_memory (user_id, importance DESC, created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE coach_food_entries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  thread_id uuid REFERENCES coach_threads (id),
  message_id uuid REFERENCES coach_messages (id),
  media_id uuid REFERENCES coach_media (id),
  civil_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  title text NOT NULL,
  source text NOT NULL CHECK (source IN ('photo', 'suggestion', 'manual')),
  items jsonb NOT NULL,
  totals jsonb NOT NULL,
  confidence numeric(3, 2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'logged')),
  plan_meal_uid uuid,
  logged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_food_entries_day ON coach_food_entries (user_id, civil_date, status);
CREATE INDEX coach_food_entries_media ON coach_food_entries (media_id) WHERE media_id IS NOT NULL;

CREATE TABLE coach_water (
  user_id uuid NOT NULL REFERENCES users (id),
  civil_date date NOT NULL,
  ml integer NOT NULL DEFAULT 0 CHECK (ml >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, civil_date)
);

-- Append-only event log: proactive sends, target changes, planned next steps, milestones.
CREATE TABLE coach_engagement (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL,
  day date NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  -- Makes a proactive send / milestone / follow-up happen once even when two workers race.
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coach_engagement_dedupe ON coach_engagement (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX coach_engagement_user ON coach_engagement (user_id, kind, created_at DESC);
CREATE INDEX coach_engagement_day ON coach_engagement (user_id, day);

CREATE TABLE coach_usage (
  user_id uuid NOT NULL REFERENCES users (id),
  day date NOT NULL,
  chat_turns integer NOT NULL DEFAULT 0,
  vision_calls integer NOT NULL DEFAULT 0,
  tokens_in bigint NOT NULL DEFAULT 0,
  tokens_out bigint NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

-- Pools editable in the admin AI center. Members are chosen by the admin (the model must support tools; vision needs images).
INSERT INTO ai_pools (id, code, title, temperature, max_tokens, timeout_ms, max_attempts) VALUES
  (gen_random_uuid(), 'nutrition_coach', 'مربی تغذیه (گفتگو)', 0.5, 1200, 60000, 3),
  (gen_random_uuid(), 'nutrition_vision', 'مربی تغذیه (تحلیل عکس غذا)', 0.2, 1200, 60000, 3),
  (gen_random_uuid(), 'coach_memory', 'مربی تغذیه (حافظه و خلاصه)', 0.1, 700, 30000, 2)
ON CONFLICT (code) DO NOTHING;

-- Down Migration
DELETE FROM ai_pools WHERE code IN ('nutrition_coach', 'nutrition_vision', 'coach_memory');
DROP TABLE coach_usage;
DROP TABLE coach_engagement;
DROP TABLE coach_water;
DROP TABLE coach_food_entries;
DROP TABLE coach_memory;
DROP TABLE coach_messages;
DROP TABLE coach_media;
DROP TABLE coach_threads;
