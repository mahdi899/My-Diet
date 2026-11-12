-- Up Migration
-- Phone is stored only after OTP verification, keyed by the anonymous onboarding path.
CREATE TABLE onboarding_analytics_journeys (
  journey_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_analytics_journeys_user_idx ON onboarding_analytics_journeys(user_id);

-- Down Migration
DROP TABLE onboarding_analytics_journeys;
