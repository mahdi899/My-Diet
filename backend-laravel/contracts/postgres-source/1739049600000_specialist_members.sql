-- Up Migration
ALTER TABLE specialist_profiles
  ADD COLUMN rating numeric(3, 2)
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

CREATE TABLE specialist_members (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id <> specialist_id)
);

CREATE INDEX specialist_members_specialist ON specialist_members (specialist_id);

INSERT INTO specialist_members (specialist_id, user_id)
SELECT DISTINCT ON (r.user_id) r.assigned_specialist_id, r.user_id
FROM plan_requests r
JOIN users u ON u.id = r.user_id
JOIN users s ON s.id = r.assigned_specialist_id
WHERE r.assigned_specialist_id IS NOT NULL
  AND r.status <> 'cancelled'
  AND u.role = 'user'
  AND u.status <> 'deleted'
  AND s.role = 'specialist'
  AND r.user_id <> r.assigned_specialist_id
ORDER BY r.user_id, r.updated_at DESC, r.created_at DESC;

-- Down Migration
DROP TABLE specialist_members;
ALTER TABLE specialist_profiles DROP COLUMN rating;
