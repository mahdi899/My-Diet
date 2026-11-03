# Phase 4 — Consumption and substitutions

The existing `/v1/me/meal-logs` boolean API remains for legacy screens. Structured
clients use the endpoints below. Every mutation is scoped to the authenticated
owner, a paid order, exact published plan/meal/approved option, and server Tehran
date. A self-reported record never proves physical consumption.

## Consumption

`POST /v1/me/meal-consumption`:

```json
{
  "commandId": "01900000-0000-7000-8000-000000000001",
  "versionId": "01900000-0000-7000-8000-000000000002",
  "mealUid": "01900000-0000-7000-8000-000000000003",
  "optionId": "01900000-0000-7000-8000-000000000004",
  "date": "2026-11-03",
  "expectedRevision": 0,
  "state": "less",
  "actual": { "quantity": 100, "unit": "g", "basis": "cooked" }
}
```

States: `as_planned`, `less`, `more`, `different`, `skipped`, `unrecorded`.
Less/more/different require positive actual quantity and unit. Different also
requires `foodName`; other states reject it. Unrecorded is distinct from skipped;
absence of a record is also projected as unrecorded. Actual basis may be omitted
for as-served portions; raw/cooked/unknown plan bases need an explicitly compatible
basis before proportional calories can be derived.

The server returns revision, exact version/option, planned/consumed calories and
any legacy weekly reward. Known unit scaling only converts g/kg and ml/l, or uses
the exact same unit; volume/weight and raw/cooked conversion are not invented.
Arbitrary food names have null consumed calories. Skipped has known zero calories;
unknown and unrecorded do not. Current-day corrections append before/after history.
Past-day records cannot be changed. After publication changes, correcting an
existing current-day record against its original superseded version remains
possible; creating a record requires the current dated version.

Use `expectedRevision:0` for a new row; stale revisions return 409 `lock_conflict`.
Use a new UUID commandId for each intended change, and reuse the exact commandId
and payload for retries. The persisted response is replayed without applying the
change/reward/outbox effect again. Reusing it with a different payload is 409
`idempotency_conflict`. Replaying an already accepted command after midnight does
not mutate the past record. Server timestamps are PostgreSQL UTC instants.

## Selections

`GET /v1/me/substitution-reasons` lists active stable IDs and labels.
`POST /v1/me/meal-selections` accepts commandId, versionId, mealUid, optionId,
date, expectedRevision and optional reasonId. A current-day selection requires an
active configured reason. Future days within an existing published plan may be
planned without a reason; no consumption row or reward is created. Past changes,
unapproved options and other owners' plans are rejected. Original/new selections
and reason ID/label snapshots are kept in append-only history.

A consumed/skipped/different-food slot cannot change selection directly. Correct
the existing record explicitly to unrecorded first, select the new approved option,
then create/correct consumption against that selection. Old consumption snapshots
remain in history. The primary is the default when there is no selection. After a
plan replacement, stale selections do not select an old version's option; clients
retain the selection revision and can explicitly choose against the new version.

Selection changes and plan publication emit transactional `shopping.invalidate`
outbox events. Building the recalculated shopping projection is Phase 5 scope.

## Reads and compatibility

- `GET /v1/me/meal-activity/:date`: records, selections, and separate planned/consumed
  summaries. Each summary has `knownSubtotal`, `unknownCount`, and nullable `total`.
  A total with unknown or unrecorded slots is null, not a false zero.
- `GET /v1/me/meal-activity/:date/history`: latest 100 consumption and selection
  history rows for that owner/date, including previous/current snapshots.
- Existing day/week/active-plan reads now include selected option, selection and
  consumption revisions, consumptionState, plannedCalories and exact consumption
  references/details. The day/week/active projections share the same logic.
- Legacy booleans do not retroactively prove skipped status or a portion basis.
  Legacy logging is rejected with `structured_activity_required` once a slot has
  structured activity/selection, preventing an old screen from overwriting it.
- Existing weekly completion reward rules remain; only structured as_planned
  bridges to eaten=true. The existing unique reward/ledger logic runs in the same
  consumption transaction. Corrections do not rewrite financial history or grant
  another reward. Campaign qualification/compensation changes remain Phase 9.

Errors: 400 validation/reason_required; 404 not_found for unavailable/private
options; 409 not_today, past_day, plan_changed, selection_required,
consumption_exists, lock_conflict or idempotency_conflict. Responses contain no
provider credentials. OpenAPI operation descriptions document the new endpoints.

## Storage and validation

Additive migration `1736899200000_meal_activity.sql` adds log details/revisions,
append-only history, command responses, versioned selections and configured reason
seeds/indexes. It preserves prior logs/versions/balances. Do not fabricate old
quantities/calories/options during backfill. Deploy client contract changes with
the migration; the production migration has not been run. A down migration removes
new history and must not be used on a populated deployment without export/backup.

Tests cover compatible/unknown quantities, duplicate commands including parallel
retries, stale revisions, wrong owners/options, current-day reason validation,
consumed-slot protection, explicit correction, future planning without logging,
unknown daily totals, append-only history, midnight/past-date denial and existing
publication/reward/migration behavior. All database tests use isolated PostgreSQL.
Final verification passed: typecheck, lint, build, all 60 unit tests and all 39
PostgreSQL integration tests across 16 files. No skips/cancellations or forced
test-runner exit. The temporary database shutdown fix was exercised in that run.
No production migration, external integration or frontend deployment was performed.
The Windows embedded-PostgreSQL test helper now stops temporary clusters using
`pg_ctl -m fast -w` instead of forced taskkill, avoiding orphan recovery children.
This changes only test shutdown; application/production database settings are
untouched. Do not rebuild `dist` concurrently with tests importing it.
