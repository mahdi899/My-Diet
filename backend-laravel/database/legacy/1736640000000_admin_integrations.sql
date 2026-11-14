-- Up Migration
CREATE TABLE ai_connections (
 id uuid PRIMARY KEY, name text NOT NULL, base_url text NOT NULL, model text NOT NULL,
 api_key_encrypted text NOT NULL, active boolean NOT NULL DEFAULT false,
 cost_per_1k_tokens integer NOT NULL DEFAULT 0 CHECK(cost_per_1k_tokens>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_one_active ON ai_connections(active) WHERE active;
CREATE TABLE push_campaigns (
 id uuid PRIMARY KEY, title text NOT NULL, body text NOT NULL,
 audience text NOT NULL CHECK(audience IN ('all','device')), device_id uuid REFERENCES devices(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','sending','completed','failed')),
 scheduled_at timestamptz, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES users(id), deleted_at timestamptz
);
CREATE TABLE campaign_deliveries (
 campaign_id uuid NOT NULL REFERENCES push_campaigns(id), device_id uuid NOT NULL REFERENCES devices(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','unknown')),
 error_code text, PRIMARY KEY(campaign_id,device_id)
);
-- Down Migration
DROP TABLE campaign_deliveries;
DROP TABLE push_campaigns;
DROP TABLE ai_connections;
