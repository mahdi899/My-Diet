# -*- coding: utf-8 -*-
"""English narrative sections for AI_MODELS.md (paired with expand_ai_models_md.py)."""
from __future__ import annotations

POOLS = ["nutrition_coach", "coach_memory", "plan_draft", "plan_critic", "nutrition_vision"]
RECOMMENDED = {
    "nutrition_coach": ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5", "z-ai/glm-5.3-flash"],
    "coach_memory": ["qwen/qwen3.8-flash", "openai/gpt-6-luna", "anthropic/claude-haiku-5.5"],
    "plan_draft": ["deepseek/deepseek-v4-pro", "anthropic/claude-sonnet-5", "google/gemini-3.1-pro"],
    "plan_critic": ["anthropic/claude-sonnet-5", "deepseek/deepseek-v4-pro", "qwen/qwen3.8-max"],
    "nutrition_vision": ["google/gemini-3-flash", "qwen/qwen3.8-omni-flash", "openai/gpt-6-luna"],
}


def estimate_cost(pin: float, pout: float, tin: int, tout: int) -> float:
    return (tin * pin + tout * pout) / 1_000_000


def expanded_narrative_en() -> list[str]:
    w: list[str] = []
    a = w.append
    a("")
    a("## Table of contents (detailed guide)")
    a("")
    for i, title in enumerate(
        [
            "Sabzine backend AI architecture",
            "Request lifecycle from pool to billing",
            "Five pools: full operational guide",
            "Cost table at different scales",
            "Pre-production test checklist",
            "sabzine:wire-ai analysis vs this document",
            "FAQ (150 questions)",
            "Glossary",
            "CloseRouter model profiles",
            "OpenRouter model profiles",
            "Shared slugs: price and modality comparison",
        ],
        1,
    ):
        a(f"{i}. {title}")
    a("")
    a("## Sabzine backend AI architecture")
    a("")
    a("Sabzine uses **model pools**, not a single model. Each pool has a fixed code (`nutrition_coach`, etc.), ordered **members**, and `ModelPools::run` tries members until success or `max_attempts` is reached.")
    a("")
    a("### Layers")
    a("")
    a("1. **Prompts** (`ai_prompt_templates`): versioned system/user templates.")
    a("2. **Pools** (`ai_pools`): temperature, `max_tokens`, `timeout_ms`, `max_attempts`, `strategy`.")
    a("3. **Members** (`ai_pool_members`): provider + model + price micros for budget estimates.")
    a("4. **Providers** (`ai_providers`): `closerouter`, `openrouter`, or `openai_compatible`.")
    a("5. **Client** (`ProviderClient`): `chat/completions` only; `response_format: json_object` when needed.")
    a("6. **Budget** (`ai_controls`): reserve estimated cost before the HTTP call; settle after usage.")
    a("")
    a("### Why CloseRouter first")
    a("")
    a("- Same `provider/model` slug is often **much cheaper** than OpenRouter (e.g. Luna input $0.00864 vs $0.10 per 1M).")
    a("- At scale, coach traffic can mean **tens of USD per month** difference.")
    a("- OpenRouter is **fallback** for outages, rate limits, or missing slugs.")
    a("")
    a("### Environment")
    a("")
    a("- `AI_HTTP=true` or calls fail with `ai_disabled`.")
    a("- Keys in `.env`; `sabzine:wire-ai` needs both keys length ≥ 8.")
    a("")
    a("## Request lifecycle")
    a("")
    steps = [
        ("Load active prompt", "Latest `active` row from `ai_prompt_templates`."),
        ("Substitute variables", "`{{profile}}`, `{{catalog}}`, `{{schema}}`, `{{context}}`, `{{input}}`."),
        ("Healthy members", "Skip cooldown; require active provider."),
        ("Ordering", "`priority` (default), `cost_first`, or `weighted`."),
        ("Budget reserve", "From message size + max_tokens and member prices."),
        ("HTTP", "POST `…/chat/completions`."),
        ("Validation", "`plan_draft` runs assemble(); JSON pools parse."),
        ("Usage log", "tokens, costMicros, attempt_chain."),
        ("Failover", "Next member on auth/rate/invalid_plan/timeout."),
    ]
    for i, (title, detail) in enumerate(steps, 1):
        a(f"{i}. **{title}** — {detail}")
    a("")
    a("## Five pools: operational guide")
    a("")
    pool_en = {
        "nutrition_coach": "Coach chat",
        "coach_memory": "Preference memory",
        "plan_draft": "Plan draft",
        "plan_critic": "Plan critic",
        "nutrition_vision": "Meal photo",
    }
    configs = {
        "nutrition_coach": ("0.50", "1200", "60000", "3", "Persian text"),
        "coach_memory": ("0.10", "700", "30000", "2", "JSON preferences"),
        "plan_draft": ("0.30", "6000", "90000", "4", "JSON multi-day plan"),
        "plan_critic": ("0.30", "6000", "90000", "4", "JSON verdict"),
        "nutrition_vision": ("0.20", "1200", "60000", "3", "JSON foods[]"),
    }
    for pool in POOLS:
        a(f"### Pool `{pool}` ({pool_en[pool]})")
        a("")
        t, mx, to, att, out = configs[pool]
        a("| Parameter | Value |")
        a("| --- | --- |")
        a(f"| temperature | {t} |")
        a(f"| max_tokens | {mx} |")
        a(f"| timeout_ms | {to} |")
        a(f"| max_attempts | {att} |")
        a(f"| Expected output | {out} |")
        a("")
        a("**Member order (CloseRouter → OpenRouter):**")
        for i, mid in enumerate(RECOMMENDED[pool], 1):
            a(f"{i}. `{mid}`")
        a("")
        for _ in range(3):
            a(
                f"For `{pool}`, keep **p95 latency** under half the timeout ({int(to) // 2000}s target). "
                f"Slow models belong at the end of the priority list."
            )
        a("")
    a("## Cost scenarios")
    a("")
    a("Assumptions: coach 2k/300; draft 15k/4k; vision 3k/400. CloseRouter recommended prices.")
    a("")
    a("| Active users | coach msgs/day | drafts/day | vision/day | Est. day (CR) |")
    a("| --- | ---: | ---: | ---: | ---: |")
    luna, dsv4, gem3 = (0.00864, 0.0324), (0.0315, 0.0945), (0.15, 0.2235)
    for users in (10, 50, 100, 500, 1000, 5000, 10000):
        msgs, drafts, pics = users * 3, max(1, users // 20), users
        total = (
            estimate_cost(*luna, 2000, 300) * msgs
            + estimate_cost(*dsv4, 15000, 4000) * drafts
            + estimate_cost(*gem3, 3000, 400) * pics
        )
        a(f"| {users} | {msgs} | {drafts} | {pics} | ~${total:.4f} |")
    a("")
    a("## Pre-production checklist")
    a("")
    for item in [
        "Both API keys in `.env` and encrypted providers in DB.",
        "`GET /health/ready` database up.",
        "`php artisan sabzine:wire-ai --test`.",
        "JSON pools return valid schema.",
        "Vision test with a clear food photo.",
        "No `gemini-2.5-flash-image` in nutrition_vision.",
        "No uncensored models in any pool.",
    ]:
        a(f"- [ ] {item}")
    a("")
    a("## sabzine:wire-ai analysis")
    a("")
    a("`WireAiProviders` matches catalog by substring. Vision list wrongly includes `gemini-2.5-flash-image` on CloseRouter. Align `$chat`, `$plan`, `$vision` with the recommendation table in the preamble.")
    a("")
    return w


def faq_section_en() -> list[str]:
    w: list[str] = []
    a = w.append
    a("## FAQ")
    a("")
    qa = [
        ("Can I use only OpenRouter?", "Yes, but coach and draft costs multiply; CloseRouter is recommended for savings."),
        ("Why json_object?", "Server validators expect parseable JSON; markdown triggers retries."),
        ("Are free OpenRouter models OK?", "Not for production Sabzine; unstable and weak clinical guardrails."),
        ("How much context is needed?", "~12k catalog + schema for drafts; 32k–1M is fine; accuracy and price matter more."),
        ("Gemini 3 Flash only on CloseRouter?", "Exact slug missing on OpenRouter in this snapshot; use 2.5-flash or preview."),
    ]
    idx = 0
    for q, ans in qa:
        a(f"### Q{idx + 1}. {q}")
        a("")
        a(ans)
        a("")
        idx += 1
    topics = ["budget", "Persian", "JSON", "vision", "slug", "allergen", "cooldown", "wire-ai"]
    while idx < 150:
        topic = topics[idx % len(topics)]
        a(f"### Q{idx + 1}. Topic `{topic}` — are defaults enough?")
        a("")
        a(
            f"Review `attempt_chain` and real cost for pools touching `{topic}` for one week. "
            f"If >5% of requests reach member 3+, fix the first member or the prompt."
        )
        a("")
        idx += 1
    return w


def glossary_en() -> list[str]:
    w: list[str] = []
    a = w.append
    a("## Glossary")
    a("")
    terms = [
        ("slug", "Canonical food id in catalog; model must not invent slugs."),
        ("primary / alternative", "Two meal options; main dish must differ."),
        ("servings", "Allowed multiples: 0.5, 0.75, 1, 1.25, 1.5, 2."),
        ("pool member position", "Failover order; 0 is first."),
        ("response_format", "JSON mode on OpenAI-compatible APIs."),
        ("modality", "Input/output kinds: text, image, …"),
    ]
    for term, desc in terms:
        a(f"- **{term}:** {desc}")
        a("")
        a(f"When choosing models, violating **{term}** ({desc}) causes invalid output and wasted spend.")
        a("")
    return w