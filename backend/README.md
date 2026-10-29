# Sabzine backend

The API covers accounts, the questionnaire, the toman wallet, plan orders, specialist review, meal logging, and the weekly reward. Staff can turn on an authenticator code, the server can push a notice to a registered device, and chat or request changes can be read as a live stream. The Flutter app still reads its local demo data until a screen is switched over.

## Requirements

Node.js 22 or newer. Docker is optional and is used to run Postgres, the API, and the worker together. Tests do not need Docker; they start an embedded Postgres.

## Local API

```powershell
cd backend
npm ci
copy .env.example .env
npm run migrate
npm run start:dev
```

In a second terminal:

```powershell
npm run start:worker:dev
```

Set `APP_ROLE=worker` in the environment of that second process. `start:worker:dev` selects the worker entry file, and the process still reads `APP_ROLE` from the environment.

- Liveness: `GET http://localhost:3000/health/live`
- Readiness: `GET http://localhost:3000/health/ready`
- Metrics: `GET http://localhost:3000/metrics`
- OpenAPI: `http://localhost:3000/docs` (not mounted when `NODE_ENV=production`)

Local login uses the console SMS provider. The code is not written to the log. While `NODE_ENV=development`, `GET /v1/auth/otp/latest?phone=0912...` returns the latest code for that phone. That route does not exist in production. The first admin is created with `PHONE` and `DATABASE_URL` set, then `npm run admin:create`. A new phone that verifies a code becomes a user. There is no demo code and no direct login.

Wallet top-ups in development use the sandbox gateway. `POST /v1/payments/sandbox/complete` credits the amount stored on the payment. The request cannot set the amount, and the API never accepts a card number.

A specialist or admin turns on an authenticator with `POST /v1/me/totp/setup` and confirms it with a current code. The next login then needs that code. Until it is confirmed, the one-time password still opens the session. `GET /questionnaire-editor` is the compatibility checker for questionnaire drafts. Deleting an account with `POST /v1/me/account/delete` and the confirmation `حذف حساب` removes the phone and the clinical text, and leaves the ledger on that user id.

The worker expires a pending top-up after 30 minutes without crediting it. A payment that has been pending for 15 minutes stays pending, because this build does not call a gateway inquiry API. A draft stuck in `generating` goes back on the queue. OTP challenges older than 7 days are deleted. Raw model text older than 30 days is cleared; the specialist's plan is kept. `POST /v1/admin/maintenance` runs that pass and reports wallet rows whose balance does not match the ledger.

`GET /v1/admin/ai-cost` is today's model spend in Asia/Tehran. `PUT /v1/admin/ai-controls` sets a daily cap, in micros, or turns the model off. Either one makes the next draft a blank week for the specialist, and the raw model text is still stored only when the model actually ran. A cost-cap alert is written once per Tehran day.

`POST /v1/admin/wallet-adjustments` records a cash correction. A debit is the written record of a bank refund: it lowers cash, leaves promo untouched, and does not call a bank or accept a card. Repeating the same `referenceId` does not apply it twice. `GET /v1/admin/outbox/dead` lists queue events that stopped after 10 attempts, without their payload. `POST /v1/admin/outbox/:id/retry` puts one of those events back in the queue.

A model draft is built from age, sex, height, weight, and the answer codes only. Free text is cut to 500 characters, phone numbers and 10-digit ids are removed, and the block is marked `untrusted_user_text`. The name, phone, and user id are not sent. If a meal repeats an allergy or a dislike, or a day's calories fall outside 800–3500, the specialist sees a warning on the request. The draft is still saved.

`GET /v1/me/info-questions` lists the signed-in user's open questions. `status` can be `answered`, `acknowledged`, or `withdrawn`. A second answer before the specialist closes the question is kept. `POST /v1/specialist/info-questions/:id/withdraw` takes back an open or answered question and records the reason. An acknowledged question stays closed. Withdrawing the last required question returns the request to review.

`GET /v1/public/reviews` lists approved reviews for anyone. The reviewer's name is the first name and the first letter of the last name. Pending and rejected reviews are left out, and the phone number is not included. `GET /v1/me/specialist` returns the public profile of the specialist assigned to the signed-in user, including the average of approved reviews. A user with no assignment gets an empty result.

`GET /v1/me/rewards/pending` lists weekly rewards the user has not dismissed. `POST /v1/me/rewards/:id/acknowledge` records that dismissal. The credited amount stays where it is, a second call does not move the timestamp, and another user receives the same not-found response as a missing reward.

`GET /v1/specialist/queue` lists only the requests assigned to the signed-in specialist. `bucket` is `generating` (still queued or generating), `awaiting_review` (a new plan in review), `awaiting_user`, `response_received`, `revisions` (an open AI or specialist revision), or `published`. The same list is `GET /v1/specialist/requests`. A user cannot read it.

`GET /v1/me/acquisition-state` tells a signed-in user the next step after login. With no submission the step is the questionnaire. A new required question, or a pregnancy date older than four weeks, sends them back to the questionnaire. A current submission on a newer schema, or a pregnancy week that has moved, asks them to confirm the summary. Otherwise they choose a service, unless a request is already open. The pregnancy week is the stored week plus the full weeks since the submission. Publishing a schema does not change an existing plan.

`GET /v1/payments/gateways` lists the enabled gateways. A top-up can name one of them; otherwise it uses `PAYMENT_GATEWAY`. Sandbox completion only credits a payment that was started on `sandbox`. `idpay` and Zarinpal stay unavailable until their HTTP adapters exist. Admin SLA and payment totals are read from `DATABASE_REPLICA_URL` when it is set, and those report transactions cannot write. The specialist SLA is the first edit, question, or publication within 24 hours.

## Docker

```powershell
docker compose up --build
```

The API container runs migrations before it listens. Compose uses `NODE_ENV=development` so the console SMS provider, sandbox gateway, and fake model are allowed. A production boot with any of those three refuses to start.

## Production rules already enforced

- `SMS_PROVIDER=console`, `PAYMENT_GATEWAY=sandbox`, `AI_PROVIDER=fake`, `AI_FAILOVER_PROVIDER=fake`, and `PUSH_PROVIDER=console` cannot be used when `NODE_ENV=production`.
- Named providers still need their credentials. The Kavenegar, Zarinpal, FCM, and model HTTP calls are not implemented in this phase, so a production configuration fails closed instead of pretending to send SMS, a push, or charge a card.
- Free-text clinical answers are encrypted with `FIELD_KEY` before they are stored. The development key is refused in production.
- Logs redact phones, OTP codes, tokens, questionnaire answers, and prompts.
- The sandbox gateway reports `collectsCardData: false`. Card fields are not accepted anywhere.

## Tests

```powershell
npm test
npm run test:integration
npm run lint
```
