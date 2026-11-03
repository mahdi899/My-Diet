# Provider readiness

A route that exists is not a live provider. Sandbox and fake adapters are for development and tests. Production boot rejects them.

| Dependency | Development and test | Production | Live call verified |
| --- | --- | --- | --- |
| SMS `console` | Remembers the latest code in memory. The code is not logged. | Refused at boot. | Not a carrier. |
| SMS Kavenegar | The adapter throws. The API returns `sms_unavailable`. | Requires `KAVENEGAR_API_KEY` and still has no live HTTP send. | No. |
| Payment `sandbox` | Credits the stored payment row. Collects no card. | Refused at boot. | Sandbox only. |
| Zarinpal and IDPay | `payment_unavailable`. | Named, but the HTTP adapter is not implemented. | No. |
| Model `fake` | Local draft. | Refused at boot. | Not a provider. |
| Model HTTP | 60s timeout. One retry on HTTP 429. Other network failures become `provider_outcome_unknown` and are not retried, because the provider may already have billed. | Requires `AI_API_KEY` when the provider is `openai`. | No live provider sign-off. |
| Push `console` | Local log. | Refused at boot. | Not a device. |
| FCM | Not used for delivery in this build. | Not verified. | No. |
| Postgres | Required for readiness. | Required. Embedded Postgres is test-only. | Tests use a disposable cluster. |

`GET /health/live` does not touch the database. `GET /health/ready` returns 200 only after `select 1`.
