-- Up Migration
ALTER TABLE food_catalog ADD COLUMN image_bytes bytea;

-- Down Migration
ALTER TABLE food_catalog DROP COLUMN image_bytes;
