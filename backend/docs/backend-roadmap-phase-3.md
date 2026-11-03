# Phase 3 — AI drafting and reliability

API connections are still added/activated through the existing administrator panel.
No provider key is hard-coded. The configured adapter reads the active encrypted
connection and sends requests using its model/endpoint. Credentials never enter
the draft or customer response. Configured providers must support the documented
OpenAI-compatible chat-completions JSON contract; arbitrary vendor protocols need
an adapter, not merely a different display name.

## Draft contract

Configured output must contain seven days of meals, each with complete `primary`
and `alternative` objects. Their shape is the Phase 2 option shape without
`optionId`, `kind` or `approved`. The server supplies UUIDs and the two source kinds
and always stores `approved:false`. It never invents the specialist-authored option.
The specialist adds that third option and approves all three before publication.
The schema is embedded in the system prompt; actual output is independently parsed
and validated, including duplicate meal type/time slots, real clock times, positive
quantities, nonempty ingredient names/instructions, units/bases and consistent
primary title/calories. Primary calories must be known to satisfy the existing
publication contract; unknown alternative calories remain null.

Model input retains the existing minimized questionnaire codes, goals, budget,
preparation constraints and scrubbed untrusted clinical text. It additionally
contains the preceding seven days' recorded/eaten meal counts, recorded-day count
and server cutoff, without identity/chat data. These are self-reports, not proof of
consumption. Substitution reasons, richer weekly feedback and structured specialist
notes are not fabricated: their authoritative domains land in subsequent phases.
They must be added to this minimized contract when available, rather than sending
unrelated conversations. Existing high-risk exclusions and manual editing remain.
Explicit allergy-label matches against generated ingredient text reject the draft;
synonyms and nutritional/clinical accuracy still require specialist review.
The existing calorie warning heuristic is not an approval gate or proof of fitness.

## Execution and cost control

- New `ai_execution_claims` migration durably claims each request before any paid
  provider call. Duplicate jobs cannot create another version or repeat a call.
- A database advisory lock serializes the cap check, provider call and cost write
  across workers. Acquisition is nonblocking so waiting workers do not exhaust
  the pool. Busy jobs throw for bounded pg-boss retry (three retries, 30s delay).
- HTTP calls have a 60s timeout and a one-megabyte streaming response limit.
  Only an explicit 429 rejection is retried, once after 250ms. Authentication,
  malformed output and uncertain network outcomes do not trigger paid failover.
- Provider/model/prompt `admin-v2`, schema version, attempt, latency, usage and
  configured token-price cost stay in the existing generation/version provenance.
  Cost is an estimate based on configured pricing, not a provider invoice.
- Kill switch, daily cap and unresolved-cost holds lead to a blank editable week.
  Failure codes distinguish authentication, rate rejection, invalid output,
  oversized response, restriction conflicts and uncertain network outcome.
- A crash leaves a durable started claim. Existing maintenance requeues stale
  generating work after 15 minutes; replay creates a manual-review draft and a
  visible `provider_outcome_unknown` attempt instead of charging again. An operator
  should not delete claims to retry. A bounded queue failure before acquisition
  may need operator redrive; queue/dead-letter operations remain Phase 13 scope.
- In-flight cancellation records a failed attempt and reconciliation hold instead
  of publishing or losing track of possible provider spend.

## Administrator recovery endpoints

`GET /v1/admin/ai-executions` returns the latest 100 claim states/timestamps/error
codes, without clinical payloads. The existing AI-attempt and cost endpoints remain.

`POST /v1/admin/ai-executions/:requestId/reconcile` accepts
`{ "costMicros": 0, "reason": "Verified no charge in provider billing" }`.
Use only after verifying actual provider billing. Zero is an explicit confirmed
no-charge result, not an inference from timeout. Negative/unsafe amounts are
rejected; a failed claim can be reconciled once, and actor/reason/previous error
are audited atomically. Started/live claims cannot be reconciled. Recovery must
first resolve an interrupted request to its manual-review state. Reconciliation
releases the uncertainty hold but never restarts that paid generation.
The API-addition modal and activation workflow are unchanged; these operational
endpoints do not expose or replace credential management.

## Migration, tests and boundaries

`1736812800000_ai_execution_claims.sql` is additive. Historical migrations,
wallet/plan records and provider credentials are unchanged.
Pre-deploy generating requests without a version are conservatively claimed as
uncertain during migration; drain/stop workers before deploying this migration.
The configured daily cap is admission control based on recorded estimated cost;
a single provider call can exceed the remaining estimate, and invoice pricing can
differ. It is not a guaranteed provider-side monetary ceiling. Configure the
provider's own spending limit for a hard external billing boundary.

Migrations were tested
only on disposable PostgreSQL; production rollout still requires an authorized
migration window. Existing legacy-fixture migration tests now cover both additive
Phase 2/3 migrations.

Unit coverage includes 429 bounds, ambiguous network outcome (one call), auth
failure, oversized response, malformed/duplicate slots and primary consistency.
PostgreSQL coverage includes duplicate generation, manual crash recovery without
a second draft/call, one-time audited reconciliation, and publication/privacy
regressions. HTTP tests use controlled fetch responses, not a live provider.
No live AI/SMS/payment integration is certified by these tests. The fake provider
remains a development fixture and cannot satisfy production readiness.

Validation passed: typecheck, lint, build, 59 unit tests and all 38 PostgreSQL
integration tests across 16 files. No tests were skipped and no production
migration/provider call was performed. Targeted migration verification was repeated
after adding conservative claims for pre-deploy in-flight requests.
