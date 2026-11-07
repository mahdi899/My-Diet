# Phase 4 — weekly shopping list

## Implemented frontend

- The approved active week's shopping list is reachable from the customer dashboard, weekly-plan toolbar and seven-day plan summary. Unpublished, absent and expired plans have an explicit empty state.
- “Whole week” and individual day chips filter the same plan. Deselecting all days shows a prompt; dates outside the active plan are ignored and duplicate dates are counted once.
- Ingredients are grouped by their supplied practical category. Explicit fixtures have presentation categories; this categorization is not an AI food database or a conversion of nutritional units.
- Quantities combine only for identical ingredient ID, unit and raw/cooked basis. Parenthetical equivalent units remain part of the original unit text. No grams/cups conversion or raw/cooked inference is performed by the aggregator.
- Missing ingredient lists, names, quantities or units are reported with their meal name. Unknown quantities are not set to zero or invented.
- “Already have” and “Purchased” are distinct, mutually exclusive checklist statuses with persistent covered quantities. A status can be cleared. Saves show progress, prevent overlapping snapshot mutations and retain the previous mark on failure.
- Marks belong to request + published version + plan week + ingredient/unit/basis, independent of the visible day filter. Filtering never deletes a mark. Marking a selected day covers the displayed amount, not automatically the entire week's amount.
- Substitution recomputes the list and preserves applicable ingredient marks. If the required amount increases beyond the stored coverage, the row becomes unchecked and displays the already-covered quantity for review. Decreased requirements stay covered. A removed ingredient's mark remains available if the same compatible ingredient returns during the week.
- Added, removed and changed quantities are explained in a persistent change notice. Multiple substitutions accumulate from the last acknowledged state; reverting back to the original quantity cancels the corresponding notice. “Understood” acknowledges the changes without clearing purchase marks.
- Share text contains selected Jalali dates, categories, quantities, units/bases, statuses and missing-data warnings. Android opens the OS text-share chooser. Supported browsers use Web Share; other browsers/platforms fall back to clipboard. There is also a dedicated Copy action. Cancellation/failure is not reported as delivered content.

## Storage and service boundary

The existing demo nutrition snapshot v2 now stores shopping coverage and unacknowledged changes alongside meal selections/records. Older snapshots without the new fields are accepted. This is device-local frontend state, visibly labeled as a demo; it does not claim server synchronization, cloud shopping storage or offline plan access. No complete plan is persisted by this module. Live authentication, wallet and specialist website integrations were not replaced.

For production, the backend needs authenticated shopping state scoped to account, paid published plan/version/week, stable ingredient IDs, numeric quantities, units, raw/cooked basis and category. It must return selected-option ingredient data, unavailable/missing fields, a shopping revision, mark status and covered quantity. A versioned/idempotent mark update and acknowledgement endpoint must reject stale state and enforce ownership; it must synchronize with authoritative substitutions. Keep previous coverage on quantity increases, and do not treat a day-filter mark as covering the entire week. Server-issued IDs must replace the demo ingredient names/list indices as identities. API responses need distinct session/permission, validation, conflict and service-unavailable errors. No such backend endpoint or database migration was added in this phase.

## Files

- `lib/data/shopping_list.dart`: aggregation, compatibility identities, missing-data reporting, coverage model and quantity formatting.
- `lib/data/demo_store.dart`: active-week projection, persistent marks, substitution differences and serialized writes.
- `lib/screens/shopping.dart`: list, filters, categories, checkboxes, progress/error/empty states, change explanation and text export.
- `lib/screens/user.dart`: dashboard, plan toolbar and summary entry points.
- `lib/data/meal_fixtures.dart`: demo-only presentation categories.
- `lib/data/share_text*.dart`: conditional native/browser share adapters.
- `android/app/src/main/kotlin/ir/sabzine/sabzine_flutter/MainActivity.kt`: Android text-share channel.
- `test/shopping_test.dart`: compatibility, missing information, substitution/revert, increased coverage, persistence, filter scopes, failure rollback, text export, visible mobile flow and native channel contract.
- `references/screenshots/phase4/shopping-demo.png`: visually inspected mobile fixture capture.

## Preview and verification

Run the existing Flutter project. In an approved demo plan, choose “لیست خرید هفته”, select days, mark items and change a meal through the plan. Return to see quantity changes and preserved coverage. Restart with the same demo storage to verify persistence. Use Copy to paste a readable list into a messenger; on Android Share opens the system chooser.

Flutter analyzer: no issues. Full Flutter suite: 93 tests passed, including six Phase 4 tests. Release web build succeeded. The native sharing method-channel contract was tested; actual delivery to another app/person is not asserted.

Android APK verification was attempted but blocked before Kotlin compilation: Gradle could not resolve the existing com.android.application plugin version 9.1.0 from Google, MavenRepo or the Gradle Plugin Repository. No Gradle version/configuration was changed. An APK build and actual share chooser on a device remain unverified; the native method-channel contract and web build passed.
