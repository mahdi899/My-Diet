-- Up Migration
-- Server-side onboarding drafts: one row per user, optimistic version, clinical text sealed by the app layer.
CREATE TABLE onboarding_drafts (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  spec_version integer NOT NULL,
  track text CHECK (track IN ('weight_loss', 'weight_gain', 'pregnancy', 'detox')),
  answers jsonb NOT NULL DEFAULT '{}',
  step_key text,
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'demo')),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_drafts_updated ON onboarding_drafts (updated_at);

-- Current typed profile used by plan generation and by admin filters (one row per user).
CREATE TABLE nutrition_profiles (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  submission_id uuid NOT NULL REFERENCES questionnaire_submissions (id),
  spec_version integer NOT NULL,
  track text NOT NULL CHECK (track IN ('weight_loss', 'weight_gain', 'pregnancy', 'detox')),
  goal text NOT NULL,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'demo')),
  sex text NOT NULL,
  age smallint NOT NULL,
  height_cm numeric(4, 1) NOT NULL,
  weight_kg numeric(5, 2) NOT NULL,
  target_weight_kg numeric(5, 2),
  activity text NOT NULL,
  bmi numeric(4, 1) NOT NULL,
  bmr_kcal integer NOT NULL,
  tdee_kcal integer NOT NULL,
  target_kcal integer NOT NULL,
  protein_g integer NOT NULL,
  carbs_g integer NOT NULL,
  fat_g integer NOT NULL,
  diet_style text NOT NULL,
  meals_per_day smallint,
  budget text NOT NULL,
  region text,
  allergens text[] NOT NULL DEFAULT '{}',
  conditions text[] NOT NULL DEFAULT '{}',
  risk_flags text[] NOT NULL DEFAULT '{}',
  safety_tier text NOT NULL CHECK (safety_tier IN ('ai_ok', 'doctor_only')),
  safety_reasons text[] NOT NULL DEFAULT '{}',
  preferences jsonb NOT NULL DEFAULT '{}',
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_profiles_track ON nutrition_profiles (track, updated_at DESC);
CREATE INDEX nutrition_profiles_goal ON nutrition_profiles (goal);
CREATE INDEX nutrition_profiles_allergens ON nutrition_profiles USING gin (allergens);
CREATE INDEX nutrition_profiles_conditions ON nutrition_profiles USING gin (conditions);
CREATE INDEX nutrition_profiles_flags ON nutrition_profiles USING gin (risk_flags);
CREATE INDEX nutrition_profiles_doctor_only ON nutrition_profiles (updated_at DESC) WHERE safety_tier <> 'ai_ok';
CREATE INDEX nutrition_profiles_source ON nutrition_profiles (source, updated_at DESC);

CREATE TABLE nutrition_profile_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  submission_id uuid NOT NULL REFERENCES questionnaire_submissions (id),
  weight_kg numeric(5, 2) NOT NULL,
  target_kcal integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nutrition_profile_history_user ON nutrition_profile_history (user_id, created_at DESC);

-- Normalised answers for segmentation and funnels. Free text never goes here.
CREATE TABLE onboarding_answer_facts (
  submission_id uuid NOT NULL REFERENCES questionnaire_submissions (id),
  question_key text NOT NULL,
  value_code text NOT NULL DEFAULT '',
  value_num numeric,
  PRIMARY KEY (submission_id, question_key, value_code)
);
CREATE INDEX onboarding_answer_facts_key_code ON onboarding_answer_facts (question_key, value_code);
CREATE INDEX onboarding_answer_facts_key_num ON onboarding_answer_facts (question_key, value_num) WHERE value_num IS NOT NULL;

ALTER TABLE demo_lead_submissions
  ADD COLUMN claimed_user_id uuid REFERENCES users (id),
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN spec_version smallint;
CREATE INDEX demo_lead_unclaimed ON demo_lead_submissions (phone_hash, created_at DESC) WHERE claimed_user_id IS NULL;
CREATE INDEX demo_lead_claimed ON demo_lead_submissions (claimed_user_id) WHERE claimed_user_id IS NOT NULL;

-- Daily funnel numbers; refreshed by the maintenance pass and on demand from the admin panel.
CREATE MATERIALIZED VIEW mv_onboarding_daily AS
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Tehran')::date AS day,
       track,
       source,
       count(*)::int AS profiles,
       round(avg(bmi), 1) AS avg_bmi,
       count(*) FILTER (WHERE safety_tier <> 'ai_ok')::int AS doctor_only
FROM nutrition_profiles
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX mv_onboarding_daily_key ON mv_onboarding_daily (day, track, source);

-- Down Migration
DROP MATERIALIZED VIEW mv_onboarding_daily;
DROP INDEX demo_lead_claimed;
DROP INDEX demo_lead_unclaimed;
ALTER TABLE demo_lead_submissions DROP COLUMN spec_version, DROP COLUMN claimed_at, DROP COLUMN claimed_user_id;
DROP TABLE onboarding_answer_facts;
DROP TABLE nutrition_profile_history;
DROP TABLE nutrition_profiles;
DROP TABLE onboarding_drafts;
