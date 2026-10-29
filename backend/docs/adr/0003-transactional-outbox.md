# ADR 0003: Transactional outbox on Postgres

When a plan purchase lands, the wallet debit, the order, the plan request, and the "generate a draft" job must agree. The API writes an `outbox_events` row in the same database transaction as the business change. The worker claims pending rows with `FOR UPDATE SKIP LOCKED`, enqueues them on pg-boss, then sets `dispatched_at`.

pg-boss stores its queue in the same Postgres instance, so Phase 0 does not run Redis. A crash after enqueue and before `dispatched_at` can deliver the same event twice. Jobs must be idempotent. pg-boss `singletonKey` is the outbox event id, which collapses a duplicate that is still queued.

The relay lives only in the worker process. The API never starts it.
