# Phase 5 — weekly feedback and personalized follow-up

## Customer experience

- The end-of-week feedback form replaces the former single review text box. It collects selectable favorite/disliked foods, preparation difficulties, ingredient access, affordability, portion satisfaction and specialist communication, plus optional private comments.
- Favorite and disliked choices are mutually exclusive and refer to stable demo meal slots. Titles reflect the selected approved alternative, not a silently substituted original dish.
- Feedback is eligible on the final civil day of the program week, after the week, or after completion. Reward receipt and full adherence are not prerequisites. The streak card's feedback entry follows this eligibility, and the profile entry remains available.
- Every record contains a stable demo owner key, request ID, published plan version, week start, timestamp and meal-title snapshot. Renaming the profile does not permit a duplicate response. Other accounts cannot access that owner's stored feedback through the repository interface.
- Private answers and private comments are never copied into a public review. Public consent is off initially. Opting in requires a separate public text; that text alone enters the existing demo moderation queue, initially unapproved. A user who reports no specialist interaction receives no fabricated specialist score, and an unrated review does not affect clinician averages.
- Loading, restore failure/retry, validation, saving, successful saved state and failed-save retry are visible. Failed saves retain form answers. Repeated submissions are prevented and the repository rejects duplicate keys.

## Renewal and editable preferences

Purchasing another new plan from the existing service screen opens a review step before plan debit. Existing questionnaire information is shown without being overwritten. The user can reopen personal information to correct weight, health, pregnancy or medication changes and must confirm that important information was checked.

The latest private feedback supplies editable suggested favorite foods, foods to avoid, preparation and budget considerations. These are explicitly simple demo suggestions, not a live AI inference. The user may edit them or reject them completely. A rejected suggestion remains rejected when reopening; nothing is silently applied to the questionnaire.

Accepted preferences and the confirmed questionnaire snapshot are captured on the new demo DietRequest. Cancellation of the review prevents purchase. Preferences persist per demo owner through the repository; the purchase and its existing wallet behavior still use the existing demo adapter.

## Specialist website

The authenticated weekly reports route now contains a complete sample report view. Select a sample patient and week to inspect:

- Report version, period, generation date/time in Asia/Tehran, and ready/partial/pending/failed status.
- Recorded-meal counts and adherence counts with their own denominators and definitions.
- Data completeness and previous-week comparison.
- Favorite/disliked foods, substitution reasons and counts.
- Preparation, affordability, availability, portion and communication feedback.
- Available weight measurements and relevant health-information changes, with missing data distinguished from no conditions.
- Considerations for the next plan that still require specialist review.

All report records are visibly labeled sample data, not real patients or live AI output. Pending/failed reports do not fabricate ready content. Multiple dated weeks and report versions are selectable. Existing live queue, profile, authentication and messaging-list integrations remain unchanged. No provider key, AI call or invented report API is placed in the browser or Flutter app.

## Repository and backend dependencies

`WeeklyFeedbackRepository` separates the frontend from storage. The memory adapter supports tests; the SharedPreferences adapter persists feedback and preferences under owner-specific keys. App startup restores it after session restoration, and the form/renewal path also restore on demand. The demo owner key uses the local demo account identity; production must use a server-provided stable account ID, never a profile name or client-authored identity.

No backend service, database migration, production AI generation, live public-review publication or server synchronization was implemented. The website's reports are independent fixtures; they are not represented as generated from locally saved customer answers. Demo moderation state remains local/in-memory; a restored public review is not assumed approved.

Required live contracts:

1. Authenticated feedback get/upsert for user + request + plan version + week, with immutable meal/option identity, enum answers, optional private comment, explicit consent, separate public text, optimistic revision, server timestamp and idempotency key. Validate week eligibility and ownership on the server. Prevent favorite/disliked conflicts and duplicate response counts.
2. A separate moderation projection containing only explicitly consented public content. Never expose the private payload through reviews/support/public endpoints. Respect consent withdrawal and preserve moderation/audit history.
3. Versioned preference suggestions with originating feedback/report references, confidence/completeness metadata, user overrides and explicit accepted/rejected state. Ordering a plan must capture confirmed questionnaire and accepted preference revisions. Rejecting suggestions must not reapply them later.
4. Specialist-scoped patient report listing with patient/week/version filters, pagination, report IDs, reporting period, generatedAt, source data revision, AI/sample provenance, completeness, status and structured sections. Compare equivalent periods and distinguish unmeasured data from zero. The backend must generate/update these asynchronously and authorize access only to assigned patients. Health changes should reference questionnaire versions; messages/health text must not leak into analytics.
5. Distinct expired-session, permission, validation, duplicate/stale revision, pending generation and unavailable-service responses. The frontend must use authoritative server outcomes when these contracts are connected.

## Files and preview

- `lib/data/weekly_feedback.dart`: models, repository interface, memory and owner-scoped persistent demo adapters.
- `lib/data/demo_store.dart`: eligibility, ownership/version validation, private/public separation, editable suggestions and new-request snapshots.
- `lib/screens/weekly_feedback.dart`: structured form, saved state and next-plan review.
- `lib/screens/user.dart`: existing profile/streak routes retain their public screen entry and open the new form.
- `lib/screens/wallet_flow.dart`: renewal review before purchasing a new plan.
- `lib/main.dart`, `lib/app.dart`: repository wiring and restoration.
- `lib/widgets/weekly_progress.dart`: feedback entry without reward prerequisite.
- `backend/admin-web/weekly-reports.js`, `specialist.js`, `specialist.html`: authenticated sample report screen.
- `test/weekly_feedback_test.dart`, updated moderation tests, `tool/test_weekly_reports.cjs`: feedback and report verification.

For the app, use an approved demo plan on its last day or complete the program, then open the profile's program feedback action or the streak card's feedback link. Select answers, optionally consent to a separate public text and save. To review/edit/reject preferences, choose a new plan from the service screen.

For the specialist website, sign in with the existing authentication and open weekly reports. The browser contract test uses explicit auth fixtures and sample report records without creating accounts. Screenshots under `screenshots/phase5` show the feedback form, saved response and specialist report; they were visually inspected.

## Verification

Full Flutter suite: 98 passing tests, including five new Phase 5 tests for eligibility independent of reward, consent/moderation, account isolation and duplicate prevention, persistence/retry, accepted/rejected preferences, questionnaire preservation/new-request capture and visible mobile form flow. Browser report tests passed for patient/week selection, report versions, comparison, partial/pending/failed scenarios and tablet layout. The existing staff authentication/navigation suite also passed.

Flutter analyzer and release web build are checked before delivery. Backend/provider integration and real multi-device report generation remain dependencies, not verified features of this frontend phase.
