# Recovery

Migrations are additive. Do not edit a migration that has already been applied. Apply new files with the usual migrator on a disposable database first. This repository does not authorize a production migration run.

## Process

- `GET /health/live` answers while the process is up, even if Postgres is down.
- `GET /health/ready` returns `dependency_outage` when `select 1` fails. That error is retryable.
- Run the API with `APP_ROLE=api` and the worker with `APP_ROLE=worker`. Restarting the worker is safe: outbox dispatch uses the event id as a singleton key, and consumers must tolerate a duplicate delivery.

## Queue

`GET /v1/admin/outbox/dead` lists events that stopped after 10 attempts. The payload is not included. `POST /v1/admin/outbox/:id/retry` puts one event back. A model attempt whose outcome is unknown must be reconciled by an admin. It must not be sent to the provider again automatically.

## Maintenance

`POST /v1/admin/maintenance` expires stale pending top-ups, requeues a draft stuck in `generating`, deletes OTP challenges older than 7 days, and clears raw model text older than 30 days. The published plan and the wallet ledger stay.

## Clocks

Report and reward dates use Asia/Tehran as a fixed UTC+3:30 offset. Tests may set `SABZINE_NOW` only when `NODE_ENV=test`.
