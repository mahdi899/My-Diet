# Coach API contract

Nutrition coach for «رژیم من». All routes are under `/v1`, require `Authorization: Bearer <access token>`, and require role `user`. One thread per user is created on first use.

JSON errors (every route except an SSE stream that has already started) use the shared envelope:

```json
{ "status": 400, "code": "validation", "messageFa": "…", "retryable": false }
```

`POST /v1/me/coach/messages` is always `text/event-stream`. It does not switch to JSON based on `Accept`.

Dates are Tehran civil dates (`YYYY-MM-DD`). Times on plan meals are `HH:MM`.

## Endpoints

| Method | Path | Body / query | Success |
| --- | --- | --- | --- |
| GET | `/v1/me/coach/thread` | `before` (seq cursor), `limit` (1–50, default 30) | Thread page, oldest-to-newest inside the page |
| POST | `/v1/me/coach/messages` | Incoming message | SSE |
| POST | `/v1/me/coach/food-photos` | Base64 image | JSON transcript of that turn |
| PATCH | `/v1/me/coach/meals/:id` | Edited items | Logged entry + today |
| GET | `/v1/me/coach/today` | — | Today summary (same numbers as `calorie_ring`) |
| POST | `/v1/me/coach/day-brief` | `{}` | Today's brief, created once |
| POST | `/v1/me/coach/actions` | Action, no model | JSON messages |
| GET | `/v1/me/coach/media/:id` | — | Image bytes, `Content-Type` from the file |

### GET thread

```json
{
  "thread": { "id": "uuid", "dayBriefDate": "2026-06-01" },
  "messages": [ { "id": "uuid", "seq": 1, "role": "user", "type": "text", "payload": {}, "fallbackText": "", "clientMessageId": "uuid", "replyTo": null, "createdAt": "2026-06-01T08:00:00.000Z" } ],
  "nextCursor": "12"
}
```

`nextCursor` is the `seq` of the oldest message in this page. Pass it as `before` to load older messages. `null` means the beginning of the thread. `seq` is increasing; render `messages` in array order.

### POST messages

```json
{
  "clientMessageId": "uuid",
  "kind": "text",
  "text": "ناهار قیمه خوردم"
}
```

| kind | Required | Meaning |
| --- | --- | --- |
| `text` | `text` | Sent to the coach after the safety check |
| `quick_reply` | `label` or `value` or `text` | If `action` is set, handled with no model (same as `/actions`). Otherwise the label is sent as the user's text |
| `card_action` | `action` | No model. `args` is the card payload the button carried |
| `photo` | `mediaId` | Vision analysis of a photo already stored by `/food-photos` or a previous turn. `caption` / `text` optional. `mealType` optional |

`sourceMessageId` is optional on replies. Unknown JSON fields are rejected (`validation`).

The same `clientMessageId` on the same thread returns the stored reply and does not call the model again (`done.replayed: true`). A turn that died before any assistant message is continued.

### POST food-photos

```json
{
  "clientMessageId": "uuid",
  "image": "data:image/jpeg;base64,…",
  "mime": "image/jpeg",
  "caption": "",
  "mealType": "lunch"
}
```

`image` is a data URL or raw base64. The bytes must be JPEG, PNG, WebP, or GIF and at most 1.5MB decoded. The declared MIME must match the file signature.

```json
{
  "userMessage": { "type": "user_photo", "payload": { "mediaId": "uuid", "url": "/v1/me/coach/media/uuid", "mime": "image/jpeg", "caption": "" } },
  "messages": [ { "type": "meal_card", "payload": { "status": "suggested" } } ]
}
```

The image is not sent to a model unless `nutrition_profiles.consented_at` is set. Without consent the reply is a `system_note` with `code: "no_consent"`.

### PATCH meals/:id

Confirms the food entry (`status` becomes `logged`). Catalogue rows are recomputed on the server from `slug` + `servings`; a client-supplied `kcal` is kept only when the food is not in the catalogue (line total, not per serving). When the entry is for today and an unrecorded plan meal of that type exists, the plan log is written as `different` so the plan screen and the ring count it once.

```json
{
  "title": "خورش قیمه",
  "mealType": "lunch",
  "items": [{ "name": "خورش قیمه", "slug": "gheymeh", "servings": 1, "kcal": 420, "proteinG": 20, "carbsG": 40, "fatG": 12 }],
  "planMealUid": null
}
```

All fields are optional. Omitting `items` keeps the stored items.

```json
{ "entry": { "id": "uuid", "status": "logged", "items": [], "totals": { "kcal": 0, "proteinG": 0, "carbsG": 0, "fatG": 0 } }, "message": null, "today": {} }
```

`message` is the original thread card when one existed; its payload is updated in place. Confirming again is a no-op.

### POST actions

No model. `clientMessageId` makes it idempotent, same as messages.

```json
{ "clientMessageId": "uuid", "action": "log_water", "args": { "ml": 250 }, "label": "یک لیوان" }
```

| action | args |
| --- | --- |
| `confirm_meal` | `{ "entryId", "title?", "mealType?", "items?", "planMealUid?" }` |
| `dismiss` | `{}` |
| `confirm_swap` | The `proposal` object from a `plan_meal` card, or the same fields flat: `date`, `versionId`, `mealUid`, `toOptionId` (or `optionId`), `expectedRevision`, `commandId?`, `reasonId?` |
| `log_as_planned` | `{ "date", "versionId", "mealUid", "optionId", "expectedRevision", "commandId?" }` |
| `log_water` | `{ "ml": 250 }` (50–1500) |
| `log_weight` | `{ "kilograms": 76.4, "confirm?": true }` |
| `show_ring` | `{}` |

Response: `{ "userMessage", "messages" }`. `confirm_meal` also returns a fresh `calorie_ring`.

### POST day-brief

No model. Returns `{ "message", "created" }`. The second call on the same Tehran date returns the stored brief with `created: false`. A `quick_replies` message is appended only the first time.

### GET today

```json
{
  "date": "2026-06-01",
  "hasProfile": true,
  "calories": { "target": 1600, "consumed": 420, "remaining": 1180, "percent": 26, "partial": false },
  "macros": {
    "proteinG": { "consumed": 20, "target": 90 },
    "carbsG": { "consumed": 40, "target": 160 },
    "fatG": { "consumed": 12, "target": 50 },
    "partial": false
  },
  "water": { "ml": 250, "targetMl": 2000 },
  "weight": { "latestKg": 76.4, "latestDate": "2026-06-01", "deltaKg7d": -0.4, "targetKg": 68, "series": [{ "date": "2026-06-01", "kilograms": 76.4 }] },
  "streakDays": 3,
  "nextMeal": { "mealUid": "uuid", "mealType": "lunch", "title": "قیمه", "suggestedTime": "13:00", "plannedKcal": 550 },
  "planMeals": []
}
```

`calories.partial` is true when a logged plan meal has no known calories. Macro totals only include foods logged through the coach. `hasProfile: false` when onboarding is unfinished; numbers are then zero and no model calls are possible (`no_profile`).

## SSE

Response headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.

Frames are `event: <name>\ndata: <json>\n\n`. A comment line `: ping` is written every 15 seconds so proxies do not close a quiet tool call. Ignore lines that start with `:`.

The model stream is sanitized before any `delta` is written. `message` is the stored card and wins over the deltas of that segment.

| event | data |
| --- | --- |
| `user_message` | `{ "message": Message }` |
| `delta` | `{ "segment": 1, "text": "…" }` — provisional text of one assistant bubble. A new segment starts after tools |
| `tool` | `{ "name": "search_food", "status": "running" \| "done" \| "failed" }` |
| `message` | `{ "message": Message }` |
| `done` | `{ "replayed": false, "userMessageId": "uuid", "messageIds": ["uuid"] }` |
| `error` | `{ "code": "ai_unavailable", "messageFa": "…", "retryable": true }` |

`error` ends the turn. There is no `done` after `error`. Retry the same `clientMessageId` when `retryable` is true and no assistant message was stored.

## Message types

Every stored message has `role` `user` | `assistant` | `system`, `type`, `payload`, and `fallbackText` (plain Persian for notifications and for the model history).

### text

```json
{ "text": "ثبت شد." }
```

A user quick reply also sets `"quickReply": true`. A user card action also sets `"action"` and `"args"`.

### quick_replies

At most 4. An entry with `action` must be posted to `/actions` (or sent as `kind: "quick_reply"` with that `action`). An entry without `action` is sent back as text.

```json
{ "replies": [ { "id": "ring", "label": "حلقهٔ امروز", "action": "show_ring", "args": {} }, { "id": "idea", "label": "یه غذا پیشنهاد بده" } ] }
```

### meal_card

```json
{
  "entryId": "uuid",
  "title": "کباب کوبیده",
  "mealType": "lunch",
  "source": "photo",
  "status": "suggested",
  "items": [{
    "name": "کباب کوبیده", "slug": "kobideh", "servings": 1, "servingLabel": "یک پرس",
    "kcal": 500, "proteinG": 35, "carbsG": 10, "fatG": 28, "estimated": false
  }],
  "totals": { "kcal": 500, "proteinG": 35, "carbsG": 10, "fatG": 28 },
  "confidence": 0.82,
  "photoUrl": "/v1/me/coach/media/uuid",
  "mediaId": "uuid",
  "photoHint": ["کباب کوبیده"],
  "note": "",
  "planMealUid": null,
  "remainingKcal": 1100,
  "actions": ["confirm", "edit"]
}
```

`source` is `photo` | `suggestion` | `manual`. `status` `logged` has `"actions": []`. `estimated: true` means the food was not in `food_catalog` and the energy is the model's or the user's figure. `photoHint` is for the app's local photo manifest, not a URL. `confidence` is `null` when the card did not come from a photo.

Confirm with `action: "confirm_meal"` and `args.entryId`, or `PATCH /meals/:id`. Edit by sending replacement `items` on either call.

### plan_meal

```json
{
  "date": "2026-06-01",
  "versionId": "uuid",
  "mealUid": "uuid",
  "mealType": "lunch",
  "title": "خورش قیمه",
  "suggestedTime": "13:00",
  "plannedKcal": 550,
  "state": "unrecorded",
  "consumedKcal": null,
  "selectedOption": { "optionId": "uuid", "kind": "primary", "title": "خورش قیمه", "kcal": 550, "portion": {} },
  "options": [],
  "proposal": null,
  "actions": ["log_as_planned", "swap"]
}
```

When a swap is proposed, `proposal` is set and `actions` is `["confirm_swap", "dismiss"]`:

```json
{
  "status": "pending",
  "commandId": "uuid",
  "date": "2026-06-01",
  "versionId": "uuid",
  "mealUid": "uuid",
  "expectedRevision": 0,
  "reasonId": "preference",
  "fromOptionId": "uuid",
  "fromTitle": "خورش قیمه",
  "fromKcal": 550,
  "toOptionId": "uuid",
  "toTitle": "زرشک پلو",
  "toKcal": 540,
  "deltaKcal": -10
}
```

Nothing in `plan_meal_options` changes until `confirm_swap`. The alternative is an already-approved option within 15% or 40 kcal.

### calorie_ring

```json
{
  "date": "2026-06-01",
  "targetKcal": 1600,
  "consumedKcal": 420,
  "remainingKcal": 1180,
  "percent": 26,
  "partial": false,
  "macros": { "proteinG": { "consumed": 20, "target": 90 }, "carbsG": { "consumed": 40, "target": 160 }, "fatG": { "consumed": 12, "target": 50 }, "partial": false },
  "water": { "ml": 250, "targetMl": 2000 },
  "nextMeal": null
}
```

### weigh_in

```json
{
  "date": "2026-06-01",
  "kilograms": 76.4,
  "previousKg": 77,
  "deltaKg": -0.6,
  "trend": "down",
  "targetWeightKg": 68,
  "remainingToTargetKg": 8.4,
  "series": [{ "date": "2026-06-01", "kilograms": 76.4 }]
}
```

`trend` is `down` | `up` | `flat` | `null`. A change of more than 5 kg versus a weigh-in from the last 3 days is rejected until `confirm: true`.

### water

```json
{ "date": "2026-06-01", "ml": 500, "addedMl": 250, "targetMl": 2000, "percent": 25 }
```

The day is capped at 10000 ml.

### day_brief

```json
{
  "date": "2026-06-01",
  "greeting": "صبح بخیر نگار",
  "targetKcal": 1600,
  "meals": [{ "mealUid": "uuid", "mealType": "breakfast", "title": "نان و پنیر", "suggestedTime": "08:00", "plannedKcal": 400 }],
  "tip": "وعدهٔ بعدی: نان و پنیر ساعت 08:00.",
  "waterTargetMl": 2000,
  "weighInSuggested": true,
  "streakDays": 3
}
```

### weekly_review

```json
{
  "weekStart": "2026-05-30",
  "weekEnd": "2026-06-05",
  "daysLogged": 5,
  "avgKcal": 1550,
  "targetKcal": 1600,
  "adherencePercent": 80,
  "weightChangeKg": -0.4,
  "waterAvgMl": 1800,
  "wins": ["۵ روز ثبت غذا"],
  "focus": "یک وعدهٔ پروتئینی را در ناهار ثابت نگه دار."
}
```

Weeks start on Saturday. Nullable numbers are `null` when that week has no data.

### milestone

```json
{ "kind": "streak", "title": "۷ روز پیوستگی", "body": "…", "value": 7 }
```

`kind` is `streak` or `loss`.

### user_photo

```json
{ "mediaId": "uuid", "url": "/v1/me/coach/media/uuid", "mime": "image/jpeg", "caption": "" }
```

Fetch the bytes with the same bearer token. The response is private and not a public URL.

### system_note

```json
{ "code": "no_consent", "text": "…", "oldKcal": 1600, "newKcal": 1400 }
```

Known codes: `no_consent`, `not_food`, `target_adjusted`, `escalated`, `no_specialist`, plus the vision failure codes `media_not_found`, `ai_unavailable`, `vision_invalid`, `vision_empty`. Extra fields depend on the code. `target_adjusted` includes `oldKcal`, `newKcal`, `clamped`, `reason`, `macros`. `escalated` includes `conversationId` (open that care thread) and `urgent`.

## Tool → card

The model never invents calories. Catalogue math runs in the tool.

| Tool | Card |
| --- | --- |
| `search_food` | none (numbers only, returned to the model) |
| `suggest_meal` | `meal_card` (`suggested`) + `photoHint` |
| `show_plan_meal` | `plan_meal` |
| `swap_plan_meal` | `plan_meal` with `proposal` |
| `log_meal` | `meal_card` (`logged`) |
| `analyze_food_photo` | `meal_card` (`suggested`) or `system_note` |
| `show_calorie_ring` | `calorie_ring` |
| `log_weight` | `weigh_in` |
| `log_water` | `water` |
| `adjust_nutrition_target` | `system_note` `target_adjusted` |
| `save_memory` | none |
| `show_quick_replies` | `quick_replies` |
| `plan_next_step` | none (a later proactive text) |
| `escalate_to_specialist` | `system_note` `escalated` or `no_specialist` |

`adjust_nutrition_target` refuses minors, pregnancy, and `doctor_only` profiles, refuses a drop below a safe floor (1200 kcal women, 1500 men, 1800 pregnancy), moves at most 200 kcal, and waits 7 days between changes. The floor is also applied by the output sanitizer.

## Errors

| code | HTTP or SSE | retryable | When |
| --- | --- | --- | --- |
| `validation` | 400 | false | Bad JSON, empty text, bad cursor |
| `unauthorized` | 401 | false | Missing or ended session |
| `forbidden` | 403 | false | Wrong role |
| `no_profile` | 409 | false | Onboarding not submitted |
| `no_consent` | 403 on a tool; otherwise a `system_note` | false | Health data would be sent to a model |
| `not_found` | 404 | false | Unknown photo or meal |
| `turn_busy` | 409 | true | This user already has a model turn in flight (lock expires after 90s) |
| `rate_limited` | 429 | true | More than `COACH_RATE_PER_MINUTE` user messages in a minute (default 12) |
| `coach_daily_limit` | SSE | true | More than `COACH_DAILY_TURNS` model turns today (default 60) |
| `photo_limit` | 429 | true | More than `COACH_DAILY_PHOTOS` vision calls today (default 10) |
| `image_too_large` | 413 | false | Over 1.5MB |
| `invalid_image` | 400 | false | Not a real JPEG/PNG/WebP/GIF |
| `ai_budget_exceeded` | SSE | false | AI kill switch or spend cap |
| `ai_unavailable` | SSE | true | Pool missing, empty, or the provider failed |
| `internal` | 500 / SSE | true | Unexpected failure |

## Privacy and the model

Profile, plan, logs, memory, and photos are sent to a model only when `consented_at` is set. OpenRouter calls set `provider.data_collection` to `deny`. Local actions (confirm, dismiss, water, weight, plan swap, day brief, proactive cards) do not call a model.

Proactive messages (morning brief, meal reminder about 25 minutes ahead, missed meal 90–180 minutes later, Friday-evening weekly review, streak and weight milestones, a follow-up the coach scheduled) are written by the worker every 15 minutes. Quiet hours are 22:00–07:00 Asia/Tehran. At most `COACH_PROACTIVE_DAILY_MAX` budgeted messages per day (default 3). A promised follow-up does not use that budget. The weekly review is not dropped to make room for a reminder. Push kind is `coach` with `{ "type", "messageId", "title", "body" }` and no health measurements in the push body; the card itself is only in the thread.

## Running it

`AI_PROVIDER=fake` (the development default) uses a deterministic coach: Persian keyword routing, tool calls, and chunked text. No API key and no network. Production rejects `AI_PROVIDER=fake`.

A real model uses the existing pool, not a separate relay process. Set `AI_PROVIDER` to `pool` (or `openai` / `configured`, which also go through the pool). In the admin AI center, add an OpenAI-compatible provider whose base URL is OpenRouter or any relay that speaks `/chat/completions`, then add members to the pools inserted by migration `1738876800000_coach.sql`:

| Pool code | Use |
| --- | --- |
| `nutrition_coach` | Chat with tools. The model must support tool calls |
| `nutrition_vision` | One image in, one JSON object out |
| `coach_memory` | Summary and memory extraction |

Prompts `coach_system`, `coach_vision`, and `coach_memory` are editable in the same AI center. The safety section is appended in code and is not stored in the prompt row.
