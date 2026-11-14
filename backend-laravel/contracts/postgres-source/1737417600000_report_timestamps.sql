-- Up Migration
ALTER TABLE plan_change_requests ADD COLUMN first_responded_at timestamptz;

-- Down Migration
ALTER TABLE plan_change_requests DROP COLUMN first_responded_at;
