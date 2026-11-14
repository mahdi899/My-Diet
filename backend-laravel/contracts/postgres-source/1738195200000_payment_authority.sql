-- Up Migration
-- Hosted gateways (Zarinpal) identify a payment by an authority issued at start and confirmed by a
-- server-side verify call. The unique index makes a replayed or forged callback unable to credit twice.
ALTER TABLE payments
  ADD COLUMN authority text,
  ADD COLUMN ref_id text,
  ADD COLUMN failure_reason text;

CREATE UNIQUE INDEX payments_gateway_authority_key ON payments (gateway, authority) WHERE authority IS NOT NULL;
CREATE INDEX payments_pending_idx ON payments (created_at) WHERE status = 'pending';

-- Down Migration
DROP INDEX payments_pending_idx;
DROP INDEX payments_gateway_authority_key;
ALTER TABLE payments DROP COLUMN failure_reason, DROP COLUMN ref_id, DROP COLUMN authority;
