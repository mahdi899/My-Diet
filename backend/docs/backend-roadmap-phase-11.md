# Phase 11 — Privacy-conscious user journey tracking

Journey events extend the existing report module. They are not a second analytics product and they do not write payments, rewards, messages, or health answers.

## Collection

`POST /v1/journey/events` accepts an anonymous install. A valid access token attaches the current account. The first account to present an install is stored on that install. A later different account does not replace it (`kept_previous`). That link is not proof of the same person on another device.

The server classifies the session:

- `first_visit`: the first accepted session for that install.
- `returning`: every later session for that install.
- `firstAuthenticated`: the first session on that install that carries an account. This is not the same fact as `first_visit`.

A client `sessionType` or `firstAuthenticated` flag is accepted and then discarded.

Allowed events are `session_started`, `screen_viewed`, `navigation`, `plan_purchase_started`, `plan_purchase_completed`, `questionnaire_completed`, `meal_recorded`, `alternative_selected`, `feedback_submitted`, and `app_state`. Properties are stable ids, a version, a rating, or `activeMs`. Phone numbers, free text, chat, audio, photos, and questionnaire answers are rejected and nothing from that batch is stored.

Event ids deduplicate. The same id with a different payload is `idempotency_conflict`. A batch holds at most 40 events. An install may send 20 batches in a minute. A client timestamp more than five minutes from the server clock is `clock_skew`. A gap longer than 30 minutes marks the session `gapped` and is not turned into a navigation edge or into active time.

Active time is the sum of `activeMs` on `screen_viewed`. Background time is not inferred.

`plan_purchase_completed` never creates an order.

## Admin graph

`GET /v1/admin/reports/journeys?from=&to=&platform=&appVersion=&sessionType=`

`sessionType` is `first_visit` or `returning`. The response is an aggregate: nodes, directed edges with share of outgoing transitions, common paths, entries, exits, drop-off, and active time. It also returns comparison counts for both session types and for first authenticated sessions. It does not return install ids, session ids, account ids, or event properties beyond screen ids and the allowed counters.

Edges come only from recorded `navigation` events. A screen path with no navigation is a visit path, not an inferred edge. More than 40 nodes, 80 edges, or 25 paths sets `bounded`. More than 2000 sessions in the filter returns `too_large` instead of a partial graph. Purchase and meal counters are marked `authoritative: false`.

The report day is the Tehran civil date when the server accepted the session, not the client's clock.

Production migration was not run.
