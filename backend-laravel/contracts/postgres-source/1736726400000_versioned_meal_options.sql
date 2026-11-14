-- Up Migration
CREATE TABLE plan_meal_options (
  meal_id uuid NOT NULL REFERENCES plan_meals(id),
  option_uid uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('primary','ai_alternative','specialist_alternative')),
  document jsonb NOT NULL,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  PRIMARY KEY(meal_id,option_uid),
  UNIQUE(meal_id,kind),
  CHECK ((approved_by IS NULL) = (approved_at IS NULL))
);
CREATE TABLE plan_version_context (
  version_id uuid PRIMARY KEY REFERENCES plan_versions(id),
  assigned_specialist_id uuid REFERENCES users(id),
  questionnaire_schema_version integer NOT NULL,
  questionnaire_snapshot jsonb NOT NULL,
  generation_id uuid REFERENCES ai_generations(id),
  replaces_version_id uuid REFERENCES plan_versions(id),
  review_completed_at timestamptz
);
INSERT INTO plan_version_context(version_id,assigned_specialist_id,questionnaire_schema_version,questionnaire_snapshot)
SELECT v.id,r.assigned_specialist_id,s.schema_version,s.answers FROM plan_versions v
JOIN plan_requests r ON r.id=v.request_id JOIN questionnaire_submissions s ON s.id=r.submission_id;

CREATE TABLE active_plan_versions (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  version_id uuid NOT NULL REFERENCES plan_versions(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO active_plan_versions(user_id,version_id)
SELECT DISTINCT ON(r.user_id) r.user_id,v.id FROM plan_versions v
JOIN plan_requests r ON r.id=v.request_id WHERE v.status='published'
ORDER BY r.user_id,v.published_at DESC NULLS LAST,v.id DESC;

ALTER TABLE meal_logs ADD COLUMN plan_version_id uuid REFERENCES plan_versions(id);
ALTER TABLE meal_logs ADD COLUMN option_uid uuid;
ALTER TABLE meal_logs ADD COLUMN plan_meal_id uuid REFERENCES plan_meals(id);
ALTER TABLE meal_logs ADD CONSTRAINT meal_log_exact_option FOREIGN KEY(plan_meal_id,option_uid)
  REFERENCES plan_meal_options(meal_id,option_uid);
-- Legacy boolean logs lack an exact option reference. Keep it explicitly unknown;
-- never guess a version when multiple historical versions share a meal UID.
CREATE INDEX meal_logs_plan_version ON meal_logs(plan_version_id);

CREATE FUNCTION protect_meal_option() RETURNS trigger AS $$
DECLARE st text;
BEGIN
  SELECT v.status INTO st FROM plan_meals m JOIN plan_days d ON d.id=m.plan_day_id
  JOIN plan_versions v ON v.id=d.plan_version_id WHERE m.id=COALESCE(OLD.meal_id,NEW.meal_id);
  IF st IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'plan options are immutable'; END IF;
  IF TG_OP='UPDATE' AND OLD.meal_id<>NEW.meal_id THEN RAISE EXCEPTION 'option cannot move'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER plan_options_draft_only BEFORE INSERT OR UPDATE OR DELETE ON plan_meal_options
FOR EACH ROW EXECUTE FUNCTION protect_meal_option();

CREATE FUNCTION protect_plan_context() RETURNS trigger AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.version_id<>NEW.version_id THEN RAISE EXCEPTION 'context cannot move'; END IF;
  IF (SELECT status FROM plan_versions WHERE id=COALESCE(OLD.version_id,NEW.version_id)) <> 'draft'
    THEN RAISE EXCEPTION 'plan context is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER plan_context_draft_only BEFORE INSERT OR UPDATE OR DELETE ON plan_version_context
FOR EACH ROW EXECUTE FUNCTION protect_plan_context();

-- Down Migration
DROP TRIGGER plan_context_draft_only ON plan_version_context;
DROP FUNCTION protect_plan_context();
DROP TRIGGER plan_options_draft_only ON plan_meal_options;
DROP FUNCTION protect_meal_option();
ALTER TABLE meal_logs DROP COLUMN option_uid;
ALTER TABLE meal_logs DROP COLUMN plan_meal_id;
ALTER TABLE meal_logs DROP COLUMN plan_version_id;
DROP TABLE active_plan_versions;
DROP TABLE plan_version_context;
DROP TABLE plan_meal_options;
