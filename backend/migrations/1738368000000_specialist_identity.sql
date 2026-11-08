-- Up Migration
ALTER TABLE specialist_profiles
  ADD COLUMN birth_date date,
  ADD COLUMN education text NOT NULL DEFAULT '',
  ADD COLUMN portrait text NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE specialist_profiles
  DROP COLUMN portrait,
  DROP COLUMN education,
  DROP COLUMN birth_date;
