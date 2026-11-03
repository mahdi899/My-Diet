# Backend completion — Phase 2: versioned plans

Date: 2026-11-03. Extends the existing plan service and `/v1` routes.

## Behavior

Every newly published meal requires three structured options: `primary`,
`ai_alternative` and `specialist_alternative`. Each has a stable UUID, portion
quantity/unit/basis, calories for that portion (nullable for alternatives),
preparation minutes, instructions and ingredients with quantity/unit/basis.
All options require explicit specialist approval. An administrator cannot supply
approved options. Approval actor/time are stored by the server, not accepted from
client fields. Publishing still requires an active verified assigned specialist,
a seven-day plan, all required questions closed and the current `If-Match` lock.

Correction copies retain meal-slot and option IDs but clear approval, requiring
specialist review again. Every save persists a separate version's option records.
Published options/context cannot be changed/deleted, just like existing meals.
Duplicate slot/option IDs, nonpositive quantities, invalid units and invalid times
are rejected. Legacy primary title/calories must agree with the primary option;
legacy ingredient fields are projected from that option's ingredients on save.

Publication locks both the request and owner, validates the draft's active base,
then publishes, updates the active pointer and creates the notification/outbox
inside one transaction. Another overlapping publication invalidates that base;
stale edits/failed/incomplete publication leave the active version unchanged.
The owner-row lock also serializes separate requests for the same owner.

Version context snapshots the request's questionnaire answers/schema, assigned
specialist, source generation ID and review completion time. The existing
`ai_generations` row supplies provider/model/prompt provenance. Snapshots retain
existing field encryption; raw model text and clinical snapshots stay off customer
responses. The original published timestamp and all old versions are retained.

New boolean consumption records also reference exact version/meal/primary option.
Updating an existing boolean log preserves those original references. Published
day/week/active responses expose `consumption.versionId` and `optionId` separately
from the currently scheduled version. Active-plan reads use the same dated-version
projection as day/week reads: midweek replacement does not rewrite earlier days.
Explicit quantity-based corrections/substitutions remain Phase 4 work.

## API contract

`PUT /v1/specialist/requests/:id/draft` retains `If-Match: <lockVersion>` and the
seven-element `days` array. Each meal retains `mealUid`, `mealType`, `suggestedTime`,
`title`, `calories`, `notes`, and `items`, and adds `options`:

```json
{
  "optionId": "01900000-0000-7000-8000-000000000001",
  "kind": "primary",
  "title": "عنوان وعده",
  "portion": { "quantity": 1, "unit": "serving", "basis": "as_served" },
  "calories": 420,
  "preparationMinutes": 20,
  "instructions": "دستور تهیه بررسی‌شده توسط متخصص",
  "ingredients": [
    { "name": "ماده اولیه", "quantity": 100, "unit": "g", "basis": "raw" }
  ],
  "approved": true
}
```

Supply exactly one of each kind, with different IDs for different options/slots.
Supported units: `g`, `kg`, `ml`, `l`, `piece`, `serving`, `cup`, `tbsp`, `tsp`.
Supported bases: `raw`, `cooked`, `as_served`, `unknown`. Do not infer weight from
volume. `calories` means calories for the stated portion, not per 100g; `null`
means unknown. This phase retains the legacy primary's positive integer calorie
requirement. It does not invent calories or certify nutritional suitability.

Drafts may omit options while incomplete. If `options` is supplied, it must contain
all three complete objects. Saving returns the new `lockVersion`. Existing staff
reads also return `version.id`/`versionNumber`; customer reads remain published-only
and include options, active `versionId`, default `selectedOptionId` and explicit
consumption references. There is no customer selection mutation in this phase.

Publication failure codes include `options_required`, `plan_incomplete`,
`info_required`, `lock_conflict`, `not_verified` and `week_closed` (409 except
verification authorization failures). Malformed draft input returns 400;
admin-supplied approval returns 403. Existing route names/status projections stay
intact. Clients must show review-incomplete rather than mark publication successful.

The current AI adapter still emits legacy draft meals. Such output is editable but
cannot publish until these options are completed and reviewed. Generating the
AI-proposed alternative/provenance automatically is Phase 3; manually labelling an
option `ai_alternative` is not evidence of a verified external AI response. No
provider has been called/verified in this phase. Existing staff editors need to send
the structured contract before publishing; no frontend redesign is included.

## Additive migration and rollout

`1736726400000_versioned_meal_options.sql` adds `plan_meal_options`,
`plan_version_context`, `active_plan_versions` and nullable consumption references.
No historical migration was edited. Existing answers are snapshotted and the newest
published version becomes the active pointer. Existing meal/financial/audit rows
are untouched. Legacy meals do **not** get fabricated alternatives/approvals;
legacy logs keep null exact references because their source cannot be proven.
Historical published plans remain readable. A newly published correction must
meet the new rules even when its source was a legacy version.

Take the normal backup and inspect multiple published versions/legacy anomalies
before rollout. Run the repository migration command in an explicitly authorized
deployment window; this phase only runs migrations on disposable test databases.
Deploy compatible specialist editing fields alongside the publication gate. Do not
roll back after new logs/options without exporting them: the down migration removes
only the newly added schema, including its new data. Never change legacy balances
or published meal rows to force migration success.

## Verification

Tests cover malformed/duplicate options, positive quantities/units, null alternative
calories, complete approval, incomplete publication, stale edits, concurrent
publication, immutable published options, active-pointer preservation, exact
consumption references after correction, and a legacy-fixture down/up migration
with unchanged meal rows, preserved published reads and no invented options.
Fresh migration application and repeated migration invocation are also exercised.

Disposable embedded PostgreSQL uses synchronous I/O and skips initdb's initial
disk sync to avoid Windows orphan I/O workers/slow temporary initialization.
Production database settings are unchanged; tests do not assess crash durability.
Final validation: typecheck, lint, build and all 57 unit tests passed. All 16
PostgreSQL integration files passed in the final run: 37 tests, zero failures,
skips or cancellations, exit code 0. No force-exit was used. Migration tests ran
only on disposable databases. OpenAPI operation/error descriptions were updated;
the detailed structured option contract is documented above.
