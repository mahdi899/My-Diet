ALTER TABLE onboarding_transfers ADD COLUMN IF NOT EXISTS zibal_track_id text;
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_transfers_zibal_track_id
  ON onboarding_transfers(zibal_track_id) WHERE zibal_track_id IS NOT NULL;
