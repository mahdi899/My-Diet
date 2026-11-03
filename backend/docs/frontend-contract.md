# Frontend contract

Live responses add fields. Existing success bodies keep their previous fields. Errors now include `retryable`.

## Errors

`{ status, code, messageFa, retryable }`

| Situation | code | retryable |
| --- | --- | --- |
| Form or query is wrong | `validation` | false |
| Missing or ended session | `unauthorized` | false |
| Role or ownership denied | `forbidden` | false |
| Two writes disagree | `conflict` and the specific codes already returned, such as `idempotency_conflict` | false |
| Database is down | `dependency_outage` | true |
| Upstream timed out | `timeout` | true |
| SMS send failed | `sms_unavailable` | true |
| Card gateway has no live adapter | `payment_unavailable` | false |
| Model call may already have been billed | `provider_outcome_unknown` | false |

A retryable error may be repeated. A false one needs a new command id or a user change. Replaying the same command id still returns the stored result where that route already says so.

## Pagination

Magazine: `GET /v1/public/articles?page=&pageSize=`. `page` starts at 1. `pageSize` is 1–20 and defaults to 20. The body is `{ page, pageSize, total, items }`. Admin lists stay capped (50–200 rows) and do not accept an unbounded query.

## Media and realtime

Care media stays on the assigned specialist. Images are at most 1.5MB and voice at most 1MB. A signature mismatch is quarantined and stores no bytes. Push payloads do not include the message body, phone, or media bytes. The existing message list remains an array. Clients cannot set `kind` to `system`.

## Rewards

Weekly completion still credits `reward.weekly_completion_toman` into promo when every published meal of the week is eaten. The streak campaign is separate: login and `GET /v1/me/streak` do not pay. `POST /v1/me/streak/claim` with the same `commandId` returns the stored grant.

## Analytics

`POST /v1/journey/events` is the only journey write. The admin graph is `GET /v1/admin/reports/journeys`. It has no install, session, or account id. Purchase events in that feed do not create orders.

## Plans and money

Meal states remain `as_planned`, `less`, `more`, `different`, `skipped`, and `unrecorded`. Amounts are integer toman. Sandbox completion credits the stored payment amount. The client does not send the amount.

## Site

`GET /v1/public/config` still returns prices and `minAppVersion`, plus `download`. Until a release is published, `download` is `{ status: "not_released", url: null }`.
