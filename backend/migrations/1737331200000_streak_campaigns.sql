-- Up Migration
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_kind_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_kind_check CHECK (kind IN (
  'topup', 'order_debit', 'weekly_reward', 'refund', 'adjustment', 'campaign_reward', 'campaign_reversal'
));

CREATE TABLE streak_campaigns (
  id uuid PRIMARY KEY,
  version integer NOT NULL UNIQUE,
  consecutive_days integer NOT NULL CHECK (consecutive_days BETWEEN 1 AND 30),
  qualifying_rule text NOT NULL CHECK (qualifying_rule = 'recorded_meals'),
  starts_on date NOT NULL,
  ends_on date,
  effective_on date NOT NULL,
  repeat text NOT NULL CHECK (repeat IN ('cycle', 'none')),
  participant_policy text NOT NULL CHECK (participant_policy = 'finish_current_version'),
  published_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE TABLE streak_milestones (
  campaign_id uuid NOT NULL REFERENCES streak_campaigns (id),
  day_index integer NOT NULL CHECK (day_index >= 1),
  amount_toman bigint NOT NULL CHECK (amount_toman >= 0),
  PRIMARY KEY (campaign_id, day_index)
);
INSERT INTO streak_campaigns (id, version, consecutive_days, qualifying_rule, starts_on, effective_on, repeat, participant_policy)
VALUES ('019a0000-0000-7000-8000-000000000009', 1, 7, 'recorded_meals', '2026-10-24', '2026-10-24', 'cycle', 'finish_current_version');
INSERT INTO streak_milestones (campaign_id, day_index, amount_toman)
VALUES ('019a0000-0000-7000-8000-000000000009', 7, 200000);

CREATE TABLE streak_participations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  campaign_id uuid NOT NULL REFERENCES streak_campaigns (id),
  cycle_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cycle_start)
);
CREATE TABLE streak_grants (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  participation_id uuid NOT NULL REFERENCES streak_participations (id),
  milestone_day integer NOT NULL,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  status text NOT NULL CHECK (status IN ('issued', 'held', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participation_id, milestone_day)
);
CREATE TABLE streak_claims (
  user_id uuid NOT NULL REFERENCES users (id),
  command_id uuid NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, command_id)
);
CREATE TABLE streak_signals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  civil_date date NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, civil_date, kind)
);

-- Down Migration
DROP TABLE streak_signals;
DROP TABLE streak_claims;
DROP TABLE streak_grants;
DROP TABLE streak_participations;
DROP TABLE streak_milestones;
DROP TABLE streak_campaigns;
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_kind_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_kind_check CHECK (kind IN (
  'topup', 'order_debit', 'weekly_reward', 'refund', 'adjustment'
));
