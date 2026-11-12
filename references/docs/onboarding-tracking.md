# Demo tracking

The demo uses self-hosted Umami on the same server. `/insights/script.js` and
`/insights/api/send` proxy only the tracker and collection endpoint. The Umami
administration endpoints are not exposed to the Internet. The public website ID
is in `onboarding/tracking-config.js`; credentials stay under `/etc/sabzine` on the server.

The existing admin panel has a **رهگیری سایت دمو** page at
`/admin/#web-analytics`. Its authenticated API is `GET /v1/admin/web-analytics?days=7`.
Allowed periods are 1, 7, 30, and 90 days. The API uses a PostgreSQL role with SELECT
permission only on Umami's event and session tables. The Umami container is pinned
to the provisioned image digest because reporting uses its PostgreSQL schema.

Events: `step_view`, `step_time`, `start_clicked`, `goal_selected`,
`question_interacted`, `back_clicked`, and `questionnaire_completed`.
Question events contain the goal and question number, never the selected answer,
input content, name, phone, or medical text. URLs retain only allowed goal and
ASCII campaign codes (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`utm_term`). Referrer query strings and paths outside this site are removed.

Active time is checkpointed every 10 seconds and on visibility/navigation changes.
Hidden time and inactivity beyond 60 seconds are excluded. Abrupt browser or OS
termination can lose the last checkpoint. Exits are the last observed step of
an anonymous path after two minutes without events, excluding paths that registered
a phone. A path UUID lives in sessionStorage across intro → goals → quiz; returning
to intro or from quiz to goals starts a new path. Reloading quiz also starts a new
path because answers reset; restoring quiz from the browser's back/forward cache
preserves its existing path. Closing a tab normally clears sessionStorage. A new path never replaces
an earlier path's exit, even when Umami reuses the visit ID. Resuming the same path
can update its provisional exit. Separate tabs with independent sessionStorage
have independent paths; browsers that duplicate a tab may copy sessionStorage.
An answered question advances the exit to the next displayed question.
Historical events without UUIDs are segmented at returns to intro/goals, quiz
re-entry, or a change of question goal. Historical simultaneous tabs cannot be
reconstructed perfectly. Exit percentages divide by abandoned paths, not visits.
Umami events stay anonymous. After a visitor verifies OTP, the app database stores that path id with the new user's phone. The admin session tables then show the phone; paths that never verified OTP stay blank. Stage tables include at most 200 steps.
The admin view polls every five seconds while visible. Active visits have a
foreground heartbeat within 25 seconds and no subsequent presence-end event.
The client sends heartbeats every ten seconds until 60 seconds of inactivity.

Regression checks: `node --test tool/test_tracking_paths.cjs` and, after building
the backend, `node --test test/unit/analytics-exits.spec.mjs` from `backend/`.
The SQL test needs `ANALYTICS_TEST_DATABASE_URL` (or `DATABASE_URL`) and uses only
query-local fixtures; it does not insert events into the analytics database.

`POST /v1/onboarding/submissions` stores completed questionnaire snapshots in the main
database, separately from Umami. A normalized phone is indexed by keyed HMAC;
phone and all answer snapshots are encrypted with the server's FIELD_KEY.
Submission UUIDs make retries idempotent; no public lookup exists. The existing
OTP is now verified through the shared SMS API. Until a valid code is verified,
`phone_verified` remains false. SMS delivery depends on provider template approval.
Keep FIELD_KEY backed up securely: it is required to decrypt submissions.
Events tagged `qa` are excluded from every admin report. Reporting starts at
installation; historical activity cannot be recovered. Browser blocking and
network failures may reduce counts. DNT, GPC, and the localStorage preference
`mydiet.analytics.disabled=1` disable tracking.

Campaign example:
`https://my-diet.ir/onboarding/?utm_source=telegram&utm_medium=channel&utm_campaign=launch`

The server's admin API uses staging mode with unavailable external SMS/payment/AI
providers, strong secrets, HTTPS-only refresh cookies and an Nginx route allowlist.
Only staff sign-in, staff admin APIs and health are exposed. This does not deploy
the customer app API, payment gateway, or SMS service. No development OTP route is
available in staging. Existing local admin credentials can be imported as a salted
password hash; no plain password is added to the repository.

Umami has a separate database and a daily custom-format backup alongside the main
database. The backup directory is root-only. Local backups share the server's
failure domain; off-server backups are a separate operational concern.
