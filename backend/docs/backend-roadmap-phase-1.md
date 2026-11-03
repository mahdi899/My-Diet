# Backend completion — Phase 1: identity, sessions and assignment

Date: 2026-11-03. Follows `backend-roadmap-phase-0.md`; this is not the legacy
phase 1 migration/test roadmap. No frontend redesign and no production migration.

## Implemented behavior

- OTP request transactions serialize IP and normalized-phone budgets with
  PostgreSQL transaction advisory locks (IP first, then phone). Parallel requests
  cannot exceed the existing 60-second cooldown or hourly/day budgets by racing
  an empty challenge table. Five incorrect verifications invalidate the challenge.
  Codes remain HMAC-protected in storage and absent from logs. Requests do not
  reveal whether a phone belongs to an existing account.
- Access JWTs remain ten minutes and sessions have a fixed 30-day absolute
  lifetime. Refresh rotation now locks the session and token together to serialize
  with logout/revocation. Reusing a consumed refresh revokes the family. The
  database continues to enforce the original expiry; rotation never extends it.
- Customer OTP cannot log in as admin. Admin password/TOTP and specialist OTP/TOTP
  remain the existing staff flows. Legacy integration fixtures now create password
  credentials and use the real admin login endpoint instead of expecting admin OTP.
- SessionGuard denies inactive specialists on authenticated routes, including with
  a previously issued access token. Public config remains accessible to guests.
- Manual assignment accepts an active, verified specialist with an active account.
  Assignment, care-conversation participant replacement, health-access log and
  audit entry commit together. Audit contains previous/new specialist and reason.
  Customer and support membership remain intact. Old specialists lose care-chat
  read/send/realtime access; the new specialist inherits that request conversation.
- Conversation lists, message/read access and realtime message recovery also
  check authoritative request assignment, protecting legacy stale participant rows.
- Specialist deactivation is transactional: remove care memberships and clear
  existing open request assignments. Existing question/reply/status/content records
  remain unchanged for the next assigned specialist. Unassigned open requests need
  administrator reassignment. Historical published request assignments are retained
  for attribution; an inactive specialist cannot use them to authenticate requests.
- Shutdown closes both direct SQL and replica pools after worker/module teardown.
  Kysely's lazy driver did not close the directly used pool when it had never
  initialized, leaving test sockets alive and causing reset errors after DB shutdown.
  Tests now finish without force-exit or swallowed uncaught errors.

## Modules and migrations

Runtime: `identity`, `common/auth`, `admin`, `messaging`, `realtime`, `database`.
Tests: password-login fixture and legacy integration fixtures; targeted PostgreSQL
tests in `test/integration/phase1.spec.ts`.

No schema migration or financial/data backfill is needed: existing locks,
participants, sessions, refresh rows and audit tables support these changes.
Historic migrations, balances, published content and customer records are preserved.
Stale care memberships are ineffective immediately through assignment-aware reads
and removed when an administrator reassigns/deactivates the specialist.

## Client contract / API compatibility

No route or response shape is removed. `/v1` routes are preserved.

| Flow | Contract |
| --- | --- |
| Guest | `/v1/public/config`, approved reviews and public content stay public; private `/v1/me/*` needs bearer auth. |
| Customer/specialist login | `/v1/auth/otp/request`, then `/v1/auth/otp/verify`; never submit role/specialist identity as a grant. Configured staff TOTP requires `/v1/auth/totp` to finish. |
| Admin login | `/v1/auth/admin/login` with username/password; handle `totpRequired` before assuming a session. |
| Web | Set `x-sabzine-client: web`; refresh is HttpOnly, SameSite=Strict, scoped to `/v1/auth`, Secure in production, and omitted from JSON. Send cookie credentials and that header on refresh. Deploy panel/API same-site or proxy them; do not relax cookie policy silently. |
| Mobile | Store refresh token in OS secure storage. Keep access token transient; atomically replace refresh after success and serialize refresh requests. Never log either token. |
| Rotation/reuse | A concurrent duplicate refresh is treated as reuse, revoking the family. Client must not retry an old refresh after a successful rotation or uncertain response; clear state and reauthenticate on 401. |
| Expiry/logout/revocation | Access checks current DB session on every private call. Absolute expiry is `sessionExpiresAt`; refresh cannot extend it. Logout/revoke affects existing access JWTs too. |
| Disabled staff | Authenticated requests return 403 `suspended`; administrator must reactivate/reassign as appropriate. |
| Assignment | Invalid/inactive/unverified target is 404. Previous specialist receives 404 for care conversation/request reads instead of the data. No public specialist marketplace added. |
| OTP limits | 429 `rate_limited`, generic invalid-code 401; preserve resend UI cooldown. No account-existence endpoint. |

## Verification

Targeted PostgreSQL checks cover parallel OTP requests, verification lockout,
parallel refresh/reuse, absolute expiry, logout, cookie privacy, guest access,
client role escalation rejection, private request ownership, reassignment audit,
care history retained for the owner/new specialist, old-specialist read/send and
realtime denial, and deactivation. Existing integration tests cover staff TOTP,
published/draft ownership and remaining role restrictions.

Final validation:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 56 unit tests.
- `npm run build`: PASS.
- `npm run test:integration` exercised all legacy suites; the first completed run
  found an incomplete specialist fixture (no profile) in legacy phase 12 after the
  active-profile guard was added. Fixtures 7, 9 and 12 now explicitly seed profiles.
- Final rerun of **all 16 integration files** with the same Node/tsx test runner
  and `--test-concurrency=4`: PASS, **35 tests**, no skipped/cancelled tests,
  clean exit code 0, no force-exit. This includes the new 11-test phase 1 suite.
- Targeted repeat of phase 1 after the final session-ID validation changes:
  PASS, 11 tests. Session deletion rejects malformed UUIDs with 400 and other
  users' sessions with 404; successful revocation also invalidates refresh.

There is no unresolved baseline test failure in the final all-file rerun. No
provider traffic, deployed database or production migration is part of these tests.

## External dependencies and limitations

SMS is still console-only in development/tests. Kavenegar remains explicitly
unavailable; no production SMS credential or verified external delivery was supplied.
No live SMS, push, payment or AI claim is made. These changes verify local business
logic against disposable PostgreSQL, not production integration readiness.

Private media endpoints do not exist yet; they must apply this assignment policy
when implemented in Phase 7. Existing timestamps use UTC instants and Tehran civil
date helpers; session expiry uses server/PostgreSQL time rather than device time.
Clinical verification changes beyond active-account access should continue to gate
publication; this phase does not grant unverified specialists publishing permission.
