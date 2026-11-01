# Phase 2 — approved meals, details and substitutions

## Delivered frontend

- Customer daily dashboard and weekly day tabs share the same selected-meal projection.
- Every daily meal displays two alternative previews when both approved options exist.
- The weekly summary displays all seven days, each with its own details/substitution action. Past days remain readable in the summary but cannot be changed; day-tab restrictions remain unchanged.
- The selection sheet compares the original food, AI alternative and specialist alternative. Full portions, calories for that portion, ingredients, preparation time, method and quantity basis are available before confirmation.
- Missing values stay explicitly missing. Unapproved/incomplete alternatives never become selectable. Demo recipes are isolated in `meal_fixtures.dart`; API omissions must never be filled with these fixtures.
- Today's substitutions require a configured reason ID. “Other” supports optional explanation. Future-day selections do not require a reason. The selected option can be reverted to the original without deleting history.
- Selection writes are awaited, disable repeated actions, and leave prior state untouched on failure. Selected option IDs, reason ID/label, explanation, prior option, time and history persist with the demo nutrition snapshot. Request ID + published version + civil date + meal index isolate selections.
- Already-consumed meals require confirmation. Their captured title, portion and calorie count stay historical; swapping food cannot remove the consumed state or double-count calories. Legacy v1 calorie logs remain readable.
- Selected options drive planned calorie totals and the weekly ingredient preview. Only compatible ingredient ID/unit/basis rows are combined. The complete shopping-list workflow remains Phase 4.
- The specialist website's review/change queues now open a read-only meal-completeness inspector. It reports missing recipe details, either missing alternative, and absent individual specialist approval. Existing API authentication and permission handling remain active.
- The demo publication gate validates all seven days and both alternatives before replacing the published snapshot. Existing required-answer approval locks remain enforced.

## Frontend vs live service

Customer plan data remains the existing explicit `DemoStore` adapter. This phase does **not** claim real AI generation, clinical approval, server storage of substitutions or multi-device synchronization. Local selection persistence is not an offline plan-access feature: no full plan is written to the nutrition cache.

The live specialist inspector reads `GET /v1/specialist/requests/:id` and its existing `version.days[].meals[]`. The current backend only supplies the original title, calories, notes and ingredient items; newer metadata/alternatives are reported as missing. No working endpoint was replaced with fixtures. The inspector has no pretend publish or save button. Full specialist plan editing remains Phase 6.

## Required API contract additions (not implemented here)

Extend existing approved week/day responses and specialist drafts with:

```json
{
  "mealUid": "stable-meal-id",
  "title": "Food name",
  "mealType": "lunch",
  "suggestedTime": "13:30",
  "portion": "Approved human-readable portion",
  "calories": 650,
  "preparationMinutes": 15,
  "instructions": "Approved preparation method",
  "quantityBasis": "Raw/cooked basis and preparation assumptions",
  "items": [{"ingredientId":"rice-cooked","name":"Rice","quantity":150,"unit":"g","basis":"cooked","category":"grains"}],
  "alternatives": [{
    "id":"stable-option-id","source":"ai",
    "approved":true,"reviewedBy":"specialist-id","reviewedAt":"2026-11-01T08:00:00Z",
    "meal":{"title":"Alternative","portion":"...","calories":620,"preparationMinutes":20,"instructions":"...","quantityBasis":"...","items":[]}
  }]
}
```

There must be exactly one AI alternative and one specialist alternative, each with complete meal details and a separate reviewed approval. Never expose draft/unapproved options to customers. IDs are stable across presentation changes; the real adapter must use mealUid rather than demo list indices. Null quantities/calories/time must remain null/missing, never inferred.

The backend must provide configured active reason IDs/labels, selected options, append-only change history and a versioned substitution command. The command needs user/plan/version/meal/date/option/reason IDs, optional explanation, explicit consumed-change confirmation, an idempotency key and an optimistic revision. Validate ownership, paid publication, active seven-day period and Asia/Tehran day boundaries on the server. Respond with authoritative selected food, planned totals and shopping revision. Return distinguishable 401/403, validation, stale-version and network/service errors. Refresh after a stale-version response instead of silently overwriting.

Consumption must store a food/portion/calorie snapshot independent of the current selected option. Substitution must not mutate past consumption. History must preserve reason labels when configuration changes. Server publication must enforce the same completeness and approval rules as the UI; the frontend gate is not a security boundary.

## Files and preview

- Models: `lib/data/meal_plan.dart`; explicit fixtures: `lib/data/meal_fixtures.dart`.
- Demo state/persistence/projections: `lib/data/demo_store.dart`.
- Meal detail, previews and substitution sheet: `lib/widgets/meal_choices.dart`, `lib/widgets/nutrition.dart`.
- Seven-day summary and ingredient preview: `lib/screens/user.dart`.
- Specialist inspector: `backend/admin-web/meal-quality.js`, `specialist.js`, `specialist.html`; shared table cells accept safe DOM nodes.

Run the customer app with Flutter from this repository. In demo mode, sign in, use an approved demo plan, open a meal or the weekly-summary action, inspect an alternative, select a reason for today and confirm. Restart with the same demo storage to verify persistence. For consumed-food confirmation, mark a meal eaten first and then use its alternative action.

For website preview use `node tool/preview_frontend.cjs`; existing `/admin/specialist.html` authentication is required. A real request whose API lacks the new fields will show the incomplete state. `tool/test_meal_frontend.cjs` supplies explicit API fixtures to exercise the inspector without creating accounts.

## Verification and captures

- Flutter analyzer: clean. Release web build succeeded (standard JavaScript target); the existing secure-storage dependency still reports Wasm dry-run incompatibility.
- Full Flutter suite: 82 passing tests, including 7 Phase 2 tests covering persisted substitution/revert, calorie and shopping consistency, original preservation, consumed snapshots, reason/period guards, incomplete approval, failed save and the visible mobile sheet flow.
- Browser contract test: specialist queue → detail inspector, missing alternatives/recipe fields, complete-vs-unapproved validation and permission failure.
- `screenshots/phase2/meal-options-demo.png`: Flutter mobile UI capture with fixture data.
- `screenshots/phase2/specialist-incomplete-demo.png`: Chrome capture with an explicit incomplete API fixture.

Full shopping management, four-way meal logging, live specialist editing and later phases have not been implemented by this phase.
