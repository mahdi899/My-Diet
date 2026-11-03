# Phase 6 — Weekly feedback, preferences, and patient reports

Private weekly feedback is stored per customer and Saturday–Friday plan week. It is not a public review and it does not publish a nutrition plan.

## API

- `PUT /v1/me/weekly-feedback` stores favorites, dislikes, preparation difficulty, ingredient availability, affordability, portion satisfaction, optional service rating, comment, and `publishPermission`. Repeated identical writes keep the revision. Overlapping favorite and disliked option IDs return 400.
- `GET /v1/me/weekly-feedback?weekStart=` returns that private row. A missing row is 404.
- `POST /v1/me/weekly-feedback/publish` with `{weekStart}` queues `program_reviews` only when `publishPermission` is true and a service rating exists. An approved public review is not rewritten. Rejection or a later edit of the private row does not delete private feedback.
- `GET /v1/me/preferences` returns suggestions from the latest questionnaire answers, substitution reason labels, and the latest weekly feedback. `notADiagnosis` is always true.
- `PUT /v1/me/preferences` stores an explicit confirmation. `expectedRevision` must match; the first confirmation expects 0. The confirmed lists replace inferred likes and avoids for display, while `inferred` stays visible.
- `POST /v1/me/patient-reports` with `{weekStart, commandId}` writes one fact report version. The same command returns the original version. An unchanged source hash does not create another version. `approvesNewPlan` is always false.
- `GET /v1/me/patient-reports?weekStart=` returns the latest version.
- `GET /v1/specialist/patients/:userId/patient-reports?weekStart=` is limited to an assigned specialist. Other specialists receive 404.
- `GET /v1/admin/feedback-metrics` separates private rating count/average from approved public reviews.

Week starts must be Saturdays in `Asia/Tehran`. Unknown scale values are stored as `unknown` and omitted from report considerations rather than treated as a measured problem. Missing plan, consumption, or weight stays in `missing`. Adherence is null when no planned meals exist and is never stored as zero in that case.

## Report contents

The generator is `deterministic-facts` / `phase6-facts-v1`. It copies recorded counts, option IDs, weights, substitution counts, and questionnaire-change presence. It does not call an external model and does not invent calories, foods, or diagnoses. Source references point at meal slots, meal logs, weights, and the feedback week. Generation does not change `plan_requests.status`.

## Storage

Additive migration `1737072000000_weekly_feedback.sql` adds `weekly_feedback`, `feedback_publications`, `preference_confirmations`, and `patient_week_reports`. Existing reviews, plans, consumption, and ledger rows are unchanged. No backfill is required. The down migration drops only these new tables. Production migration was not run.

Frontend demo feedback screens still need to call these routes. Public website review lists continue to read approved `program_reviews` only.
