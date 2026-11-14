-- Up Migration
CREATE TABLE weekly_feedback (
 user_id uuid NOT NULL REFERENCES users(id),
 week_start date NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 favorites jsonb NOT NULL DEFAULT '[]',
 dislikes jsonb NOT NULL DEFAULT '[]',
 preparation_difficulty text NOT NULL DEFAULT 'unknown',
 ingredient_availability text NOT NULL DEFAULT 'unknown',
 affordability text NOT NULL DEFAULT 'unknown',
 portion_satisfaction text NOT NULL DEFAULT 'unknown',
 service_rating integer,
 comment text NOT NULL DEFAULT '',
 publish_permission boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, week_start),
 CHECK (preparation_difficulty IN ('easy','moderate','hard','unknown')),
 CHECK (ingredient_availability IN ('available','partial','unavailable','unknown')),
 CHECK (affordability IN ('affordable','tight','unaffordable','unknown')),
 CHECK (portion_satisfaction IN ('too_small','right','too_large','unknown')),
 CHECK (service_rating IS NULL OR service_rating BETWEEN 1 AND 5),
 CHECK (jsonb_typeof(favorites)='array' AND jsonb_typeof(dislikes)='array'),
 CHECK (char_length(comment) <= 1000)
);
CREATE TABLE feedback_publications (
 user_id uuid NOT NULL,
 week_start date NOT NULL,
 review_id uuid NOT NULL REFERENCES program_reviews(id),
 PRIMARY KEY (user_id, week_start),
 FOREIGN KEY (user_id, week_start) REFERENCES weekly_feedback(user_id, week_start)
);
CREATE TABLE preference_confirmations (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 revision integer NOT NULL DEFAULT 1,
 favorite_options jsonb NOT NULL,
 disliked_options jsonb NOT NULL,
 note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (char_length(note) <= 500)
);
CREATE TABLE patient_week_reports (
 user_id uuid NOT NULL REFERENCES users(id),
 week_start date NOT NULL,
 version integer NOT NULL,
 command_id uuid NOT NULL,
 source_hash text NOT NULL,
 cutoff_at timestamptz NOT NULL,
 document jsonb NOT NULL,
 generator text NOT NULL,
 prompt_version text NOT NULL,
 source_refs jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, week_start, version),
 UNIQUE (user_id, command_id)
);
CREATE INDEX patient_week_reports_latest ON patient_week_reports (user_id, week_start, version DESC);
-- Down Migration
DROP TABLE patient_week_reports;
DROP TABLE preference_confirmations;
DROP TABLE feedback_publications;
DROP TABLE weekly_feedback;
