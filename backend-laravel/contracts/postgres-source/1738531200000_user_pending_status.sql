-- Up Migration
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted', 'pending'));
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending';

UPDATE users u
SET status = 'pending'
WHERE u.role = 'user'
  AND u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'paid'
  );

UPDATE users u
SET status = 'active'
WHERE u.role = 'user'
  AND u.status IN ('active', 'pending')
  AND EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'paid'
  );

UPDATE users u
SET status = 'active'
WHERE u.role IN ('admin', 'specialist') AND u.status = 'pending';

-- Down Migration
UPDATE users SET status = 'active' WHERE status = 'pending';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted'));
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';
