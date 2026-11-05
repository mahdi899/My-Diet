-- Up Migration
CREATE TABLE demo_campaign_links (
 id uuid PRIMARY KEY,
 name varchar(120) NOT NULL,
 slug varchar(64) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 source varchar(80) NOT NULL,
 active boolean NOT NULL DEFAULT true,
 opens bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Down Migration
DROP TABLE demo_campaign_links;
