# Phase 10 — User and specialist reporting

Reports are admin-only and read from stored rows. A missing sample stays blank. A window that has not elapsed is `not_yet_measurable`, not zero. A window that has elapsed with nobody qualifying is a real zero.

## Retention

`GET /v1/admin/reports/retention?from=&to=&event=`

The cohort anchor is the Tehran civil date of each customer's first paid `new_plan` order. `to` is the as-of date. Week one, two, and four are 7, 14, and 28 days after that anchor. The three events are separate:

- `activity`: a session created or seen after the anchor day and inside the window.
- `tracking`: a meal recorded as eaten, or as as-planned, less, more, or different, inside the window.
- `purchase`: a later paid order inside the window.

An inverted range returns `invalid`. A range with no anchors returns `empty`.

## Foods and feedback

`GET /v1/admin/reports/foods?kind=selected|alternative|disliked|reason`

There is no food catalog. Labels are grouped only when they are the same after Unicode normalization and collapsed spaces. A short title is marked `uncertain` and is not merged into a longer recipe that contains those words. Alternatives are non-primary selections. Dislikes use the stored option title. Reasons stay grouped by the stable reason id.

`GET /v1/admin/reports/feedback` counts published-plan customers in the range, how many sent weekly feedback, and how many placed a later paid order. Continuation is not inferred from feedback.

## Specialists

`GET /v1/admin/reports/specialists?sort=rating|response|workload`

Ratings include pending and rejected reviews, tied to the specialist assigned on that plan. Fewer than five ratings is `smallSample`. No ratings leave the average blank, and those rows sort last on a rating sort. One specialist still returns one row.

Message time is elapsed minutes from the customer's first non-system care message to the specialist's first later non-system reply. System lines are excluded. Unanswered threads stay out of the average and count as pending. Plan-change first response (`changeResponse`) and resolution (`reviewTime`) are separate elapsed samples. `first_responded_at` is set once, on the first review, clarification, rejection, or approval. Pending workload is not folded into either average. Timings are not business hours.

Production migration was not run.
