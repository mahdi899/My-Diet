-- Up Migration

ALTER TABLE info_questions DROP CONSTRAINT IF EXISTS info_questions_status_check;
ALTER TABLE info_questions
  ADD CONSTRAINT info_questions_status_check
  CHECK (status IN ('open', 'answered', 'acknowledged', 'withdrawn'));

-- Down Migration

UPDATE info_questions SET status = 'acknowledged' WHERE status = 'withdrawn';
ALTER TABLE info_questions DROP CONSTRAINT IF EXISTS info_questions_status_check;
ALTER TABLE info_questions
  ADD CONSTRAINT info_questions_status_check
  CHECK (status IN ('open', 'answered', 'acknowledged'));
