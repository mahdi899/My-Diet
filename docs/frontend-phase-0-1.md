# Sabzine frontend — phases 0 and 1

## Scope and audit

Only phases 0–1 of the supplied frontend prompt are implemented. No database,
controller, clinical policy, payment provider or AI service is changed.

| Surface / feature | Starting point | Phase 1 outcome | Later work |
| --- | --- | --- | --- |
| Flutter entry | Guest home plus a reachable specialist role picker | Customer-only root and navigation; no role picker or panel switch | None for role separation |
| Splash | Logo-only splash | Preserved | None |
| Customer dashboard / plan / tracking | Existing local DemoStore UI | Preserved; private tabs/routes require login | Actual plan repository integration |
| Authentication | Local 30-day demo session | Separate server auth adapter, OTP UI, secure native token storage, web refresh cookie, expiry/logout/revocation handling | Verify against configured SMS/server deployment |
| Questionnaire / profile | Local versioned answers and editing | Existing editor preserved behind login | Server questionnaire repository |
| Wallet and purchase | Local Toman demo flows | Preserved behind login; no payment claims added | Live money/order integration |
| Messaging | Local text conversation fixtures | Preserved behind login | Phase 7 media and live messaging |
| Specialist | Legacy mobile clinical components | Separate authenticated web shell and 7 navigation sections | Clinical editing in phase 6; messaging in phase 7 |
| Admin | Existing authenticated HTML/CSS/JS API frontend | Existing integrations retained, shared session adapter, additional phase-labelled navigation | Configuration/reports in phases 9–10 |
| Public site | Four static pages in sibling `sabzine site` | Preserved without edits | No backend added |

The Flutter app is still a UI prototype. Authentication can be connected separately;
doing so does not make the DemoStore wallet, questionnaire, plans or chat live.
The login screen explicitly describes this boundary.

## Feature inventory for remaining phases

| Requested capability | Current status | Target phase |
| --- | --- | --- |
| Meal detail modal and seven-day plan | Existing portions/calories, needs preparation/ingredient extension | 2 |
| Two approved alternatives | Missing | 2 |
| Four-way meal logging | Existing eaten checkbox only | 3 |
| Shopping list | Missing | 4 |
| End-of-week feedback | Existing general reviews; structured feedback and AI report missing | 5 |
| Specialist clinical record/editor | Existing legacy Flutter components; web editor pending | 6 |
| Telegram-like chat/media and request cards | Existing local text chat and revision workflow; web/media pending | 7 |
| Configurable qualifying-day streak | Existing weekly-completion money reward; new campaign model pending | 8 |
| User/specialist retention/quality reports | Partial admin metrics/SLA; requested reports pending | 9 |
| Aggregate journey graph | Backend tracking exists; requested admin visualization pending | 10 |
| Global online-only interaction handling | Session network states implemented; global connectivity gate pending | 11 |

## Source of truth

- App and staff web: `C:\Users\Mohamadi\Desktop\sabzine\sabzine`.
- Android Studio copy: `C:\Users\Mohamadi\source\repos\سبزینه`.
  Run `tool/sync_android_studio.ps1` after edits.
- Public website authoring source: sibling `C:\Users\Mohamadi\Desktop\sabzine\sabzine site`.
  The GitHub `sabzine site` directory is its publication snapshot. It was pushed
  from an isolated checkout; the local app checkout now includes the published site snapshot after synchronizing main.
  This phase does not copy, edit, publish, or create another site source.

## Screen and route map

### Customer Flutter

Logo splash → guest home. Bottom navigation: home, plan, tracking, profile.
Plan and tracking ask for login when signed out. Guest profile offers login.
Pushed private screens (messages, questionnaire, history, orders, doctor, review)
use the common guarded navigation helper. Plan acquisition retains its dedicated
login → questionnaire/confirmation → pricing flow.

Expired or invalidated sessions close pushed private screens, clear active customer
request projections and return to the customer flow. A foreground timer checks local
expiry; server sessions are checked again on resume. Connectivity failure during
session verification blocks private access while preserving saved refresh material
for retry. Full online-only connectivity management belongs to phase 11.

### Staff web

Served by the existing backend static mount; no new backend route is required:

- `/admin/` — administrator login and workspace.
- `/admin/specialist.html` — specialist OTP/MFA login and workspace.

Specialist hash routes:

| Hash | Screen | Phase 1 source |
| --- | --- | --- |
| `#dashboard` | Work overview | Existing specialist queue and conversation APIs |
| `#patients` | Patient records | Explicit phase 6 shell, no invented patient list |
| `#review` | Awaiting review | Existing filtered queue, read-only |
| `#changes` | Change requests | Existing revisions queue, read-only |
| `#conversations` | Conversations | Existing conversation list, no new chat editor |
| `#reports` | Weekly reports | Explicit phase 5 shell |
| `#profile` | Professional identity | Existing specialist profile API, read-only |

Dashboard queue counts represent returned rows (up to 100 per existing API), not
unbounded totals or unread-message counts.

Existing administrator sections remain, including AI provider settings,
notifications, money settings, reviews and support. New hash routes are
`#questionnaire`, `#reasons`, `#user-reports`, `#specialist-reports`, `#journeys`.
These are clearly labelled future-phase shells; they do not simulate saving
configuration or present fictional analytics.

Both staff surfaces use shared `staff-session.js` and `workspace-ui.js`. The administrator retains its latest redesigned UI and automatic loading without manual refresh buttons. Specialist styles are isolated in `specialist-base.css` and `workspace.css`. Refresh cookies remain HttpOnly; access tokens stay in memory.
API authorization remains enforced by the existing server. Hiding navigation is
not a replacement for server authorization.

## Legacy component migration

Legacy Flutter expert/admin files remain as references for later web migration.
They are not routed from the customer app. Existing legacy component tests run in
`test/legacy_staff_harness.dart`, which is test-only and never imported by the app.
Customer app tests separately assert that stale staff role state cannot open staff
screens. No clinical editor was reimplemented prematurely.

## Authentication API contract

| Operation | Existing endpoint | Notes |
| --- | --- | --- |
| Customer/specialist OTP | `POST /v1/auth/otp/request` | `{phone}` |
| OTP verify | `POST /v1/auth/otp/verify` | `{phone,code,platform,deviceLabel}` |
| Admin password login | `POST /v1/auth/admin/login` | Existing username/password flow preserved |
| MFA | `POST /v1/auth/totp` | Existing staff `totpToken` challenge |
| Restore/refresh | `POST /v1/auth/refresh` | Web: HttpOnly cookie + `x-sabzine-client:web`; native: refresh token body |
| Logout | `POST /v1/auth/logout` | Revoke session on server before claiming successful logout |

Session payload: `accessToken`, `accessExpiresAt`, `sessionExpiresAt`, `role`,
and `refreshToken` for non-web clients. Respect the server's expiry; never create
a new local 30-day expiry for a real session. The existing server owns the maximum
session lifetime. A shorter remaining lifetime is valid.

Flutter's demo session and server session have separate stores. Native server
refresh material uses flutter_secure_storage. Web requests use credentials and
persist expiry metadata only; refresh tokens are not written to browser storage.
Serve web and `/v1` under the same origin, or explicitly configure the hosting
proxy/CORS/cookie behavior outside this frontend task.

No mobile staff login is accepted. Native staff sessions accidentally created by
OTP are revoked where possible. Staff web checks the returned role before showing
its workspace. Concurrent refreshes within each client are coalesced.

## Preview

Default customer UI preview (explicit demo login, no real SMS):

```powershell
flutter run -d chrome
```

Authentication integration mode (other customer data is still demo):

```powershell
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:8781
```

For web integration, use the preview proxy below or a same-origin host. Configure
the Flutter web host/port consistently with the API cookie origin.

Build and serve all frontend surfaces locally:

```powershell
flutter build web --release --no-web-resources-cdn --no-wasm-dry-run
node tool/preview_frontend.cjs
```

- Customer: `http://127.0.0.1:8781/app/`
- Specialist: `http://127.0.0.1:8781/admin/specialist.html`
- Administrator: `http://127.0.0.1:8781/admin/`
- Public website: `http://127.0.0.1:8781/site/`

The preview server proxies `/v1` to `http://127.0.0.1:3000` by default (`SABZINE_API_TARGET`
can override it). If the backend is unavailable, staff login shows a real connection
error. It never opens a fake authenticated session. No default staff credentials
or accounts are created.

## Verification

- Flutter analyzer and full Flutter suite.
- New auth tests: server expiry preservation, refresh persistence boundaries,
  revoked vs unavailable session, role rejection and concurrent refresh.
- New customer tests: no staff routes, guest private-feature guards, expiry while
  inside a private screen.
- `tool/test_staff_frontend.cjs`: browser contract tests against explicit fixtures
  for specialist OTP, navigation, staff role checks, tablet layout, permission errors,
  administrator navigation, logout and revocation.
- `screenshots/phase1/*-demo.png` are browser captures using API fixtures, not proof
  of live authentication or real patients. Login screenshots contain no patient data.

Provider credentials, a running backend and a configured SMS provider are still
needed for live staff/customer authentication verification. No database or backend
implementation was changed. Phases 2 through 6 are documented separately in frontend-phase-2.md through frontend-phase-6.md; later phases remain pending.

Verified Flutter result: 75 tests passed. Staff browser contract suite passed.
