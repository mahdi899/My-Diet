-- Up Migration

ALTER TABLE specialist_profiles
  ADD COLUMN medical_council_no text NOT NULL DEFAULT '',
  ADD COLUMN verification_status text NOT NULL DEFAULT 'verified'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended'));

CREATE UNIQUE INDEX specialist_council_unique
  ON specialist_profiles (medical_council_no)
  WHERE medical_council_no <> '';

-- Down Migration

DROP INDEX IF EXISTS specialist_council_unique;
ALTER TABLE specialist_profiles DROP COLUMN IF EXISTS verification_status;
ALTER TABLE specialist_profiles DROP COLUMN IF EXISTS medical_council_no;
