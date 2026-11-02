# API dependencies

Routes below are the ones the customer app and the staff pages call. Amounts are toman. Dates are `YYYY-MM-DD` civil days. Errors from `ApiError` are `{ "code", "messageFa" }` with the HTTP status. A missing session is 401. A role mismatch is 403. Unknown fields are 400 `validation`.

`GET /health/live` returns `{ "status": "ok" }` and does not touch the database. `GET /health/ready` returns `{ "status": "ok", "database": "up" }`, or 503 `{ "status": "down", "database": "down" }`. The connection screen treats timeout, no transport, 401, and 503 or other 5xx as different faults. Any other status, including 404, means the server answered.

## Authentication

`POST /v1/auth/otp/request` needs `{ "phone" }`. `POST /v1/auth/otp/verify` needs `{ "phone", "code" }` and may also send `deviceLabel` and `platform`. The session returns `accessToken`, `role`, and `sessionExpiresAt`. `POST /v1/auth/admin/login` needs `{ "username", "password" }`. `POST /v1/auth/refresh` renews the session from the web cookie when `x-sabzine-client` is `web`, or from `{ "refreshToken" }`. `POST /v1/auth/logout` ends it. A customer token cannot open a staff workspace.

## Plans, meals, and money

`GET /v1/me/request` and `GET /v1/me/plan` are the current request and the published plan. Week and day views are `GET /v1/me/plan/week` and `GET /v1/me/plan/day/:date`. `POST /v1/me/meal-logs` accepts only `{ "mealUid", "eaten" }`. Sending the same eaten meal again does not create a second log.

`GET /v1/catalog` and `GET /v1/me/wallet` feed purchase. `POST /v1/me/orders` needs header `Idempotency-Key` (8 to 80 letters, digits, `_`, or `-`) and body `{ "serviceCode", "expectedPriceToman", "parentRequestId" }`. The same key does not place a second order. `POST /v1/me/topups` needs `{ "packageCode", "gateway" }`. `GET /v1/me/rewards/pending` lists rewards waiting for confirmation. `POST /v1/me/rewards/:id/acknowledge` confirms one reward and takes an empty body. Confirmation is separate from the streak progress the sample adapter shows.

`POST /v1/me/reviews` accepts `requestId`, `weekStart`, `rating` from 1 to 5, and an optional `body` of at most 1000 characters.

## Messaging and media

`GET /v1/conversations` lists the caller's conversations. `GET /v1/conversations/:id/messages` returns that conversation's text messages in created order. There is no cursor query; the staff sample pages over its own fixture, and the server list is the full stored thread. `POST /v1/conversations/:id/messages` accepts only `{ "body" }` of 1 to 2000 characters. Photo and voice are not accepted by this route. `POST /v1/conversations/:id/read` marks the thread read. `POST /v1/me/support-conversation` opens the support thread.

A failed send keeps the draft. The client must not start a second post for the same draft while the first request is still running.

## Analytics

The customer adapter may emit only `session_started`, `screen_viewed`, `navigation`, `plan_purchase_started`, `questionnaire_completed`, `meal_recorded`, `alternative_selected`, and `feedback_submitted`, with the short identifiers named in `docs/frontend-phase-10.md`. The live server does not store those events yet. The admin graph is fixture data.

## Lists

Admin and specialist list routes return a fixed recent window (commonly 50, 100, or 200 rows) ordered newest first. They do not take `cursor` or `limit` from the client. An empty list is `[]`, not an error.
