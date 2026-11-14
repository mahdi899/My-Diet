-- Up Migration

CREATE TABLE users (
  id uuid PRIMARY KEY,
  phone_e164 text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('user', 'specialist', 'admin')),
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY,
  phone_e164 text NOT NULL,
  code_hmac text NOT NULL,
  ip text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  superseded_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_challenges_phone_created ON otp_challenges (phone_e164, created_at DESC);
CREATE INDEX otp_challenges_ip_created ON otp_challenges (ip, created_at DESC);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  platform text,
  device_label text,
  last_seen_at timestamptz,
  CONSTRAINT sessions_fixed_lifetime CHECK (absolute_expires_at = created_at + interval '30 days')
);

CREATE INDEX sessions_user ON sessions (user_id, created_at DESC);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions (id),
  token_hash text NOT NULL UNIQUE,
  parent_id uuid REFERENCES refresh_tokens (id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE FUNCTION refresh_matches_session() RETURNS trigger AS $$
DECLARE
  session_expiry timestamptz;
BEGIN
  SELECT absolute_expires_at INTO session_expiry FROM sessions WHERE id = NEW.session_id;
  IF session_expiry IS NULL OR NEW.expires_at <> session_expiry THEN
    RAISE EXCEPTION 'refresh token cannot extend the session';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_tokens_match_session
  BEFORE INSERT ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION refresh_matches_session();

CREATE TABLE questionnaire_schemas (
  version integer PRIMARY KEY,
  document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questionnaire_drafts (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  schema_version integer NOT NULL REFERENCES questionnaire_schemas (version),
  answers jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questionnaire_submissions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  schema_version integer NOT NULL REFERENCES questionnaire_schemas (version),
  answers jsonb NOT NULL,
  risk_flags text[] NOT NULL DEFAULT '{}',
  bmi numeric,
  pregnancy_as_of date,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX questionnaire_submissions_user
  ON questionnaire_submissions (user_id, submitted_at DESC);

CREATE FUNCTION reject_submission_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'questionnaire submission is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questionnaire_submissions_immutable
  BEFORE UPDATE OR DELETE ON questionnaire_submissions
  FOR EACH ROW EXECUTE FUNCTION reject_submission_change();

CREATE TABLE services (
  code text PRIMARY KEY,
  title_fa text NOT NULL
);

CREATE TABLE service_prices (
  id uuid PRIMARY KEY,
  service_code text NOT NULL REFERENCES services (code),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  effective_from timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_prices_current ON service_prices (service_code, effective_from DESC);

CREATE TABLE topup_packages (
  code text PRIMARY KEY,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE wallets (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  cash_toman bigint NOT NULL DEFAULT 0 CHECK (cash_toman >= 0),
  promo_toman bigint NOT NULL DEFAULT 0 CHECK (promo_toman >= 0),
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE wallet_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  bucket text NOT NULL CHECK (bucket IN ('cash', 'promo')),
  amount_toman bigint NOT NULL CHECK (amount_toman <> 0),
  kind text NOT NULL CHECK (kind IN ('topup', 'order_debit', 'weekly_reward', 'refund', 'adjustment')),
  reference_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, reference_id, bucket)
);

CREATE INDEX wallet_ledger_user ON wallet_ledger (user_id, created_at DESC);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_ledger_immutable
  BEFORE UPDATE OR DELETE ON wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  package_code text NOT NULL REFERENCES topup_packages (code),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  amount_rial bigint NOT NULL CHECK (amount_rial > 0),
  status text NOT NULL CHECK (status IN ('pending', 'credited', 'failed')),
  gateway text NOT NULL,
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION protect_payment_amount() RETURNS trigger AS $$
BEGIN
  IF NEW.amount_toman <> OLD.amount_toman
     OR NEW.amount_rial <> OLD.amount_rial
     OR NEW.user_id <> OLD.user_id
     OR NEW.package_code <> OLD.package_code THEN
    RAISE EXCEPTION 'payment amount is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_amount_immutable
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION protect_payment_amount();

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  service_code text NOT NULL REFERENCES services (code),
  price_toman bigint NOT NULL CHECK (price_toman > 0),
  cash_toman bigint NOT NULL CHECK (cash_toman >= 0),
  promo_toman bigint NOT NULL CHECK (promo_toman >= 0),
  status text NOT NULL CHECK (status IN ('paid', 'refunded')),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE plan_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  order_id uuid NOT NULL UNIQUE REFERENCES orders (id),
  kind text NOT NULL CHECK (kind IN ('new_plan', 'ai_revision', 'specialist_revision')),
  status text NOT NULL CHECK (status IN (
    'queued', 'generating', 'in_review', 'awaiting_user', 'response_received', 'published', 'cancelled'
  )),
  submission_id uuid NOT NULL REFERENCES questionnaire_submissions (id),
  assigned_specialist_id uuid REFERENCES users (id),
  parent_request_id uuid REFERENCES plan_requests (id),
  week_start date,
  effective_from date,
  price_toman bigint NOT NULL CHECK (price_toman > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_requests_user ON plan_requests (user_id, created_at DESC);
CREATE INDEX plan_requests_specialist ON plan_requests (assigned_specialist_id, status);

CREATE TABLE request_events (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  actor_id uuid REFERENCES users (id),
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plan_versions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  version_number integer NOT NULL CHECK (version_number >= 1),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'superseded')),
  lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version >= 1),
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (request_id, version_number)
);

CREATE FUNCTION protect_plan_version() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'published'
     AND NEW.status = 'superseded'
     AND NEW.request_id = OLD.request_id
     AND NEW.version_number = OLD.version_number
     AND NEW.lock_version = OLD.lock_version
     AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'plan version is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_versions_immutable
  BEFORE UPDATE ON plan_versions
  FOR EACH ROW EXECUTE FUNCTION protect_plan_version();

CREATE TABLE plan_days (
  id uuid PRIMARY KEY,
  plan_version_id uuid NOT NULL REFERENCES plan_versions (id),
  day_index integer NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  civil_date date,
  UNIQUE (plan_version_id, day_index)
);

CREATE FUNCTION reject_non_draft_day() RETURNS trigger AS $$
DECLARE
  st text;
BEGIN
  SELECT status INTO st FROM plan_versions WHERE id = COALESCE(NEW.plan_version_id, OLD.plan_version_id);
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'plan content is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_days_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON plan_days
  FOR EACH ROW EXECUTE FUNCTION reject_non_draft_day();

CREATE TABLE plan_meals (
  id uuid PRIMARY KEY,
  plan_day_id uuid NOT NULL REFERENCES plan_days (id),
  meal_uid uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  meal_type text NOT NULL,
  suggested_time text,
  title text NOT NULL,
  calories integer NOT NULL CHECK (calories >= 0),
  notes text NOT NULL DEFAULT '',
  UNIQUE (plan_day_id, position)
);

CREATE FUNCTION reject_non_draft_meal() RETURNS trigger AS $$
DECLARE
  st text;
  day_id uuid;
BEGIN
  day_id := COALESCE(NEW.plan_day_id, OLD.plan_day_id);
  SELECT v.status INTO st
  FROM plan_days d
  JOIN plan_versions v ON v.id = d.plan_version_id
  WHERE d.id = day_id;
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'plan content is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_meals_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON plan_meals
  FOR EACH ROW EXECUTE FUNCTION reject_non_draft_meal();

CREATE TABLE plan_meal_items (
  id uuid PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES plan_meals (id),
  position integer NOT NULL CHECK (position >= 0),
  name text NOT NULL,
  quantity numeric,
  unit text,
  UNIQUE (meal_id, position)
);

CREATE FUNCTION reject_non_draft_item() RETURNS trigger AS $$
DECLARE
  st text;
  parent_id uuid;
BEGIN
  parent_id := COALESCE(NEW.meal_id, OLD.meal_id);
  SELECT v.status INTO st
  FROM plan_meals m
  JOIN plan_days d ON d.id = m.plan_day_id
  JOIN plan_versions v ON v.id = d.plan_version_id
  WHERE m.id = parent_id;
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'plan content is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_meal_items_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON plan_meal_items
  FOR EACH ROW EXECUTE FUNCTION reject_non_draft_item();

CREATE TABLE info_questions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  specialist_id uuid NOT NULL REFERENCES users (id),
  prompt text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('open', 'answered', 'acknowledged')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX info_questions_request ON info_questions (request_id, created_at);

CREATE TABLE info_answers (
  id uuid PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES info_questions (id),
  author_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_generations (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('drafted', 'skipped', 'failed')),
  skipped_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE specialist_profiles (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  display_name text NOT NULL,
  credential text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 20 CHECK (capacity >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('care', 'support')),
  user_id uuid NOT NULL REFERENCES users (id),
  request_id uuid REFERENCES plan_requests (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations (id),
  user_id uuid NOT NULL REFERENCES users (id),
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations (id),
  author_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE meal_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  scheduled_date date NOT NULL,
  meal_uid uuid NOT NULL,
  eaten boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheduled_date, meal_uid)
);

CREATE TABLE weight_entries (
  user_id uuid NOT NULL REFERENCES users (id),
  civil_date date NOT NULL,
  kilograms numeric NOT NULL CHECK (kilograms > 0),
  PRIMARY KEY (user_id, civil_date)
);

CREATE TABLE reward_policies (
  id uuid PRIMARY KEY,
  kind text NOT NULL UNIQUE,
  amount_toman bigint NOT NULL CHECK (amount_toman >= 0),
  active boolean NOT NULL DEFAULT false
);

CREATE TABLE weekly_rewards (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  week_start date NOT NULL,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE FUNCTION reject_reward_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'weekly reward is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_rewards_immutable
  BEFORE UPDATE OR DELETE ON weekly_rewards
  FOR EACH ROW EXECUTE FUNCTION reject_reward_change();

CREATE TABLE program_reviews (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  week_start date NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id, week_start)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL,
  payload jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users (id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_access_logs (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES users (id),
  request_id uuid NOT NULL REFERENCES plan_requests (id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO questionnaire_schemas (version, document) VALUES (
  1,
  '{"version":1,"questions":["name","age","sex","heightCm","weightKg","goal","lifeStage","pregnancyWeek","prePregnancyWeightKg","babies","nursingAge","targetWeightKg","previousDiet","health","healthDetails","allergies","medicines","activity","exercise","sleep","mealPattern","water","preference","budget","cooking","dislikes"]}'::jsonb
);

INSERT INTO services (code, title_fa) VALUES
  ('new_plan', 'برنامهٔ غذایی جدید'),
  ('ai_revision', 'اصلاح برنامه با هوش مصنوعی'),
  ('specialist_revision', 'اصلاح برنامه توسط متخصص');

INSERT INTO service_prices (id, service_code, amount_toman) VALUES
  ('10000000-0000-4000-8000-000000000001', 'new_plan', 500000),
  ('10000000-0000-4000-8000-000000000002', 'ai_revision', 150000),
  ('10000000-0000-4000-8000-000000000003', 'specialist_revision', 250000);

INSERT INTO topup_packages (code, amount_toman) VALUES
  ('p50', 200000),
  ('p200', 500000),
  ('p300', 800000),
  ('p500', 1000000);

INSERT INTO reward_policies (id, kind, amount_toman, active) VALUES
  ('10000000-0000-4000-8000-000000000010', 'weekly_completion', 200000, true),
  ('10000000-0000-4000-8000-000000000011', 'signup_bonus', 0, false);

-- Down Migration

DROP TABLE IF EXISTS health_access_logs;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS program_reviews;
DROP TABLE IF EXISTS weekly_rewards;
DROP TABLE IF EXISTS reward_policies;
DROP TABLE IF EXISTS weight_entries;
DROP TABLE IF EXISTS meal_logs;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS specialist_profiles;
DROP TABLE IF EXISTS ai_generations;
DROP TABLE IF EXISTS info_answers;
DROP TABLE IF EXISTS info_questions;
DROP TABLE IF EXISTS plan_meal_items;
DROP TABLE IF EXISTS plan_meals;
DROP TABLE IF EXISTS plan_days;
DROP TABLE IF EXISTS plan_versions;
DROP TABLE IF EXISTS request_events;
DROP TABLE IF EXISTS plan_requests;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS idempotency_records;
DROP TABLE IF EXISTS wallet_ledger;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS topup_packages;
DROP TABLE IF EXISTS service_prices;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS questionnaire_submissions;
DROP TABLE IF EXISTS questionnaire_drafts;
DROP TABLE IF EXISTS questionnaire_schemas;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS reject_reward_change();
DROP FUNCTION IF EXISTS reject_non_draft_item();
DROP FUNCTION IF EXISTS reject_non_draft_meal();
DROP FUNCTION IF EXISTS reject_non_draft_day();
DROP FUNCTION IF EXISTS protect_plan_version();
DROP FUNCTION IF EXISTS protect_payment_amount();
DROP FUNCTION IF EXISTS reject_ledger_mutation();
DROP FUNCTION IF EXISTS reject_submission_change();
DROP FUNCTION IF EXISTS refresh_matches_session();
