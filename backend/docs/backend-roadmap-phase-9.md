# Phase 9 — Wallet, payments, and streak campaigns

The existing ledger stays append-only. Amounts are integer toman. Cash and promotional credit stay in separate buckets. An order spends promotional credit first and cash for the remainder. A refund or permanent-failure compensation returns each bucket to itself. Neither path rewrites a ledger row.

Sandbox top-ups credit the wallet only from the stored payment row. A browser success flag is not a verification. Gateways that would call an external network stay unavailable. Repeating a credited sandbox confirmation does not credit the wallet again.

`POST /v1/admin/orders/:id/compensate` refunds a paid order when its request is still queued or generating and the AI claim is `failed`. A second call returns the balance and does not add another ledger row.

## Streak campaign

Migration `1737331200000_streak_campaigns.sql` publishes version 1: seven consecutive days from 2026-10-24, 200,000 toman promotional credit on day seven, rule `recorded_meals`. A day qualifies only when every meal of the active paid plan is recorded as eaten or as a real portion. Skipped and unrecorded meals do not qualify. Login and `GET /v1/me/streak` do not qualify a day and do not move the wallet.

`POST /v1/me/streak/claim` with `commandId` credits each reached milestone once in the same transaction as the grant row. The same command returns the original response. A second command does not credit again. Two concurrent claims serialize on the wallet lock. A late-bulk anomaly holds the grant and does not pay. If a later correction drops the run below a paid milestone, the next claim adds a negative `campaign_reversal` when the promotional balance covers it. The original credit remains in the ledger. If the balance was already spent, the credit stays and a `reversal_uncollected` signal is recorded.

A customer who has already started a cycle keeps that campaign version after a newer one is published. The next cycle uses the new version. This is not proof of physical eating.

Production migration was not run.
