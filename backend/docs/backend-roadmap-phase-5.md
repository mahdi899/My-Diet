# Phase 5 — Selected-plan shopping lists

Shopping is an owner-authorized projection of published/dated plan options, not a
food catalog. The server chooses the same latest published version for each date
as the plan view, uses the approved selected option or the primary default, and
reads the option's ingredient quantities for its stated portion. It does not
multiply those quantities by the portion again. Draft/unpaid/private plans are
excluded. Legacy ingredient rows remain usable but carry incomplete basis warnings.

## API

- `GET /v1/me/shopping-list?weekStart=YYYY-MM-DD` returns a full Saturday–Friday
  projection. Optional `days=YYYY-MM-DD,YYYY-MM-DD` selects 1–7 distinct dates within
  that week; order is canonicalized. Invalid dates/weeks/duplicate days return 400.
- `PATCH /v1/me/shopping-list/items/:key` takes
  `{weekStart, days?, expectedRevision, alreadyHave, purchased}`. Both flags are
  explicit booleans. A missing ingredient in the owner's projection is 404; a
  changed projection returns 409 `lock_conflict`. Refetch and reconcile deliberately.
- `GET /v1/me/shopping-list/share` takes the same scope and returns revision,
  shareable plain text and incomplete status. It includes no user ID/phone, bearer
  link or private questionnaire. It does not send messages or publish anything.

Responses include `projectionKey`, `revision`, weekStart/days, `missingDays`,
`incomplete`, and items with key/name/originalLabels/quantity/unit/basis/category,
source slot references, incomplete, alreadyHave, purchased and
`quantityChangedSinceFlag`. Optional plan ingredient category is one of produce,
dairy, protein, grains, pantry or other; absent categories remain other rather than
inventing a food classification database. OpenAPI operations describe these routes.

## Deterministic normalization

Names use Unicode NFKC, Arabic-to-Persian yeh/kaf normalization, whitespace/ZWNJ
folding and case folding. Full normalized names must match: short names are not
expanded, recipe qualifiers are not removed, and synonyms are not guessed.
Original labels and exact source slots are retained.

Supported deterministic unit aliases combine g/گرم/kg/کیلوگرم as grams and
ml/میلی‌لیتر/l/لیتر as milliliters. Known count units remain their exact unit.
Weight and volume never merge. Cups/spoons never silently convert to weight or
volume. Raw/cooked/as-served bases and categories must match.

Unknown units/bases, absent names or missing/nonpositive/nonfinite quantities keep
separate source-keyed entries and incomplete status. Supplied quantities/labels
are retained when possible; unavailable quantities stay null. Empty ingredient
lists yield an incomplete meal-title placeholder, not a fabricated ingredient.
No nutritional values, conversions or ambiguous ingredient identities are invented.

## Recalculation, concurrency and flags

Projection scope keys and source fingerprints cover dated versions, selected
options, selection revisions, ingredient data and flags. Every read refreshes that
fingerprint synchronously, so substitution/correction is visible without waiting
for a worker. Existing transactional `shopping.invalidate` events remain available
for future push/cache consumers; correctness does not depend on consuming them.

Generation and flag mutations acquire the same owner-row lock used by publication
and selection. A flag mutation first refreshes against committed source data, then
checks expectedRevision. Repeated reads without source changes keep their revision;
stale clients cannot overwrite a new selection's projection. A conflicting mutation
rolls back completely. Unrelated dates can conservatively invalidate a week's
projection when shared flags change.

Flags are keyed by owner/week/canonical ingredient identity, shared across day
subsets and the whole-week list. They survive recalculation and a temporarily
removed ingredient reappearing. A changed quantity preserves the flag but marks
`quantityChangedSinceFlag`; explicitly setting flags again acknowledges the new
quantity. Flags are checkboxes, not a quantitative pantry inventory or proof that
the required amount has been purchased. Ambiguous source-keyed entries may need
new flags after a material source change instead of being incorrectly merged.

## Storage and verification

Additive migration `1736985600000_shopping_lists.sql` introduces only projections
and flags. Existing plans, clinical submissions, consumption and financial records
are unchanged; no data backfill is necessary. Production migration was not run.
Down migration deletes new list/flag data and requires backup/export on a populated
deployment. Optional ingredient category extends the plan API without breaking
existing documents. Backend-only work: existing demo shopping screens must consume
these endpoints to display server data.

Unit tests cover compatible aggregation, unknown-basis separation, original labels,
unit conversion, Persian normalization, distinct raw/cooked labels and scope
validation. PostgreSQL tests cover stable projections, shared flags, stale writes,
substitutions, correction quantity review, explicit acknowledgement, owner isolation,
share text and fresh/legacy migration compatibility. No external provider is needed.
Final verification passed: typecheck, lint, build, 61 unit tests and all 40
PostgreSQL integration tests across 16 files. The shopping/correction integration
suite was repeated after adding explicit quantity-review acknowledgement checks:
15 tests passed. No production migration, external provider call or frontend
deployment was performed.
