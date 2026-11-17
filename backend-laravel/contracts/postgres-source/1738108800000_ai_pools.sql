-- Up Migration
-- Provider connections, model pools with health, usage ledger, prompt versions.
CREATE TABLE ai_providers (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('openrouter', 'closerouter', 'openai_compatible')),
  base_url text NOT NULL,
  api_key_encrypted text,
  http_referer text,
  app_title text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_pools (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  strategy text NOT NULL DEFAULT 'priority' CHECK (strategy IN ('priority', 'cost_first', 'weighted')),
  temperature numeric(3, 2) NOT NULL DEFAULT 0.3 CHECK (temperature BETWEEN 0 AND 2),
  max_tokens integer NOT NULL DEFAULT 6000 CHECK (max_tokens BETWEEN 200 AND 32000),
  timeout_ms integer NOT NULL DEFAULT 90000 CHECK (timeout_ms BETWEEN 5000 AND 300000),
  max_attempts smallint NOT NULL DEFAULT 4 CHECK (max_attempts BETWEEN 1 AND 10),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_pool_members (
  id uuid PRIMARY KEY,
  pool_id uuid NOT NULL REFERENCES ai_pools (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES ai_providers (id),
  model text NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  weight smallint NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
  enabled boolean NOT NULL DEFAULT true,
  price_in_micros_per_m bigint NOT NULL DEFAULT 0 CHECK (price_in_micros_per_m >= 0),
  price_out_micros_per_m bigint NOT NULL DEFAULT 0 CHECK (price_out_micros_per_m >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, provider_id, model)
);
CREATE INDEX ai_pool_members_pool ON ai_pool_members (pool_id, position) WHERE enabled;

CREATE TABLE ai_pool_health (
  member_id uuid PRIMARY KEY REFERENCES ai_pool_members (id) ON DELETE CASCADE,
  consecutive_failures integer NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  last_error_code text,
  last_ok_at timestamptz,
  last_fail_at timestamptz,
  total_ok bigint NOT NULL DEFAULT 0,
  total_fail bigint NOT NULL DEFAULT 0
);

CREATE TABLE ai_usage_ledger (
  id uuid PRIMARY KEY,
  request_id uuid,
  task text NOT NULL,
  pool_code text NOT NULL,
  member_id uuid,
  provider_name text NOT NULL,
  model text NOT NULL,
  attempt_no smallint NOT NULL DEFAULT 1,
  chunk text,
  outcome text NOT NULL CHECK (outcome IN
    ('ok', 'rate_limited', 'auth_failed', 'rejected', 'timeout', 'invalid_json', 'invalid_plan', 'outcome_unknown', 'budget_blocked')),
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_micros bigint NOT NULL DEFAULT 0,
  cost_source text NOT NULL DEFAULT 'estimate' CHECK (cost_source IN ('provider', 'estimate')),
  latency_ms integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_ledger_time ON ai_usage_ledger (created_at DESC);
CREATE INDEX ai_usage_ledger_model ON ai_usage_ledger (model, created_at DESC);
CREATE INDEX ai_usage_ledger_request ON ai_usage_ledger (request_id) WHERE request_id IS NOT NULL;

CREATE TABLE ai_prompt_templates (
  id uuid PRIMARY KEY,
  key text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  system_prompt text NOT NULL,
  user_template text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);
CREATE UNIQUE INDEX ai_prompt_active ON ai_prompt_templates (key) WHERE status = 'active';

-- Budget policy extends the existing kill switch and daily cap.
ALTER TABLE ai_controls
  ADD COLUMN monthly_cost_cap_micros bigint CHECK (monthly_cost_cap_micros IS NULL OR monthly_cost_cap_micros >= 0),
  ADD COLUMN per_request_cap_micros bigint CHECK (per_request_cap_micros IS NULL OR per_request_cap_micros >= 0),
  ADD COLUMN per_user_daily_drafts smallint NOT NULL DEFAULT 5 CHECK (per_user_daily_drafts BETWEEN 1 AND 100);

ALTER TABLE ai_generations
  ADD COLUMN pool_code text,
  ADD COLUMN attempt_chain jsonb,
  ADD COLUMN ai_notes jsonb;

-- Carry the single active connection into the pool model.
INSERT INTO ai_providers (id, name, kind, base_url, api_key_encrypted, active)
SELECT id, name, 'openai_compatible', base_url, api_key_encrypted, true FROM ai_connections;
INSERT INTO ai_pools (id, code, title) VALUES
  (gen_random_uuid(), 'plan_draft', 'پیش‌نویس برنامه غذایی'),
  (gen_random_uuid(), 'plan_critic', 'بازبینی فرهنگی و بالینی');
INSERT INTO ai_pool_members (id, pool_id, provider_id, model, position, enabled, price_in_micros_per_m, price_out_micros_per_m)
SELECT gen_random_uuid(), p.id, c.id, c.model, 0, c.active, c.cost_per_1k_tokens * 1000, c.cost_per_1k_tokens * 1000
FROM ai_connections c CROSS JOIN ai_pools p WHERE p.code = 'plan_draft';

-- Down Migration
ALTER TABLE ai_generations DROP COLUMN ai_notes, DROP COLUMN attempt_chain, DROP COLUMN pool_code;
ALTER TABLE ai_controls DROP COLUMN per_user_daily_drafts, DROP COLUMN per_request_cap_micros, DROP COLUMN monthly_cost_cap_micros;
DROP TABLE ai_prompt_templates;
DROP TABLE ai_usage_ledger;
DROP TABLE ai_pool_health;
DROP TABLE ai_pool_members;
DROP TABLE ai_pools;
DROP TABLE ai_providers;
