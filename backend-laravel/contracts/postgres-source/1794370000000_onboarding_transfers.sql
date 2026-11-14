CREATE TABLE IF NOT EXISTS onboarding_transfers (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 submission_id uuid NOT NULL,
 plan text NOT NULL,
 amount_toman integer NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz,
 bank_reference text UNIQUE,
 sms_status text NOT NULL DEFAULT 'pending'
);
