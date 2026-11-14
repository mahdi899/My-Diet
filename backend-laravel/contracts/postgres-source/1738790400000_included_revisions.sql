-- Up Migration
-- A bought package includes later program changes, so those orders can be free.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_price_toman_check;
ALTER TABLE orders ADD CONSTRAINT orders_price_toman_check CHECK (price_toman >= 0);
ALTER TABLE plan_requests DROP CONSTRAINT IF EXISTS plan_requests_price_toman_check;
ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_price_toman_check CHECK (price_toman >= 0);

-- Down Migration
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_price_toman_check;
ALTER TABLE orders ADD CONSTRAINT orders_price_toman_check CHECK (price_toman > 0);
ALTER TABLE plan_requests DROP CONSTRAINT IF EXISTS plan_requests_price_toman_check;
ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_price_toman_check CHECK (price_toman > 0);
