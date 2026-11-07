# Phase 6 — specialist patient records and plan review

## Implemented website UI

The specialist's patient list and assigned request queues now open a clinical workspace with four sections: patient record, seven-day editor, version comparison, and required questions/answers. The public website and customer Flutter navigation remain separate.

Patient records display supplied name, age, height, current/target weight and goal, conditions, allergies, medications, pregnancy context, questionnaire answers, weight history, meal-recording/adherence summary, substitutions and weekly private feedback. An empty conditions list is shown as “none reported”; a missing value is “not provided.” Missing health information is never inferred from the request or patient name. Current plan metadata and historical version metadata/content are displayed when supplied. Historical content that the API does not return stays explicitly unavailable.

The editor supports seven days; adding/removing meals; meal type/time; food name; portion; calories; preparation time/method; raw/cooked quantity basis; notes; and individual ingredient names/quantities/units/bases. It supports creating a specialist alternative and editing/reviewing the AI alternative. It never silently invents a missing second alternative. Every alternative has a separate review action. Editing an alternative invalidates its approval; changing the original meal invalidates both alternative approvals.

The comparison view identifies additions, removals and edited meals, and displays human-readable original/draft details side by side. A published version is only used if it was actually received or belongs to the explicit demo adapter; the client does not fabricate it from an unrelated draft.

Publication requires a saved seven-day draft, valid recipe fields and ingredients, exactly one approved alternative from each source, an appropriate request status and edit lock. Required questions block publication while open **and** after an answer arrives until the specialist explicitly reads/acknowledges it. Missing/unknown required-question states are not treated as closed. The publish action has an explicit final confirmation. Failed publication preserves the prior published plan and the editable draft.

## Live integration and backend limitations

The live adapter preserves the existing backend routes:

- `GET /v1/specialist/queue` and `GET /v1/specialist/requests/:id`.
- `PUT /v1/specialist/requests/:id/draft` with the server's `If-Match` lock.
- `POST /v1/specialist/requests/:id/publish` with `If-Match`.
- `POST /v1/specialist/requests/:id/questions` with prompt/required.
- `POST /v1/specialist/info-questions/:id/acknowledge`.
- `GET /v1/specialist/patients/:userId/plan-versions` only when the response actually includes the authorized user ID.

The shared staff-session client now forwards optional request headers through the initial request and its authenticated retry. A save is followed by an authoritative read; lock mismatch or missing round-tripped content does not become a false “saved” state. 409 conflicts preserve local edits and require deliberate refresh/reconciliation. Pending writes disable controls. Delayed responses cannot replace a newer selected patient or repopulate a signed-out screen. Revocation still clears private UI even while a dirty editor is open. Visibility/auth refresh preserves an open editor rather than silently replacing it with the queue.

The current backend returns basic meal fields and ingredients, but **does not** supply the full patient context, previous plan contents, preparation metadata or two alternative approvals. The live screen says this up front. Existing basic-only draft edits still use the real endpoint. The adapter refuses to send richer edits to the legacy serializer, which would otherwise silently drop those fields. Live publication is conservatively blocked until the backend advertises and actually supports the complete clinical contract; a complete **frontend** is not a claim of a complete backend.

No backend controller, service, schema or migration was changed. No new patient API or AI-provider endpoint was invented. Missing patient IDs do not cause guesses or cross-patient history requests. The existing read-only meal-quality inspector remains available alongside the new editor.

## Explicit complete demo

An authenticated specialist can choose “باز کردن پرونده و ویرایشگر نمونه” from Patients or either review queue. This creates an isolated in-memory repository with fake clinical data, a prior published plan, a seven-day draft, pending required information and two unapproved alternatives per meal.

Use the day tabs to review alternatives, save the draft, then simulate the user's answer and explicitly acknowledge it. Publication unlocks only after all requirements are met. The demo offers save/publish failure scenarios and retains the previous program on failure. Its labels explicitly state that no real patient, AI generation or server publication is involved. A simulated user answer exists only in this adapter. Leaving a dirty editor requires confirmation; signing out clears it without retaining private data in browser storage.

## Contract needed for full live operation

1. Extend the authorized request response with a stable patient user ID, the complete patient context, questionnaire revision/answers, weight records, target context, medical/allergy/medication/pregnancy information, consumption/adherence denominators, substitutions, feedback and published-version contents. Null/absent means not supplied; an empty explicitly recorded list means none reported.
2. Advertise `capabilities.completeMealEditor: true` only when the save/read/publish contracts preserve all fields. Meals need stable `mealUid`, meal type/time, title, numeric calories, portion, preparation minutes/instructions, quantity basis, notes and structured ingredients. Alternatives require distinct IDs, `ai|specialist` source, full recipe details and authenticated approval metadata.
3. The server must assign/verify `reviewedBy` and `reviewedAt` from the authenticated specialist. The client initially marks an unsaved live review as unconfirmed; it must not be accepted as server evidence. Save/read must return canonical approval state. Publication must repeat all completeness, role, assignment, active/verified specialist, required-answer, version and clinical checks server-side.
4. Keep optimistic locking and atomic publication. Return the updated lock, then a canonical read of the complete saved draft. Never supersede the valid active plan until the replacement transaction succeeds. Preserve immutable historical versions and their contents, with authorized pagination where needed.
5. Return distinguishable permission/session, stale lock, unanswered information, invalid draft and service failures. A timeout or failed read after a mutation requires authoritative refresh before publication; the UI must never invent success or erase pending edits automatically.

## Files and preview

- `admin/clinical-repository.js`: separate live and complete in-memory demo adapters.
- `admin/clinical-workspace.js`: patient context, editor, comparison, question flow and publication gate.
- `admin/clinical.css`: green/cream responsive clinical layouts.
- `admin/specialist.js`, `specialist.html`: navigation and request entry points.
- `admin/staff-session.js`: version-header propagation through authentication retry.
- `admin/meal-quality.js`: stronger two-source validation and editor navigation guidance.
- `tool/test_clinical_workspace.cjs`: end-to-end browser contract scenarios.
- `references/screenshots/phase6/patient-demo.png`, `editor-demo.png`: Chrome fixture captures, visually inspected.

Serve the existing frontend (`node tool/preview_frontend.cjs`) and sign in at `/admin/specialist.html`. Open Patients or a review queue; use an assigned real request for existing integrations, or the explicitly named sample button for the full frontend scenario. Provider and database credentials are not needed for the browser contract tests because they intercept the actual web routes with declared fixtures.

## Verification

The clinical browser test passed for patient context, historical metadata, all seven days, independent alternative approval, add/remove meal, new specialist alternative and ingredient editing, required-response/acknowledgement lock, draft save failure/retry, publication failure retaining the previous plan, comparison, dirty-navigation cancellation, responsive tablet width, actual live-adapter PUT with If-Match preserved after a 401 refresh, live question/acknowledgement routes, permission denial, stale-version retention and revoked-session cleanup.

Existing staff authentication/navigation tests, meal-quality tests and weekly-report tests also passed. Flutter analyzer reports no issues. This phase changes the static specialist website, not Dart or Android runtime code; its runnable output was exercised directly in Chrome. No live clinical publication or complete patient API was falsely represented as verified.
