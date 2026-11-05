# Demo tracking

The demo uses self-hosted Umami on the same server. `/insights/script.js` and
`/insights/api/send` proxy only the tracker and collection endpoint. The Umami
administration endpoints are not exposed to the Internet. The public website ID
is in `demo/tracking-config.js`; credentials stay under `/etc/sabzine` on the server.

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
termination can lose the last checkpoint. Exits are the last observed step in
visits inactive for two minutes that have not registered a phone. These are
provisional and disappear when the visitor returns, not proof a browser closed.
Exit percentages divide by all such abandoned visits. Individual paths are not
returned or displayed. Stage tables include at most 200 steps.
The admin view polls every five seconds while visible. Active visits have a
foreground heartbeat within 25 seconds and no subsequent presence-end event.
The client sends heartbeats every ten seconds until 60 seconds of inactivity.

`POST /v1/demo/submissions` stores completed questionnaire snapshots in the main
database, separately from Umami. A normalized phone is indexed by keyed HMAC;
phone and all answer snapshots are encrypted with the server's FIELD_KEY.
Submission UUIDs make retries idempotent; no public lookup exists. The existing
demo OTP is not a real SMS verification, so `phone_verified` remains false.
Keep FIELD_KEY backed up securely: it is required to decrypt submissions.
Events tagged `qa` are excluded from every admin report. Reporting starts at
installation; historical activity cannot be recovered. Browser blocking and
network failures may reduce counts. DNT, GPC, and the localStorage preference
`mydiet.analytics.disabled=1` disable tracking.

Campaign example:
`https://my-diet.ir/demo/?utm_source=telegram&utm_medium=channel&utm_campaign=launch`

The server's admin API uses staging mode with unavailable external SMS/payment/AI
providers, strong secrets, HTTPS-only refresh cookies and an Nginx route allowlist.
Only staff sign-in, staff admin APIs and health are exposed. This does not deploy
the customer app API, payment gateway, or SMS service. No development OTP route is
available in staging. Existing local admin credentials can be imported as a salted
password hash; no plain password is added to the repository.

Umami has a separate database and a daily custom-format backup alongside the main
database. The backup directory is root-only. Local backups share the server's
failure domain; off-server backups are a separate operational concern.
