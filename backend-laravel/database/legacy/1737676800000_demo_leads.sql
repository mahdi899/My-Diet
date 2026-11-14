-- Up Migration
CREATE TABLE demo_lead_submissions (
 id uuid PRIMARY KEY,
 phone_hash text NOT NULL,
 phone_encrypted text NOT NULL,
 goal text NOT NULL CHECK(goal IN ('weight_loss','weight_gain','pregnancy','detox')),
 answers_encrypted text NOT NULL,
 phone_verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_lead_phone_idx ON demo_lead_submissions(phone_hash,created_at DESC);
-- Down Migration
DROP TABLE demo_lead_submissions;
