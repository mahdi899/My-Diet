-- Up Migration

ALTER TABLE weekly_rewards
  ADD COLUMN acknowledged_at timestamptz;

CREATE OR REPLACE FUNCTION reject_reward_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'weekly reward is immutable';
  END IF;
  IF NEW.id <> OLD.id
     OR NEW.user_id <> OLD.user_id
     OR NEW.request_id <> OLD.request_id
     OR NEW.week_start <> OLD.week_start
     OR NEW.amount_toman <> OLD.amount_toman
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'weekly reward is immutable';
  END IF;
  IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN
    RAISE EXCEPTION 'weekly reward is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

CREATE OR REPLACE FUNCTION reject_reward_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'weekly reward is immutable';
END;
$$ LANGUAGE plpgsql;

ALTER TABLE weekly_rewards DROP COLUMN IF EXISTS acknowledged_at;
