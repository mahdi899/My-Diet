# Phase 9 — administrator reports and configuration

## Screens

The administrator site now has working user and specialist report screens, a questionnaire editor, and a reason editor that keeps stable ids.

User reports show week-one, week-two, and week-four retention for three separate events: returning to the app, recording a meal, and buying another plan. Each cell shows the count, the cohort size, and the percentage. A cohort that has not reached the window says «هنوز قابل سنجش نیست» instead of zero. A cohort that has reached the window and nobody returned shows a real zero. An empty date range says there is no cohort to measure. Food, alternative, disliked-food, and substitution-reason rankings, plus feedback participation and plan continuation, use the same range. Continuation is not inferred from feedback.

Specialist reports show the rating average and count, the one-to-five distribution, message-response time, plan-change review time, and pending workload. Message time and review time are separate. Missing ratings and missing timings stay blank rather than zero. Fewer than five ratings is marked as a small sample. One specialist still produces a leaderboard row. The sort is visible: highest rating, fastest message response, or most open work. Unrated specialists stay at the end of a rating sort.

Questionnaire questions can be renamed, reordered, required, deactivated, and published as a new sample version. The question id and the prompt stored on earlier answers stay put. Change-request reasons can be renamed or deactivated; the id and previous labels remain. Plan prices stay on the existing live tariff form. Streak rules stay on the phase 8 campaign screen. Review moderation stays on the live pending-review queue and only changes status.

Every new report screen says the figures are a phase 9 design sample, except the review queue, which is labeled as the live list.

## Backend still required

The server does not yet return cohort retention, food rankings, specialist timing, or questionnaire versions. Until it does, these screens are fixtures. A live report needs cohort denominators, the retention event, the as-of date, and an explicit not-yet-measurable state. Specialist timing needs separate message-response and plan-change samples, plus a pending count that is not folded into the average. Configuration needs stable reason and question ids, historical labels, and a rule that deactivation does not rewrite old answers.

## Files

- `admin/admin-reports.js`: calculations, fixtures, and the three screens.
- `admin/messaging-workspace.js`: reason edits keep ids and older labels.
- `admin/app.js`, `index.html`, `phase-shell.css`: navigation, review note, and bars.
- `tool/test_admin_reports.cjs`.

## Preview

Sign in to the admin site. Open «گزارش کاربران» and «گزارش متخصصان». Change the retention event and the date range. Open «پیکربندی پرسش‌نامه» and «دلایل تغییر برنامه», rename an item, and confirm the id is unchanged. Tariff, streak, and review links stay on their existing pages.

## Verification

`node tool/test_admin_reports.cjs` checks measurable and not-yet-measurable windows, a real zero, an empty range, separate retention events, rankings, unrated specialists, a one-person board, and preserved reason and question history.
