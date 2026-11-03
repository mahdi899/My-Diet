# Backend completion — Phase 0 audit

Audit date: 2026-11-03. Source baseline: `2975f8257e213681d825c8b435fb69f6d192ceb7`.
Scope: the backend-completion prompt supplied on the desktop. Its phase numbers
are **not** the phase numbers used by the pre-existing test/migration filenames.
Actual checkout is `D:/sabzine`; the prompt's Mohamadi desktop paths are stale.

This phase changes documentation only. No production migrations or provider calls
were performed. The owner's explicit instruction authorizes a commit/push for
each completed phase; implementation of the next phase waits for confirmation.

## Verified inventory

Status describes coverage of the new prompt, not production readiness.

| New phase | Status | Evidence and remaining work |
| --- | --- | --- |
| 1 Identity/access | Partial | `src/identity/identity.service.ts` issues ten-minute JWTs, hashed rotating refresh tokens, fixed 30-day expiry, reuse revocation, OTP attempt limits, staff TOTP and admin passwords. `src/common/auth.ts` checks live DB roles/session revocation. Audit concurrent OTP rate limits, refresh/logout races, browser cookie/CSRF contract and reassignment isolation before marking complete. SMS delivery is externally blocked. |
| 2 Plan domain | Partial | `src/plans/plans.service.ts` has versioned drafts, optimistic locks, verified-specialist publication, required-question blocking, dated previous-version reads and corrections. `publish` is transactional. Meal/item schema lacks the complete approved two-alternative, option/portion/basis model required here. Historical consumption needs an immutable version/option reference. |
| 3 AI | Partial | `plans.generate`, `adapters/configured-ai.ts`, `ai/minimize.ts`, `ai/cost.ts` implement minimized inputs, validated seven-day JSON, provider/model usage, timeout, cost cap and manual fallback. Configured HTTP is present but not provider-verified. Complete slot validation, positive quantities, two-option rules and retry/uncertain-charge semantics. `ai/warnings.ts` has an 800–3500 warning heuristic: this must not become a clinical suitability gate. |
| 4 Consumption | Partial | `tracking.setMeal` validates ownership/published meals and server Tehran current day, then upserts a boolean eaten flag. No full less/more/different/skipped/unknown schema, option selection, correction audit or unknown-calorie projection. |
| 5 Shopping | Missing | No backend shopping projection/service found in `src`; existing Flutter shopping UI is not a server implementation. Needs compatible-unit aggregation, selected-option version and flag preservation. |
| 6 Feedback/reports | Partial | `tracking.review` and `program_reviews` exist; full private weekly feedback, explicit publication consent, versioned confirmed preferences and traceable weekly AI patient reports are absent. |
| 7 Messaging/media | Partial | `messaging.service.ts` checks conversation participation, persists text, marks reads and supplies notifications. `realtime.service.ts` supplies notification/message recovery with timestamps. Message listing is unbounded and sends lack client idempotency. No authorized private image/voice upload/finalization/signature/storage pipeline. Timestamp recovery needs stable ordering/tie handling. |
| 8 Change requests | Partial | Existing request timelines, questions/replies/withdrawal, correction drafts and queues are reusable. Complete reason snapshots, dedicated resolution endpoints, approval tied atomically to replacement publication, duplicate/open-request rules and viewer-specific events. |
| 9 Money/rewards | Partial | `money.service.ts` locks wallets/payments/orders, records integer Toman cash/promo and idempotent sandbox credits/refunds. `tracking.rewardIfComplete` issues unique weekly completion promo credit with ledger/notification in the caller transaction. This is **not** the requested configurable seven-consecutive-day campaign; retain existing financial records and introduce campaign participation/milestones. Live gateway verification is absent. |
| 10 Reporting | Partial | `reports.service.ts` uses read-only queries for credited payment totals and specialist 24h SLA from request events. Cohort retention, denominators/windows, food normalization, historical specialist ratings and message/request timing are incomplete. |
| 11 Journey analytics | Missing | Existing `tracking` concerns meals, weights and rewards; no bounded anonymous/authenticated journey-event ingestion or aggregate directed screen graph found. Extend the existing module rather than introduce a competing analytics system. |
| 12 Admin/privacy/public | Partial | `admin` provides questionnaire/config/prices/specialist assignment/review moderation/audit/AI controls. `privacy` provides deletion/de-identification and clinical fields use encryption. Public config and approved reviews exist. Article CRUD/publication/read API and purpose/version consent are missing. |
| 13 Delivery/reliability | Partial | pg-boss generation/push workers, transactional outbox relay, maintenance/dead-letter retry, liveness/readiness, OpenAPI generation and PostgreSQL tests exist. Full new-domain coverage, private media recovery and authoritative frontend contract remain to be added as phases land. |

## Access/reassignment findings to address first

`admin.service.ts:assign` updates the request, conversation participation and audit
through separate pool calls. Specialist deactivation clears open assignments.
Phase 1 must define and test transactional reassignment, remove old participation,
preserve customer/support access, and protect historical media/conversations.
The current reassignment implementation adds the new participant without removing
the old specialist. Because chat and realtime use participation, this is a concrete
access-control gap to close in Phase 1, not merely a transaction-style preference.
Client role/specialist selection must never substitute for these DB checks.

`requestOtp` counts recent rows before insertion without a per-phone/IP lock.
Sequential limits exist, but concurrent requests can evade count/cooldown checks;
this is a targeted Phase 1 regression test, not an observed provider result.

## Dependency map

```text
identity + assignment (1)
  -> versioned options + publication (2)
     -> validated AI drafting (3)
     -> consumption + substitutions (4) -> shopping projection (5)
       -> weekly feedback/preferences/reports (6)
  -> authorized messaging + private media (7)
     + publication (2) -> change-request resolution (8)
  -> wallet verification + consumption (4) -> campaign rewards (9)
feedback (6) + immutable assignment + requests (8) -> reporting (10)
identity (1) + bounded event collection -> journey aggregation (11)
all domains -> admin/privacy/public articles (12) -> delivery verification (13)
```

Payment/draft privacy remains an invariant throughout: a free dashboard/public
configuration never grants access to unpaid or unpublished meal content.

## Additive migration plan

No migration is needed for this audit. Historical SQL files stay untouched.
Proposed migrations are subject to each phase's verified implementation:

1. Assignment history and supporting indexes/constraints; preserve existing session
   and refresh rows. Add only proven missing lifecycle fields.
2. Versioned meal options/ingredients/approval metadata; nullable historical option
   references first. Backfill existing primary meals deterministically, without
   inventing alternative approval, raw/cooked bases or calories.
3. Generation attempt/provenance and retry keys as required by actual schema.
4. Structured consumption plus append-only correction/substitution history. Map
   legacy true to recorded-as-planned and false conservatively; false alone does
   not prove a skipped meal. Retain original rows for traceability.
5. Shopping projection version and per-owner flags keyed to stable ingredients.
6. Private feedback, consent, preference versions and sourced weekly report versions.
7. Media lifecycle, ordered message cursors, request-id uniqueness and upload expiry.
8. Reason snapshots/resolution links; enforce open revision/publication concurrency.
9. Campaign versions, participation, daily qualification and unique milestones;
   preserve cash/promo ledger, weekly rewards and explicit compensating entries.
10. Reporting indexes and historical assignment attribution; never guess past staff.
11. Bounded deduplicated events/session metadata with retention and aggregate indexes.
12. Consent records/articles/versioned configuration where not already supported.

For each migration: exercise on a fresh disposable PostgreSQL and a legacy fixture,
validate row counts/balances/references before and after, document backfill unknowns,
and separate application rollout from production migration execution. Retain
backward-compatible fields until consumers have migrated. No production execution
is authorized by this audit.

## Frontend compatibility plan

- Keep `/v1` routes and current envelopes; add fields/endpoints instead of replacing
  existing request status names. Publish explicit UI-label mappings in each phase.
- Preserve public config/reviews and guest navigation; private data requires ownership.
- `lib/main.dart` enables server authentication only with `API_BASE_URL`;
  `lib/data/demo_store.dart` still supplies many screens. A successful APK build is
  not evidence of backend integration.
- Audit integration screen by screen: dashboard, questionnaire, plan/day/meal editor,
  shopping, weekly feedback, messaging, wallet/pricing, change requests and specialist
  clinical workspace. Current imports in `lib/screens` show demo-store dependencies;
  imports alone do not prove every field is demo data.
- Web uses the existing auth controller's refresh cookie contract; mobile uses secure
  refresh storage. Document rotation/revocation errors before client changes.
- Introduce stable IDs for options/slots and explicit null/unknown calories; preserve
  exact plan version for logs. Add pagination and durable realtime cursors with an
  adapter window for old responses.
- Specialist and admin workspaces consume server authorization; no visual redesign
  is part of this backend roadmap.

## Provider readiness (inspection, not live certification)

| Integration | Implementation | Verification / readiness |
| --- | --- | --- |
| Console OTP | In-memory development sink; masked logs | Local tests only; no SMS network delivery. |
| Kavenegar SMS | `UnavailableSmsProvider` throws | Blocked: implement HTTP adapter, credentials and sandbox/live verification. |
| Sandbox payment | DB payment completion; no card collection/network | Local simulated verification only; not a bank sandbox certification. |
| Zarinpal / IDPay | `UnavailablePaymentGateway` | Blocked: real create/verify/inquiry adapters and credentials. |
| Fake AI | Deterministic fixture meals | Development/tests only; never evidence of model accuracy. |
| Configured AI | Encrypted DB credentials, public endpoint validation, OpenAI-compatible HTTP + JSON validation | Actual network path exists; no real credential/provider call made in this audit. Provider-specific compatibility/usage must be verified. |
| Console / default FCM push adapter | Console sink / `UnavailablePushProvider` | Automated domain notifications through this adapter are not live FCM. |
| Admin FCM campaigns | `admin/integrations.service.ts` uses firebase-admin and encrypted service account | Separate real HTTP-capable implementation; local validation tests do not verify external delivery or receipt. |
| Private media storage/scanning | No private upload pipeline found | Blocked pending storage adapter, credentials, validation and scan policy. |

Production env checks reject development-only providers. Configuring a provider name
or saving a credential does not prove readiness. Never expose credentials in API
responses or include clinical/chat content in notification/analytics payloads.

## Baseline checks

Executed against the existing backend before any runtime implementation changes:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 56 tests, zero skipped/failed.
- `npm run build`: PASS.
- `npm run test:integration`: FAIL / incomplete baseline run. Existing runtime
  phase 0 and weekly-reward phase 10 checks passed; legacy product suites 1, 13,
  14 and 15 reported failures. Other results are not asserted here. After phase 15
  reported failure the runner stopped advancing and was interrupted; no passing
  full-suite total is claimed. This is an existing baseline issue, not a regression
  introduced by this documentation-only phase.

The legacy fixtures in `test/integration/phase1.spec.ts` and
`test/integration/phase15.spec.ts` create admin users and call the OTP login helper
for their admin token. `IdentityService.verifyOtp` explicitly returns 403
`admin_web_only` for that role. Update fixtures to real password-based admin login
in Phase 1, without weakening production auth; then rerun all integration tests
and investigate any remaining independent failures. Test teardown/worker shutdown
also needs bounded cleanup so a failed setup cannot stall the suite. The current
baseline does not certify all wallet/publication acceptance criteria.

Integration tests initialize isolated embedded PostgreSQL clusters and run repository
migrations there; they do not use the application's production database. Passing
legacy tests is not proof of new-prompt acceptance criteria.

## Phase 0 deliverables / boundary

This document supplies inventory, dependencies, planned migrations, client compatibility,
provider readiness and baseline verification. No API route, schema or worker changed.
Next phase is **Phase 1 of this roadmap**: harden the existing identity/session and
assignment behavior, add targeted concurrency/authorization tests, report API impact,
commit/push under the requested author, then wait for Phase 2 approval.
