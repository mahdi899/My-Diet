-- Up Migration
CREATE TABLE ai_execution_claims (
 request_id uuid PRIMARY KEY REFERENCES plan_requests(id),
 status text NOT NULL CHECK(status IN ('started','completed','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 error_code text
);
-- Pre-deploy in-flight executions have unknown network outcomes. Do not replay.
INSERT INTO ai_execution_claims(request_id,status,started_at)
SELECT r.id,'started',r.updated_at FROM plan_requests r WHERE r.status='generating'
AND NOT EXISTS(SELECT 1 FROM plan_versions v WHERE v.request_id=r.id);
-- Down Migration
DROP TABLE ai_execution_claims;
