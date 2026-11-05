# Shared SMS authentication

The Flutter app defaults to `https://my-diet.ir`; override with
`--dart-define=API_BASE_URL=...` for another environment. Both app and demo use
`POST /v1/auth/otp/request` and `POST /v1/auth/otp/verify`. Codes are six digits,
expire after two minutes, and cannot be reused. Existing per-phone and per-IP
limits and failed-code lockouts apply. No OTP or provider key is sent to analytics.

`SMS_PROVIDER=melipayamak` selects the real HTTPS adapter. Credentials are stored
only in `/etc/sabzine/sms.env` and the root-only runtime environment. Setting
`MELIPAYAMAK_PATTERN_ID` selects the approved service-template endpoint; otherwise
the configured sender line is used. Provider acknowledgments are required; failed
or uncertain dispatch is not silently retried.

The demo first stores an encrypted, unverified submission, then requests SMS.
After verifying the OTP, it marks the submission verified with the user's access
token. The backend independently matches the authenticated account's normalized
phone to the submission. Public requests cannot mark a phone verified.

Deployment status at integration: the credential balance probe succeeded. The
one authorized live send was held by Melipayamak for a filtered word requiring
operator review. A dedicated My Diet template was submitted with the account
owner's explicit acceptance of service terms. The template remains pending until
the vendor approves it. A real delivery and OTP round trip must be checked after
approval; mock tests and a successful credit probe do not establish delivery.

The generated debug APK is `build/app/outputs/flutter-apk/app-debug.apk`.
