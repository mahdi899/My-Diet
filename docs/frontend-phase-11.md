# Phase 11 — online-only connection handling

## Screens

The customer app and both staff pages probe `GET /health/live` with a five-second limit. They do not read a browser or device online flag.

The branded screen has four distinct states:

- no transport: «ارتباط برقرار نیست»
- the server answered 503 or another 5xx: «سرویس موقتاً در دسترس نیست»
- the probe timed out: «پاسخ سرور به‌موقع نرسید»
- the probe answered 401: «نشست پایان یافته»

A 200 and a 404 are reachable. A 404 is the static preview answering, so the staff pages stay usable when that server has no health route. While a check is running the retry control is disabled and reads «در حال بررسی اتصال».

Startup without a usable probe result replaces the app with that screen. Losing the connection during use does the same. The open plan stays mounted and off-stage; it is not offered as a saved offline copy. A later successful probe returns to the same screen.

A message leaves the composer only after the send succeeds. A second tap while that send is in flight does nothing. A failed bubble stays «ارسال ناموفق» and keeps its text for the same retry. Meal logging, plan purchase, and the streak reward already ignore a repeated operation id.

## Backend still required

`GET /health/live` returns `{ "status": "ok" }` without the database. `GET /health/ready` returns 503 when the database is down. The customer app installs this probe only when `API_BASE_URL` is set. The local demo has no probe and stays on the sample data.

The live meal, payment, and reward routes are unchanged. Streak campaigns and journey aggregates are still sample adapters.

## Files

- `lib/data/connection.dart`, `lib/widgets/connection_gate.dart`: fault classification and the blocking screen.
- `lib/app.dart`, `lib/main.dart`: startup and resume checks.
- `lib/data/customer_auth.dart`, `lib/screens/messaging.dart`: distinct auth failures and a single in-flight send.
- `backend/admin-web/connection-gate.js`, `staff-session.js`, `messaging-workspace.js`, `index.html`, `specialist.html`.
- `test/connection_gate_test.dart`, `tool/test_connection_gate.cjs`.
- `docs/api-dependencies.md`: the fields the clients already depend on.

## Preview

Run the customer app with an empty `API_BASE_URL` and the sample home opens. Point it at a base URL whose `/health/live` does not answer and the connection screen replaces the plan. On the staff site, stop the API and the same screen covers the workspace; a static file server that answers 404 for `/health/live` does not.

## Verification

`flutter test test/connection_gate_test.dart` checks the four faults, the hidden plan at startup, the disabled retry while a check is open, and a connection loss over the home screen.

`node tool/test_connection_gate.cjs` checks 200, 404, 401, 503, a timeout, and a transport error.

Guest entry, questionnaire and payment, the published plan, substitutions, the four consumption states, shopping, weekly feedback, specialist review, a failed publication, streak progress, and role denial remain covered by the existing Flutter and staff tests.
