# ADR 0002: Toman wallet

The shipped Flutter app charges toman, not tokens. Service prices and the weekly reward are server-side configuration. The prototype seed is:

- new plan 500,000 toman
- AI revision 150,000 toman
- specialist revision 250,000 toman
- top-ups of 200,000, 500,000, 800,000, and 1,000,000 toman, credited one-to-one
- weekly completion reward 200,000 toman

Phase 0 only stores the reward amount in `app_settings`. The ledger arrives with the wallet module.

The wallet will have two buckets. `cash` comes from a verified payment callback. `promo` comes from rewards and is not withdrawable. Purchases spend promo first. Sabzine never stores card numbers; the app only redirects to the gateway. Gateway amounts in rial are `toman * 10`, snapshotted on the payment row.
