# Phase 3 — detailed meal records

## Delivered

Daily cards and the meal-detail sheet now use a four-way recording form instead of the binary checkbox:

- According to plan: capture the selected approved food, full portion, calories and option ID.
- Less/more: capture the selected food, positive finite quantity and an explicit unit.
- Different food: require food name, positive quantity and unit.
- Skipped: explicitly record non-consumption, distinct from an untouched meal.

The same action reopens a prior record for correction, prefilled with its previous fields. One slot has one current consumption record; correction atomically replaces that record, rather than adding another calorie entry. Changes are limited to the current plan's current day. Submit is disabled while saving; validation failures and persistence failures leave the prior record intact and allow retry.

Calories are counted only when supplied by the approved portion. Adjusted/different-food energy remains null until a trusted calculation exists, rather than inferred from incompatible units or arbitrary food names. The dashboard labels its daily total incomplete and suppresses a precise remaining-calorie claim when any consumed record has unknown energy. Skipped meals do not create unknown-energy records.

Recording, consumption and adherence are separate projections:

- `recordedCount`: all recorded slots, including skipped meals.
- `mealEaten`: actual consumption, including adjusted/different foods with unknown energy.
- `eatenCount` / `followedPlan`: approved-portion adherence; adjusted, different and skipped records do not qualify.
- Existing demo weekly reward logic consumes adherence, not the recorded count. Server-verified streak eligibility remains Phase 8.

Phase 2 substitutions still preserve the historical food/portion/calorie snapshot. Unknown calories are explicitly labeled in that snapshot too. Nutrition storage v2 now includes mode, quantity, unit and recording time; older v1/v2 records without these fields retain their known legacy meaning and remain readable.

## Boundaries and API dependencies

This is a frontend implementation using the existing local demo repository, not server-confirmed nutritional tracking. The form states that storage is on this device. No backend endpoint, AI food estimation, payment, reward verification or database migration was added.

The future recording adapter needs an authenticated versioned upsert for stable user/plan/version/mealUid/date, a client idempotency key, one of `according|adjusted|different|skipped`, an approved-option snapshot, optional actual food name/quantity/unit, nullable trusted calories, and server recording/revision timestamps. Server validation must enforce ownership, approved paid plan, Asia/Tehran civil day and valid units/quantities. Corrections must replace the slot's current record without duplicating energy. The server must preserve historical consumption independently of later plan substitutions and calculate reward eligibility separately. Return authoritative daily totals, unknown-calorie flags, recorded count, adherence and record revision; distinguish validation, expired session, stale version and service failures. Locally saved demo data must not be represented as a delivered server write.

## Files and preview

- `lib/widgets/meal_logging.dart`: selectable status form, validation, prefill, saving/error/retry and correction.
- `lib/widgets/nutrition.dart`: daily/detail entry points and incomplete calorie summaries.
- `lib/data/demo_store.dart`: atomic recording/correction, persistence and independent summary projections.
- `lib/widgets/meal_choices.dart`: nullable historical calorie display.
- `test/meal_logging_test.dart`: mode transitions, correction/restart, validation, rollback/retry, adherence/reward separation and visible form interaction.
- Existing dashboard/nutrition tests now follow the new form instead of the retired checkbox.
- `screenshots/phase3/meal-record-demo.png`: mobile capture with explicitly local sample data.

Run Flutter from the repository; open an approved demo plan and tap “ثبت وعده”. After saving, “اصلاح ثبت وعده” reopens the current record. Try a skipped meal, then correct it to another food, then to the approved portion; watch the recording count, adherence and calorie completeness change independently.

## Verification

Flutter analyzer: no issues. Full suite: 87 tests passed, including 5 new Phase 3 tests. Release web build succeeded. The mobile form capture was rendered and visually inspected. Live server synchronization remains a backend dependency.
