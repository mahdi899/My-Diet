# Sabzine backend

Phase 0 is the runtime only: HTTP API, worker, Postgres, migrations, and the outbox. Accounts, questionnaires, the wallet, and plan review are not in this build.

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

## Docker

```powershell
docker compose up --build
```

The API container runs migrations before it listens. Compose uses `NODE_ENV=development` so the console SMS provider, sandbox gateway, and fake model are allowed. A production boot with any of those three refuses to start.

## Production rules already enforced

- `SMS_PROVIDER=console`, `PAYMENT_GATEWAY=sandbox`, and `AI_PROVIDER=fake` cannot be used when `NODE_ENV=production`.
- Named providers still need their credentials. The Kavenegar, Zarinpal, and model HTTP calls are not implemented in this phase, so a production configuration fails closed instead of pretending to send SMS or charge a card.
- Logs redact phones, OTP codes, tokens, questionnaire answers, and prompts.
- The sandbox gateway reports `collectsCardData: false`. Card fields are not accepted anywhere.

## Tests

```powershell
npm test
npm run test:integration
npm run lint
```
