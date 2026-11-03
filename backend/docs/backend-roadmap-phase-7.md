# Phase 7 — Conversations, private media, and delivery

Existing text chat, support conversations, and the SSE event stream stay in place. This phase adds care conversations, private media, cursor reads, and explicit delivery/read receipts.

## API

- `POST /v1/me/care-conversation` opens the customer's conversation with the currently assigned specialist and records one system event. It does not create a second care conversation for the same request.
- `POST /v1/me/support-conversation` is unchanged and remains separate from care.
- `POST /v1/conversations/:id/messages` still accepts `{body}`. Optional `clientRequestId` returns the original message on retry. Optional `mediaId` attaches a ready upload owned by the sender in that conversation. Clients cannot set `kind=system`.
- `GET /v1/conversations/:id/messages` still returns the full array, now including kind, media id, and server `position`.
- `GET /v1/conversations/:id/timeline?after=&limit=` returns `{messages, nextCursor}` in position order. `after` is the last seen position.
- `POST /v1/conversations/:id/receipts` records `delivered` or `read` for a recipient. The author cannot acknowledge their own message. Read also moves the participant cursor.
- `GET /v1/conversations` adds `unreadCount` from messages after `last_read_at`.
- `POST /v1/conversations/:id/media` starts an upload. The response is an id and expiry, never a client-chosen storage key.
- `PUT /v1/media/:id` submits base64 bytes. The detected file signature must match the declared type and the image or voice purpose. A mismatch is quarantined and cannot be attached. Expired pending uploads cannot be finished.
- `POST /v1/media/:id/access` issues a 60-second grant for a participant. `POST /v1/media/:id/content` requires that grant and participant membership.
- `GET /v1/events` remains the reconnect cursor. Message events still carry only ids. Push notifications still carry kind and conversation id, not message text, phone numbers, or media bytes.

A specialist who is no longer `assigned_specialist_id` cannot list, read, upload, receive events, or download media for that care conversation, even if an old participant row remains. Assignment already removes other specialist participants.

## Storage

Additive migration `1737158400000_conversation_media.sql` adds media objects, private bytes, short-lived grants, message kind/position/idempotency, and receipts. Bytes stay in PostgreSQL as the private adapter. No external object store or malware scanner is configured, so quarantine here means the signature check rejected the bytes and they were not stored. `expireMedia` marks overdue pending uploads expired; it is safe to call repeatedly and is not yet scheduled in production. Production migration was not run.

Image limit is 1.5 MB and voice limit is 1 MB. Voice uploads must declare a duration from 1 ms through 5 minutes. Allowed signatures are JPEG, PNG, GIF, Ogg, and WAV.
