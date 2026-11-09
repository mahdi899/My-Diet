-- Up Migration

INSERT INTO app_settings (key, value)
VALUES ('demo.community_join_counter', '1621'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Down Migration

DELETE FROM app_settings WHERE key = 'demo.community_join_counter';
