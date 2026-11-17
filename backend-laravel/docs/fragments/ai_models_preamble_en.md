# CloseRouter and OpenRouter models for Sabzine

Catalog snapshot date: **17 November 2026**.

This document places two live catalogs side by side and explains which model IDs fit which Sabzine workload.

- [CloseRouter / Models](https://closerouter.dev/en/models): **156** models embedded in that page. Public `GET /v1/models` returns **401** without an API key.
- [OpenRouter models API](https://openrouter.ai/api/v1/models): **470** models (`total_count` in the response). The UI at [openrouter.ai/models](https://openrouter.ai/models) reflects the same list.

Prices are USD per **million tokens** unless another unit is stated. Text prices are shown as **input / output**. Both catalogs change; re-fetch from the APIs before locking a budget.

Sabzine already supports both gateways. `php artisan sabzine:wire-ai` wires **CloseRouter first** and **OpenRouter as fallback**. The client only calls `POST /v1/chat/completions` and sends `response_format: json_object` when the pool expects structured output.

## What Sabzine needs from a model

There are **five pools** in the database. All use strategy **`priority`**: earlier members run first; `max_attempts` caps how many are tried.

| Pool | Role | Temp | max out | Timeout | Attempts | Output |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `nutrition_coach` | Nutrition coach; Persian, 2–4 sentences; no medical diagnosis | 0.50 | 1,200 | 60s | 3 | text |
| `coach_memory` | Extract food preferences only from explicit user speech | 0.10 | 700 | 30s | 2 | JSON |
| `plan_draft` | Multi-day draft using **catalog slugs only** and allowed servings | 0.30 | 6,000 | 90s | 4 | JSON |
| `plan_critic` | Review allergens, energy, protein, practicality; short Persian summary | 0.30 | 6,000 | 90s | 4 | JSON |
| `nutrition_vision` | Food from photo; approximate kcal; no allergy claims from appearance | 0.20 | 1,200 | 60s | 3 | JSON |

After food selection, the catalog chunk is about **12k tokens** (~170 items). We budget one real draft at **15k input / 4k output** tokens and one coach message at **2k input / 300 output**.

A suitable model satisfies **all** of:

1. **Chat endpoint** — image/video generators do not answer Sabzine’s flows via `/chat/completions`.
2. **Vision** — for meal photos: **image in, text out**. Image output is useless for logging meals.
3. **JSON discipline** — for three JSON pools. OpenRouter lists `response_format` for **408 of 470** models. CloseRouter cards mostly list `tools`; validate JSON with a real pool test.
4. **Cost vs volume** — coach traffic is frequent → small/cheap models. Drafts are rare but a bad slug wastes the whole request → pay for accuracy there.

Do **not** put `uncensored` or `abliterated` models in any pool. System prompts forbid diagnosis and extreme diets; those model classes ignore instructions more easily.

## Recommended models per pool

Figures below match the **17 November 2026** snapshot. USD per million tokens.

| Pool | First choice | CloseRouter price | If weak | OpenRouter fallback |
| --- | --- | --- | --- | --- |
| `nutrition_coach` | `openai/gpt-6-luna` | 0.00864 / 0.0324 | `anthropic/claude-haiku-5.5` at 0.0359 / 0.179 | Same Luna at 0.10 / 0.50, then Haiku 5.5 at 0.10 / 0.50 |
| `coach_memory` | `qwen/qwen3.8-flash` | 0.0233 / 0.0684 | `openai/gpt-6-luna` | `anthropic/claude-haiku-5.5` at 0.10 / 0.50 |
| `plan_draft` | `deepseek/deepseek-v4-pro` | 0.0315 / 0.0945 | `anthropic/claude-sonnet-5` at 0.03 / 0.15 | `deepseek/deepseek-v4-pro` at 0.90 / 1.50 |
| `plan_critic` | `anthropic/claude-sonnet-5` | 0.03 / 0.15 | `deepseek/deepseek-v4-pro` | Same DeepSeek — not OpenRouter Sonnet 5 |
| `nutrition_vision` | `google/gemini-3-flash` | 0.15 / 0.2235 | `qwen/qwen3.8-omni-flash` at 0.0403 / 0.126 | `google/gemini-2.5-flash` at 0.30 / 2.50 |

### Coach chat

`openai/gpt-6-luna` on CloseRouter fits this pool: image + text in, text out, **786k** context, **128k** max output, and the **lowest input price** among chat models in that catalog. One coach message ≈ **$0.000027**. **1,000 messages/day ≈ $0.027**.

If Persian tone or medical boundaries slip (refer to a specialist, don’t invent facts), second member: **`anthropic/claude-haiku-5.5`**. Same message ≈ **$0.00013** — still negligible; Claude tends to follow system rules better. Haiku is multimodal on both gateways, but the coach pool does not send images today.

`z-ai/glm-5.3-flash` at **0.0169 / 0.0169** is cheap and multimodal — OK for experiments, not default for plans or vision; medical guardrails are weaker than Claude/Gemini.

### Memory pool

Small output, temperature **0.10**. Extract preferences only from explicit statements; otherwise return an empty array. **`qwen/qwen3.8-flash`** on CloseRouter is text-only, tool-capable, **1M** context, strong at structured extraction. Luna is the cheap fallback on the same gateway.

Timeout **30s**, cap **700** tokens. Models with **default-on reasoning** can burn the cap on hidden thinking. Sabzine does not yet send a disable-reasoning flag. On OpenRouter, **`qwen/qwen3.8-flash`** and **`openai/gpt-6-luna`** default reasoning on — use **`anthropic/claude-haiku-5.5`** as OpenRouter memory fallback (optional reasoning).

### Plan draft and critic

Accuracy beats cheapest tokens. Model must write **catalog slugs only**, distinct primary/alternative, servings from **{0.5, 0.75, 1, 1.25, 1.5, 2}**. Server validation rejects bad JSON; the pool tries the next member, but **`max_attempts` is 4** — put a reliable model in the first four slots.

**`deepseek/deepseek-v4-pro`** on CloseRouter: text, **1M** context, **65k** max out, **0.0315 / 0.0945**. One draft (15k/4k) ≈ **$0.00085**.

**`anthropic/claude-sonnet-5`** on CloseRouter: **0.03 / 0.15**, **324k** context — enough for the ~12k catalog. Strong at strict JSON/slug rules. Same draft ≈ **$0.00105**. Best **critic** pick (allergen/energy judgment, no images). On CloseRouter this Sonnet is **text-only**.

If both fail validation, **`google/gemini-3.1-pro`** on CloseRouter (**0.216 / 1.26**, image+text, **1M** context) — draft ≈ **$0.0083**, still below Fable/Opus 5.5. No `google/gemini-3.1-pro` slug on OpenRouter; **`google/gemini-3.1-pro-preview`** ≈ **2 / 12** — do not use as default fallback.

**`qwen/qwen3.8-max`** (**0.027 / 0.081**, image+text) is a strong alternate if DeepSeek is down.

### Meal photo (vision)

Output must be JSON text: food name, amount, approximate kcal, confidence. **`google/gemini-3-flash`** on CloseRouter: image+text → text, chat endpoint, **1M** context, **0.15 / 0.2235**. Gemini/Qwen usually describe Iranian plates better than tiny models.

Cheaper alternate: **`qwen/qwen3.8-omni-flash`** (**0.0403 / 0.126**). Then **`openai/gpt-6-luna`**, then **`anthropic/claude-haiku-5.5`**.

Do **not** use **`google/gemini-2.5-flash-image`**. On CloseRouter it **outputs images**, charges **$0.045/image**, endpoints `images_*`. `sabzine:wire-ai` still prefers it in the vision list — wrong for plate recognition. On OpenRouter it can emit text but also costly image output tokens.

**`deepseek/deepseek-v4-flash-vision-exp`** on CloseRouter is **text-only** despite the name; hourly pricing swings.

**`qwen/qwen3.8-flash`** is text-only on CloseRouter but image+text+video on OpenRouter — **do not assume identical behavior** for shared slugs.

### Do not overspend on OpenRouter

Same slug is often **multiples** more expensive; input modalities may differ.

| Slug | CloseRouter | OpenRouter | Note |
| --- | --- | --- | --- |
| `openai/gpt-6-luna` | 0.00864 / 0.0324 | 0.10 / 0.50 | Both see images. OpenRouter ~12–15× input. |
| `anthropic/claude-haiku-5.5` | 0.0359 / 0.179 | 0.10 / 0.50 | Both multimodal. |
| `anthropic/claude-sonnet-5` | 0.03 / 0.15 text-only | 2 / 10 text+image+file | If CloseRouter is down, use DeepSeek here — not this Sonnet. |
| `deepseek/deepseek-v4-pro` | 0.0315 / 0.0945 text | 0.90 / 1.50 text | Still the sensible OpenRouter draft fallback. |
| `google/gemini-3-flash` | 0.15 / 0.2235 | slug missing | Use `google/gemini-2.5-flash` (0.30 / 2.50) or expensive `google/gemini-3-flash-preview` (0.50 / 3). |
| `google/gemini-3.1-pro` | 0.216 / 1.26 | slug missing | `google/gemini-3.1-pro-preview` ~2 / 12 — not default fallback. |
| `google/gemini-2.5-pro` | 0.3645 / 0.861 | 1.25 / 10 | Current wire-ai may pick this before DeepSeek — expensive on OpenRouter. |

One draft on OpenRouter: Luna ≈ **$0.0035**, Sonnet 5 ≈ **$0.07**, Gemini 2.5 Pro ≈ **$0.059**. Keep CloseRouter first in the queue.

### Not suitable for the five pools

- Image/video generation: Flux, Ideogram, Imagen, Seedream, Seedance, Kling, Hailuo, Veo, Wan, Runway, HappyHorse, PixVerse, Grok Imagine, Qwen Image, Recraft, Topaz. Sabzine **reads** photos; it does not generate media.
- Non-chat models including **`google/gemini-2.5-flash-image`** and **`typesafe/jev-1.14.0`** (Jev has $0 output pricing and is not built for coach/plan).
- Disproportionately expensive tiers: `anthropic/claude-fable-5`, `anthropic/claude-fable-5.2`, `moonshotai/kimi-k2.6`, `z-ai/glm-5.3-uncensored`.
- Any slug containing **`uncensored`** or **`abliterated`**.

**75** slugs appear in both catalogs; **81** only on CloseRouter (mostly image/video plus `google/gemini-3-flash` and `google/gemini-3.1-pro`).