# Phase 13 — Reliability, testing, and delivery

The worker, transactional outbox, dead-letter retry, liveness, readiness, and the domain tests from phases 1–12 stay in place. This phase makes the public error envelope distinguish the failures a client has to treat differently, and records the delivery contract.

## Behavior

Every error body is `{ status, code, messageFa, retryable }`.

- Validation, authentication, forbidden, and conflict are not retryable.
- Database readiness failure is `dependency_outage` and retryable.
- A timed-out call is `timeout` and retryable.
- `sms_unavailable` is retryable. `payment_unavailable` is not, because the live gateway adapter is absent.
- `provider_outcome_unknown` is not retryable. A repeat could charge the model twice.

`GET /health/live` still returns `{ status: "ok" }` without the database. `GET /health/ready` still returns `{ status: "ok", database: "up" }` when Postgres answers. OpenAPI for non-production is version `0.17.0`.

Admin lists were already capped. Journey, retention, and magazine queries stay bounded.

## Modules

- `src/common/problem.ts` classifies the envelope.
- `src/common/problem.filter.ts` writes that envelope and logs only the code for non-HTTP failures.
- `src/health/health.controller.ts` uses `dependency_outage` when readiness fails.
- No migration.

## Documents

- [Frontend contract](frontend-contract.md)
- [Provider readiness](provider-readiness.md)
- [Recovery](recovery.md)
- `.env.example` holds placeholders. Production rejects the console SMS provider, the sandbox gateway, and the fake model.

## Screens still on demo data

The Flutter app keeps the sample store unless a screen is later switched to the API. These files still import it: `lib/main.dart`, `lib/app.dart`, `lib/data/day.dart`, and the screens and widgets `entry`, `onboarding`, `questionnaire`, `user`, `wallet_flow`, `shopping`, `weekly_feedback`, `messaging`, `meal_editor`, `pricing_admin`, `admin`, `question_admin`, `expert`, `doctor`, `clinic_workspace`, `shared`, plus `weekly_progress`, `meal_choices`, `meal_logging`, `nutrition`, `review_carousel`, `extra_questions`, and `ui`.

The public website still renders its built-in magazine until it calls `GET /v1/public/articles`. Download buttons do not invent a store address.

## Tests

Local run: `npm run lint`, `npm run typecheck`, and `npm run build` passed. `npm test` passed 75 tests. `npm run test:integration` passed 57 tests.

## Limitations

Kavenegar, Zarinpal, IDPay, and the live model HTTP path are not provider-verified. Sandbox payment and the fake model are development tools. Production migration was not run.
