-- Up Migration
ALTER TABLE meal_logs ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE meal_logs ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE TABLE meal_log_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 log_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
 previous jsonb, current jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION audit_meal_log() RETURNS trigger AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
   NEW.revision:=OLD.revision+1;
   IF NEW.details=OLD.details AND NEW.eaten<>OLD.eaten THEN NEW.details:='{}'; END IF;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER meal_log_revision BEFORE UPDATE ON meal_logs FOR EACH ROW EXECUTE FUNCTION audit_meal_log();
CREATE FUNCTION record_meal_log_history() RETURNS trigger AS $$
BEGIN
 INSERT INTO meal_log_history(log_id,user_id,previous,current)
 VALUES(NEW.id,NEW.user_id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER meal_log_history AFTER INSERT OR UPDATE ON meal_logs FOR EACH ROW EXECUTE FUNCTION record_meal_log_history();
CREATE TABLE meal_activity_commands (
 user_id uuid NOT NULL REFERENCES users(id), command_id uuid NOT NULL,
 payload jsonb NOT NULL,response jsonb NOT NULL,PRIMARY KEY(user_id,command_id)
);
CREATE INDEX meal_history_owner_date ON meal_log_history(user_id,(current->>'scheduled_date'),id DESC);
CREATE TABLE meal_selections (
 user_id uuid NOT NULL REFERENCES users(id), civil_date date NOT NULL,meal_uid uuid NOT NULL,
 version_id uuid NOT NULL REFERENCES plan_versions(id),meal_id uuid NOT NULL,option_uid uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1,reason_id text,reason_label text,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,civil_date,meal_uid),
 FOREIGN KEY(meal_id,option_uid) REFERENCES plan_meal_options(meal_id,option_uid)
);
CREATE TABLE meal_selection_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL,
 civil_date date NOT NULL,meal_uid uuid NOT NULL,previous jsonb,current jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE substitution_reasons(id text PRIMARY KEY,label text NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE INDEX selection_history_owner_date ON meal_selection_history(user_id,civil_date,id DESC);
INSERT INTO substitution_reasons(id,label) VALUES('unavailable','مواد اولیه در دسترس نیست'),('preparation','آماده‌سازی دشوار است'),('preference','ترجیح غذایی');
CREATE FUNCTION preserve_meal_history() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'meal history is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER preserve_consumption_history BEFORE UPDATE OR DELETE ON meal_log_history FOR EACH ROW EXECUTE FUNCTION preserve_meal_history();
CREATE TRIGGER preserve_selection_history BEFORE UPDATE OR DELETE ON meal_selection_history FOR EACH ROW EXECUTE FUNCTION preserve_meal_history();
-- Down Migration
DROP TRIGGER preserve_consumption_history ON meal_log_history;
DROP TRIGGER preserve_selection_history ON meal_selection_history;
DROP FUNCTION preserve_meal_history();
DROP TABLE substitution_reasons;
DROP TABLE meal_selection_history;
DROP TABLE meal_selections;
DROP TABLE meal_activity_commands;
DROP TRIGGER meal_log_history ON meal_logs;
DROP FUNCTION record_meal_log_history();
DROP TRIGGER meal_log_revision ON meal_logs;
DROP FUNCTION audit_meal_log();
DROP TABLE meal_log_history;
ALTER TABLE meal_logs DROP COLUMN revision;
ALTER TABLE meal_logs DROP COLUMN details;
