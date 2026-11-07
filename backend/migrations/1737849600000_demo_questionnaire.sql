-- Up Migration
CREATE TABLE demo_questionnaire_settings (
  goal text PRIMARY KEY,
  document jsonb NOT NULL
);
-- Down Migration
DROP TABLE demo_questionnaire_settings;
