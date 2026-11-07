# Phase 8 — configurable streak campaigns

## Screens

The customer home shows the server snapshot for the current cycle: each day's state (pending, pending verification, qualified, missed, rewarded), today's meal requirement, consecutive progress, milestone days and amounts, and the reset rule. A reward celebration opens only after the demo server has already confirmed a credit. The claim button reports a duplicate instead of adding the amount again. Login and opening the home screen do not qualify a day.

The in-app price screen publishes a new campaign version: consecutive-day count, an optional mid-cycle milestone, the final-day amount, start and end dates, and repeat behavior. Someone already inside a cycle keeps the version they started.

The admin website has a separate «کمپین روزهای پیاپی» section with the same settings. It is an in-browser sample. The existing weekly reward form still sends `PUT /v1/admin/reward`.

## What the screen does not decide

The card reads the stored snapshot. It does not turn meal ticks, the device clock, a login, or local storage into eligibility. The demo store is the stand-in server: a day is recorded only when that day's meals are saved, and the wallet moves only when that server returns a new grant. Real issuance, fraud checks, and idempotency still belong on the backend.

## Backend still required

The live server still pays `reward.weekly_completion_toman` for a completed program. It has no campaign table, no version lock, and no qualifying-day ledger. Until those exist, this phase must not be described as live reward processing. The server contract needs:

- a published campaign version with consecutive length, milestones, qualifying rule `recorded_meals`, start, end, effective date, and repeat;
- a rule that login is not a qualifying event;
- per-user cycle state that keeps the version already started when an admin publishes a later one;
- an idempotent grant id so a repeated claim cannot credit the wallet twice;
- day states `pending`, `pending_verification`, `qualified`, `missed`, and `rewarded` returned to the client.

## Files

- `lib/data/streak_campaign.dart`: demo reward server and snapshot.
- `lib/data/demo_store.dart`: meal recording settles the snapshot; login does not.
- `lib/widgets/weekly_progress.dart`: snapshot display. Opening the screen no longer claims.
- `lib/screens/pricing_admin.dart`: in-app campaign version form.
- `admin/streak-campaign.js`: admin sample repository and page.
- `admin/ui.js`, `app.js`, `index.html`: navigation entry.
- `test/streak_campaign_test.dart`, `tool/test_streak_campaign.cjs`.

## Preview

Customer: sign in as the demo user, approve a plan, and record meals. One recorded meal stays «در انتظار تأیید». Seven consecutive recorded days credit 200,000 toman once. Skipping a day resets the count.

Admin website: open `#streaks`. The banner states the page is a sample. Publishing a version and using «ثبت ۷ روز نمونه» shows a single credit, then a duplicate on the next press.

## Verification

`node tool/test_streak_campaign.cjs` covers login, partial verification, the day-7 credit, a duplicate claim, a missed day, a locked in-progress version, and a day-3 plus day-7 milestone.

Flutter tests cover the same customer rules, the old seven-day wallet credit and celebration, and the rule that a three-day midweek plan does not pay the seven-day milestone.
