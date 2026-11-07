# Phase 10 — user journey analytics

## Screens

The administrator page «مسیر کاربران» has two separate views: first visit and later visits. Each view draws a directed graph from recorded transitions and repeats the same edges in a table. It also lists the common screen paths, entry screens, exit screens, drop-off ratios, and active seconds.

Filters are the date range, platform, app version, and the session view. An empty filter says there is no path in that slice. A screen sequence without a navigation event still appears as a path, and the graph has no invented arrow for it.

The figures are a phase 10 sample. The page states that a first visit and the first visit after an account exists are different, and that linking an anonymous install to an account is the server's job.

## Event contract

The customer adapter in `lib/data/journey_analytics.dart` accepts only these events and properties:

- `session_started`: `sessionType` (`first_visit` or `returning`), `firstAuthenticated`, `platform`, `appVersion`
- `screen_viewed`: `screenId`
- `navigation`: `fromScreenId`, `toScreenId`
- `plan_purchase_started`: `serviceId`
- `questionnaire_completed`: `schemaVersion`
- `meal_recorded`: `mealId`
- `alternative_selected`: `optionId`
- `feedback_submitted`: `rating`

Values are booleans, integers, or short identifiers. Message text, photos, voice, phone numbers, health answers, and free-text explanations are rejected. Screen time accrues only while the app is in the foreground; time spent in the background is not added.

Login, meal recording, a chosen alternative, questionnaire completion, feedback, and opening plan purchase emit those ids. They do not copy the phone number, the review text, or the substitution explanation.

## Backend still required

The live server has no journey aggregate. A real report needs stored transitions, cohort-free session filters, and server-side reconciliation of an anonymous install with an account. The client must not send the phone number in order to do that merge.

## Files

- `admin/journey-analytics.js`: fixture sessions, aggregation, graph, and table.
- `admin/app.js`, `index.html`, `phase-shell.css`: the admin route.
- `lib/data/journey_analytics.dart`: the customer event adapter.
- `lib/data/demo_store.dart`, `lib/screens/wallet_flow.dart`: the calls that emit allowed events.
- `test/journey_analytics_test.dart`, `tool/test_journey_analytics.cjs`.

## Preview

Sign in to the admin site and open «مسیر کاربران». Switch between «ورود اول» and «بازدیدهای بعدی». The first-visit graph includes purchase and questionnaire. The returning graph includes the day plan and feedback. Narrow the platform or the dates to see the empty state.

## Verification

`node tool/test_journey_analytics.cjs` checks the two views, edge percentages, active milliseconds, a later authenticated session staying out of the first-visit graph, and a path that does not grow an edge by itself.

`flutter test test/journey_analytics_test.dart` checks foreground time, the two session concepts, and rejection of a phone number and free text.
