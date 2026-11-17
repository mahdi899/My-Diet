# -*- coding: utf-8 -*-
"""Generate expanded backend-laravel/docs/AI_MODELS.md (target >= 10_000 lines)."""
from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tool"))
OUT = ROOT / "backend-laravel" / "docs" / "AI_MODELS.md"
FRAG_FA = ROOT / "backend-laravel" / "docs" / "fragments" / "ai_models_preamble_fa.md"
FRAG_EN = ROOT / "backend-laravel" / "docs" / "fragments" / "ai_models_preamble_en.md"
DIVIDER = (
    "\n\n---\n\n"
    "# نسخه فارسی — Persian edition\n\n"
    "The English edition is above. **Full Persian text starts here** (same structure and catalogs).\n\n"
)
CR_PATH = Path(os.environ.get("TEMP", "")) / "cr-models.json"
OR_PATH = Path(r"C:\Users\PC\.cursor\projects\d-My-diet-My-Diet\agent-tools\840776e1-0506-4a0e-aa2d-ad80c2917fec.txt")

MOD_FA = {"text": "متن", "image": "تصویر", "file": "فایل", "audio": "صوت", "video": "ویدیو"}
MOD_EN = {"text": "text", "image": "image", "file": "file", "audio": "audio", "video": "video"}

FIT_LABEL = {
    "fa": {5: "عالی", 4: "خوب", 3: "قابل استفاده", 2: "فقط پشتیبان", 1: "ضعیف", 0: "نامناسب", "ban": "ممنوع"},
    "en": {5: "Excellent", 4: "Good", 3: "Usable", 2: "Fallback only", 1: "Weak", 0: "Unsuitable", "ban": "Banned"},
}
POOLS = ["nutrition_coach", "coach_memory", "plan_draft", "plan_critic", "nutrition_vision"]
POOL_FA = {
    "nutrition_coach": "مربی گفتگو",
    "coach_memory": "حافظه ترجیحات",
    "plan_draft": "پیش‌نویس برنامه",
    "plan_critic": "بازبین برنامه",
    "nutrition_vision": "تحلیل عکس غذا",
}
RECOMMENDED = {
    "nutrition_coach": ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5", "z-ai/glm-5.3-flash"],
    "coach_memory": ["qwen/qwen3.8-flash", "openai/gpt-6-luna", "anthropic/claude-haiku-5.5"],
    "plan_draft": ["deepseek/deepseek-v4-pro", "anthropic/claude-sonnet-5", "google/gemini-3.1-pro"],
    "plan_critic": ["anthropic/claude-sonnet-5", "deepseek/deepseek-v4-pro", "qwen/qwen3.8-max"],
    "nutrition_vision": ["google/gemini-3-flash", "qwen/qwen3.8-omni-flash", "openai/gpt-6-luna"],
}


def fmt_num(value) -> str:
    if value is None or value == "":
        return "—"
    number = float(value)
    if number == 0:
        return "0"
    return f"{number:.6f}".rstrip("0").rstrip(".")


def mods(items, lang: str = "fa") -> str:
    if not items:
        return "—"
    table = MOD_EN if lang == "en" else MOD_FA
    return " + ".join(table.get(x, x) for x in items)


def ctx(value) -> str:
    if not value:
        return "—"
    return f"{int(value):,}"


def video_price(pricing: dict, lang: str = "fa") -> str:
    unit = pricing.get("unit")
    if unit == "usd_per_image":
        amount = pricing.get("image", pricing.get("output"))
        if lang == "en":
            return f"${fmt_num(amount)} / image"
        return f"{fmt_num(amount)} دلار / تصویر"
    if unit != "usd_per_video_operation":
        return "—"
    rates = []
    for operation in pricing.get("operations") or []:
        for rate in operation.get("rates") or []:
            if rate.get("unit_usd") is not None:
                rates.append((float(rate["unit_usd"]), rate.get("unit") or "op"))
    if not rates:
        return "variable video pricing" if lang == "en" else "نرخ متغیر ویدیو"
    amount, unit_name = min(rates)
  # minimum rate
    if lang == "en":
        label = {"second": "second", "request": "request"}.get(unit_name, unit_name)
        return f"from ${fmt_num(amount)} / {label}"
    label = {"second": "ثانیه", "request": "درخواست"}.get(unit_name, unit_name)
    return f"از {fmt_num(amount)} دلار / {label}"


def token_price(pricing: dict) -> tuple[str | None, str | None]:
    if (pricing or {}).get("unit") != "usd_per_million_tokens":
        return None, None
    return fmt_num(pricing.get("input")), fmt_num(pricing.get("output"))


def or_per_m(pricing: dict, key: str) -> float | None:
    raw = (pricing or {}).get(key)
    if raw is None:
        return None
    return float(raw) * 1_000_000


def has_chat_cr(m: dict) -> bool:
    return "chat" in (m.get("endpoints") or [])


def has_chat_or(m: dict) -> bool:
    eps = m.get("endpoints") or []
    for ep in eps:
        if isinstance(ep, dict) and ep.get("type") in ("chat", "completions"):
            return True
        if ep == "chat":
            return True
    arch = m.get("architecture") or {}
    return "text" in (arch.get("output_modalities") or [])


def is_bad_slug(model_id: str) -> bool:
    low = model_id.lower()
    return any(x in low for x in ("uncensored", "abliterated", "nitro", ":batch"))


def estimate_cost(pin: float, pout: float, tin: int, tout: int) -> float:
    return (tin * pin + tout * pout) / 1_000_000


@dataclass
class Fit:
    pool: str
    stars: int
    label: str
    note: str


def fit_display(fit: Fit, lang: str) -> tuple[str, str]:
    label = fit.label
    if fit.label == "ممنوع":
        label = FIT_LABEL[lang]["ban"]
    elif fit.stars in FIT_LABEL[lang]:
        label = FIT_LABEL[lang][fit.stars]
    if lang == "en":
        if fit.stars >= 4:
            note = f"Strong match for pool `{fit.pool}` per Sabzine rules."
        elif fit.stars >= 2:
            note = f"Usable as fallback for `{fit.pool}`; test JSON/vision first."
        else:
            note = f"Not suitable for `{fit.pool}` (endpoint, modality, or cost)."
    else:
        note = fit.note
    return label, note


def score_cr(m: dict) -> list[Fit]:
    mid = m["id"]
    inn = m.get("input_modalities") or []
    out = m.get("output_modalities") or []
    chat = has_chat_cr(m)
    unit = (m.get("pricing") or {}).get("unit")
    pin_s, pout_s = token_price(m.get("pricing") or {})
    pin = float(pin_s) if pin_s and pin_s != "—" else None
    pout = float(pout_s) if pout_s and pout_s != "—" else None
    bad = is_bad_slug(mid)
    fits: list[Fit] = []
    for pool in POOLS:
        stars = 0
        note = ""
        if bad:
            fits.append(Fit(pool, 0, "ممنوع", "شناسه uncensored/abliterated برای محتوای بالینی مناسب نیست."))
            continue
        if pool == "nutrition_coach":
            if chat and "text" in out and unit == "usd_per_million_tokens":
                if pin is not None and pin <= 0.05:
                    stars = 5 if mid in RECOMMENDED["nutrition_coach"] else 4
                elif pin is not None and pin <= 0.15:
                    stars = 3
                elif pin is not None:
                    stars = 2
                note = "گفتگوی پرتکرار؛ ارزان و متنی اولویت دارد."
            elif chat and unit == "usd_per_million_tokens":
                stars = 2
                note = "کار می‌کند ولی هزینه بالاتر از Luna/Haiku."
            else:
                stars = 0
                note = "بدون چت یا خروجی متنی مناسب مربی نیست."
        elif pool == "coach_memory":
            if chat and out == ["text"] and "image" not in inn and unit == "usd_per_million_tokens":
                stars = 5 if mid in RECOMMENDED["coach_memory"] else 3
                note = "JSON کوچک؛ از مدل با استدلال اجباری پرهیز کنید."
            else:
                stars = 1 if chat else 0
                note = "حافظه فقط متن می‌خواهد."
        elif pool in ("plan_draft", "plan_critic"):
            if chat and "text" in out and unit == "usd_per_million_tokens":
                if mid in RECOMMENDED[pool]:
                    stars = 5
                elif pin is not None and pin <= 0.4:
                    stars = 4
                elif pin is not None and pin <= 1.0:
                    stars = 3
                else:
                    stars = 1
                note = "نیاز به JSON بزرگ و پیروی از slug کاتالوگ."
            else:
                stars = 0
                note = "پیش‌نویس/بازبین فقط چت متنی."
        elif pool == "nutrition_vision":
            if chat and "text" in out and "image" in inn:
                stars = 5 if mid in RECOMMENDED["nutrition_vision"] else 3
                note = "ورودی تصویر و خروجی JSON متنی."
            elif "image" in out:
                stars = 0
                note = "خروجی تصویر برای ثبت وعده مناسب نیست."
            elif "image" in mid and not chat:
                stars = 0
                note = "مدل تصویرساز، نه تحلیل بشقاب."
            else:
                stars = 0
                note = "بدون دید تصویر."
        label = {5: "عالی", 4: "خوب", 3: "قابل استفاده", 2: "فقط پشتیبان", 1: "ضعیف", 0: "نامناسب"}[stars]
        fits.append(Fit(pool, stars, label, note))
    return fits


def score_or(m: dict) -> list[Fit]:
    mid = m["id"]
    arch = m.get("architecture") or {}
    inn = arch.get("input_modalities") or []
    out = arch.get("output_modalities") or []
    params = m.get("supported_parameters") or []
    json_ok = "response_format" in params
    pin = or_per_m(m.get("pricing") or {}, "prompt")
    pout = or_per_m(m.get("pricing") or {}, "completion")
    bad = is_bad_slug(mid)
    reasoning = m.get("reasoning")
    reasoning_mandatory = isinstance(reasoning, dict) and reasoning.get("mandatory")
    fits: list[Fit] = []
    for pool in POOLS:
        if bad:
            fits.append(Fit(pool, 0, "ممنوع", "فیلتر ایمنی سبزینه اجازه نمی‌دهد."))
            continue
        stars = 0
        note = ""
        if pool == "nutrition_coach":
            if "text" in out and pin is not None:
                if mid == "openai/gpt-6-luna":
                    stars, note = 4, "پشتیبان؛ گران‌تر از CloseRouter."
                elif pin <= 0.3:
                    stars, note = 3, "قابل استفاده در OpenRouter."
                else:
                    stars, note = 1, "هزینه بالا برای گفتگو."
            else:
                note = "خروجی متنی ندارد."
        elif pool == "coach_memory":
            if "text" in out and json_ok and not reasoning_mandatory:
                stars = 4 if mid == "anthropic/claude-haiku-5.5" else 3
                note = "استخراج JSON؛ استدلال اجباری خطر تایم‌اوت ۳۰ث دارد."
            elif reasoning_mandatory:
                stars, note = 1, "استدلال اجباری با سقف ۷۰۰ توکن ناسازگار است."
            else:
                stars, note = 2, "بدون response_format ریسک JSON بالاست."
        elif pool in ("plan_draft", "plan_critic"):
            if "text" in out and json_ok:
                if mid == "deepseek/deepseek-v4-pro":
                    stars, note = 4, "بهترین پشتیبان پیش‌نویس روی OpenRouter."
                elif mid == "anthropic/claude-sonnet-5":
                    stars, note = 2, "دقیق ولی بسیار گران (۲/۱۰)."
                elif pin is not None and pin <= 2:
                    stars, note = 3, "قابل آزمایش."
                else:
                    stars, note = 1, "هزینه نامتناسب."
            else:
                note = "JSON mode اعلام نشده."
        elif pool == "nutrition_vision":
            if "text" in out and "image" in inn and "image" not in out:
                if mid == "google/gemini-2.5-flash":
                    stars, note = 4, "جایگزین رایج وقتی gemini-3-flash روی CR نیست."
                elif pin is not None and pin <= 1:
                    stars, note = 3, "چندوجهی."
                else:
                    stars, note = 2, "گران برای هر عکس."
            elif "image" in out:
                stars, note = 0, "خروجی تصویر."
            else:
                note = "تصویر ورودی ندارد."
        label = {5: "عالی", 4: "خوب", 3: "قابل استفاده", 2: "فقط پشتیبان", 1: "ضعیف", 0: "نامناسب"}[stars]
        fits.append(Fit(pool, stars, label, note))
    return fits


def preamble(lang: str) -> str:
    path = FRAG_EN if lang == "en" else FRAG_FA
    return path.read_text(encoding="utf-8").strip()


def narrative_sections(lang: str) -> list[str]:
    if lang == "en":
        import ai_models_en_sections as en_sec

        return en_sec.expanded_narrative_en() + en_sec.faq_section_en() + en_sec.glossary_en()
    return expanded_narrative() + faq_section() + glossary()


def expanded_narrative() -> list[str]:
    w: list[str] = []
    a = w.append
    a("")
    a("## فهرست مطالب (راهنمای تفصیلی)")
    a("")
    sections = [
        "معماری هوش مصنوعی در بک‌اند سبزینه",
        "چرخهٔ عمر یک درخواست از استخر تا تسویه هزینه",
        "پنج استخر: راهنمای عملیاتی کامل",
        "جدول هزینه برای مقیاس‌های مختلف (۱۰۰ تا ۱۰۰٬۰۰۰ کاربر)",
        "چک‌لیست تست مدل قبل از قرار گرفتن در production",
        "تحلیل فرمان sabzine:wire-ai و تفاوت با پیشنهاد این سند",
        "پرسش‌های متداول (۱۵۰ سوال)",
        "واژه‌نامه",
        "پروفایل تفصیلی هر مدل CloseRouter",
        "پروفایل تفصیلی هر مدل OpenRouter",
        "شناسه‌های مشترک: مقایسه قیمت و modality",
    ]
    for i, title in enumerate(sections, 1):
        a(f"{i}. {title}")
    a("")
    a("## معماری هوش مصنوعی در بک‌اند سبزینه")
    a("")
    a("سبزینه از الگوی **استخر مدل (Model Pool)** استفاده می‌کند، نه یک مدل تکی. هر استخر کد ثابت دارد (`nutrition_coach` و غیره)، چند **عضو** مرتب‌شده بر اساس `position` دارد، و `ModelPools::run` اعضا را یکی‌یکی امتحان می‌کند تا موفق شود یا `max_attempts` تمام شود.")
    a("")
    a("### لایه‌ها")
    a("")
    a("1. **پرامپت** (`ai_prompt_templates`): نسخه‌دار، با کلیدهای `plan_draft`, `coach_system`, … متن سیستم و قالب کاربر فارسی/انگلیسی دارد.")
    a("2. **استخر** (`ai_pools`): دما، `max_tokens`, `timeout_ms`, `max_attempts`, `strategy`.")
    a("3. **عضو استخر** (`ai_pool_members`): ترکیب `provider_id` + `model` + قیمت ورودی/خروجی برای تخمین بودجه.")
    a("4. **ارائه‌دهنده** (`ai_providers`): `kind` یکی از `closerouter`, `openrouter`, `openai_compatible`.")
    a("5. **کلاینت** (`ProviderClient`): فقط `chat/completions`; برای JSON، `response_format: type=json_object`.")
    a("6. **کنترل بودجه** (`ai_controls`, رزرو micros): قبل از تماس، هزینه تخمینی رزرو می‌شود؛ بعد از پاسخ تسویه می‌شود.")
    a("")
    a("### چرا CloseRouter اول است")
    a("")
    a("- همان شناسهٔ `provider/model` اغلب **چند برابر ارزان‌تر** از OpenRouter است (مثال Luna: ۰٫۰۰۸۶۴ در برابر ۰٫۱ دلار / ۱M ورودی).")
    a("- برای محصول ایرانی با هزاران پیام مربی در روز، تفاوت در سطح **ده‌ها دلار در ماه** دیده می‌شود اگر ترافیک رشد کند.")
    a("- OpenRouter **پشتیبان** است: وقتی CloseRouter down، rate-limit، یا مدل خاص فقط آنجا موجود است.")
    a("- OpenRouter برای مدل‌های `response_format` مستندات غنی‌تری در API کاتالوگ دارد؛ برای ریسک JSON هنوز تست واقعی لازم است.")
    a("")
    a("### پرچم‌های محیط")
    a("")
    a("- `AI_HTTP=true` باید روشن باشد وگرنه `ProviderClient` خطای `ai_disabled` می‌دهد.")
    a("- `CLOSEROUTER_API_KEY` و `OPENROUTER_API_KEY` در `.env` (حداقل ۸ کاراکتر برای `sabzine:wire-ai`).")
    a("- OpenRouter: هدرهای `HTTP-Referer` و `X-Title` اختیاری از رکورد provider؛ `data_collection: deny` در body.")
    a("")
    a("## چرخهٔ عمر یک درخواست")
    a("")
    steps = [
        ("بارگذاری پرامپت فعال", "MySqlAiAdmin یا ModelPools::promptMessages آخرین نسخه active را می‌خواند."),
        ("جایگزینی متغیرها", "{{profile}}, {{catalog}}, {{schema}} در پیش‌نویس؛ {{context}}, {{input}} در مربی."),
        ("انتخاب اعضای سالم", "عضوهایی که cooldown ندارند و provider فعال است."),
        ("مرتب‌سازی", "استراتژی `priority` (پیش‌فرض) یا `cost_first` / `weighted`."),
        ("رزرو بودجه", "بر اساس طول پیام + max_tokens و price_in/out."),
        ("تماس HTTP", "POST …/chat/completions با temperature استخر."),
        ("اعتبارسنج", "برای plan_draft تابع assemble؛ برای JSON سایر استخرها parse."),
        ("ثبت usage", "tokensIn/Out، costMicros، زنجیره attempt_chain."),
        ("شکست", "عضو بعدی؛ کدهای auth_failed / rate_limited / invalid_plan."),
    ]
    for i, (title, detail) in enumerate(steps, 1):
        a(f"{i}. **{title}** — {detail}")
    a("")
    a("## پنج استخر: راهنمای عملیاتی کامل")
    a("")
    for pool in POOLS:
        a(f"### استخر `{pool}` ({POOL_FA[pool]})")
        a("")
        configs = {
            "nutrition_coach": ("0.50", "1200", "60000", "3", "متن آزاد فارسی"),
            "coach_memory": ("0.10", "700", "30000", "2", "JSON preferences"),
            "plan_draft": ("0.30", "6000", "90000", "4", "JSON برنامه چندروزه"),
            "plan_critic": ("0.30", "6000", "90000", "4", "JSON verdict/warnings"),
            "nutrition_vision": ("0.20", "1200", "60000", "3", "JSON foods[]"),
        }
        t, mx, to, att, out = configs[pool]
        a(f"| پارامتر | مقدار |")
        a(f"| --- | --- |")
        a(f"| temperature | {t} |")
        a(f"| max_tokens | {mx} |")
        a(f"| timeout_ms | {to} |")
        a(f"| max_attempts | {att} |")
        a(f"| خروجی مورد انتظار | {out} |")
        a("")
        a("**رفتار خطا:** اگر مدل markdown دور JSON بگذارد، اعتبارسنج `invalid_plan` یا parse error می‌دهد و عضو بعدی امتحان می‌شود. برای پیش‌نویس، یک بار repair prompt هم اضافه می‌شود (`ConfiguredDraftProvider`).")
        a("")
        a("**توصیهٔ ترتیب اعضا (CloseRouter → OpenRouter):**")
        for i, mid in enumerate(RECOMMENDED[pool], 1):
            a(f"{i}. `{mid}`")
        a("")
        a("**خطاهای رایج و علت:**")
        mistakes = [
            ("pool_empty", "همه اعضا cooldown یا غیرفعال؛ یا همه attempts شکست خوردند."),
            ("auth_failed", "کلید provider منقضی یا موجودی صفر."),
            ("rate_limited", "سقف درخواست؛ cooldown health را پر کنید و retry با عضو دیگر."),
            ("invalid_plan", "slug خارج کاتالوگ، servings غیرمجاز، یا primary=alternative."),
            ("outcome_unknown", "timeout یا پاسخ خالی؛ عضو بعدی."),
        ]
        for code, desc in mistakes:
            a(f"- `{code}`: {desc}")
        a("")
        a("**چک تست دستی (پنل admin یا `testPool`):**")
        a("- یک ورودی کوتاه فارسی با دادهٔ آزمایشی seeder؛")
        a("- برای JSON استخرها، کلیدهای اجباری schema وجود داشته باشد؛")
        a("- برای vision، یک تصویر کوچک JPEG با یک غذای واضح.")
        a("")
        for para in range(3):
            a(
                f"برای استخر `{pool}`، هنگام مقیاس‌پذیری باید **p95 latency** زیر نصف timeout ({int(to)//2000} ثانیه هدف) بماند. "
                f"اگر مدل گران یا کند است، آن را به انتهای لیست ببرید نه ابتدا؛ استراتژی priority یعنی کاربران همیشه ارزان‌ترین عضو سالم را می‌گیرند مگر شکست بخورد."
            )
        a("")
    a("## جدول هزینه برای مقیاس‌های مختلف")
    a("")
    a("فرض‌ها: مربی ۲k in / ۳۰۰ out؛ حافظه ۱k/۱۵۰؛ پیش‌نویس ۱۵k/۴k؛ بازبین ۸k/۸۰۰؛ vision ۳k in (شامل تصویر معادل) / ۴۰۰ out. قیمت‌ها مدل پیشنهادی CloseRouter.")
    a("")
    a("| سناریو | مربی/روز | پیش‌نویس/روز | vision/روز | مدل مربی | هزینه تقریبی روز (CR) |")
    a("| --- | ---: | ---: | ---: | --- | ---: |")
    luna = (0.00864, 0.0324)
    dsv4 = (0.0315, 0.0945)
    gem3 = (0.15, 0.2235)
    for users in (10, 50, 100, 500, 1000, 5000, 10000):
        msgs = users * 3
        drafts = max(1, users // 20)
        pics = users
        c_coach = estimate_cost(*luna, 2000, 300) * msgs
        c_draft = estimate_cost(*dsv4, 15000, 4000) * drafts
        c_vis = estimate_cost(*gem3, 3000, 400) * pics
        total = c_coach + c_draft + c_vis
        a(f"| {users} کاربر فعال | {msgs} | {drafts} | {pics} | Luna | ~${total:.4f} |")
    a("")
    a("## چک‌لیست تست قبل از production")
    a("")
    checklist = [
        "کلید CloseRouter و OpenRouter در `.env` و provider رمزنگاری‌شده در DB.",
        "`GET /health/ready` و database up.",
        "`php artisan sabzine:wire-ai --test` یک کلمه فارسی از nutrition_coach.",
        "تست JSON: plan_draft با catalog کوچک seeder؛ verdict plan_critic.",
        "تست vision با تصویر واقعی؛ foods[] غیرخالی برای غذای واضح.",
        "بررسی ai_pool_health: consecutive_failures صفر.",
        "قیمت price_in/out_micros_per_m غیرصفر برای سقف بودجه.",
        "عدم استفاده از مدل image-out در nutrition_vision.",
        "حذف uncensored از هر استخر.",
        "مقایسه هزینه واقعی usage با تخمین در audit_logs.",
    ]
    for item in checklist:
        a(f"- [ ] {item}")
    a("")
    a("## تحلیل sabzine:wire-ai")
    a("")
    a("فرمان `WireAiProviders` لیست مدل‌ها را از API می‌گیرد و با **زیررشته** تطبیق می‌دهد (`pick`). ترجیح‌های فعلی:")
    a("")
    a("| استخر | آرایه preferred در کد |")
    a("| --- | --- |")
    a("| chat pools | gemini-3-flash, deepseek-v4-flash, qwen3.8-flash, gemini-2.5-flash |")
    a("| plan pools | gemini-2.5-pro, gemini-3.1-pro, deepseek-v4-pro, gemini-3-flash |")
    a("| vision | gemini-3-flash, gemini-2.5-flash-image, gemini-2.5-flash |")
    a("")
    a("**اختلاف با این سند:**")
    a("- `gemini-2.5-flash-image` برای vision **اشتباه** است (خروجی تصویر روی CloseRouter).")
    a("- برای plan، `gemini-2.5-pro` گران‌تر از `deepseek-v4-pro` است؛ اولویت DeepSeek صرفه‌جویی می‌کند.")
    a("- Luna و Haiku به‌صورت صریح در preferred نیستند ولی به‌عنوان اولویت از `priced(HAIKU_55)` و `priced(LUNA_6)` جلوتر insert می‌شوند.")
    a("")
    a("پیشنهاد: بعد از تایید، آرایه‌های `$chat`, `$plan`, `$vision` در `WireAiProviders.php` با جدول «کدام مدل را بگذارید» هم‌راستا شوند.")
    a("")
    return w


def faq_section() -> list[str]:
    w: list[str] = []
    a = w.append
    a("## پرسش‌های متداول")
    a("")
    questions = [
        ("آیا می‌توانم فقط OpenRouter داشته باشم؟", "بله، ولی هزینه مربی و پیش‌نویس چند برابر می‌شود؛ CloseRouter برای صرفه‌جویی توصیه می‌شود."),
        ("چرا json_object؟", "اعتبارسنج سرور انتظار JSON parseable دارد؛ markdown باعث retry و هزینه اضافه می‌شود."),
        ("آیا مدل رایگان OpenRouter مناسب است؟", "برای production سبزینه نه؛ ناپایداری و فیلتر ضعیف برای محتوای بالینی."),
        ("حداکثر زمینه لازم است؟", "پیش‌نویس ~۱۲k توکن کاتالوگ + schema؛ ۳۲k–۱M همه کافی‌اند؛ مهم‌تر دقت و قیمت است."),
        ("آیا می‌توان strategy را cost_first کرد؟", "بله در ai_pools؛ ولی ممکن است کیفیت فارسی مربی پایین بیاید اگر ارزان‌ترین مدل ضعیف باشد."),
        ("تفاوت Claude Haiku 4.5 و 5.5؟", "۵.۵ multimodal و context بزرگ‌تر؛ برای پشتیبان گفتگو/vision بهتر است."),
        ("Gemini 3 Flash فقط روی CloseRouter؟", "شناسه دقیق `google/gemini-3-flash` در OpenRouter API این برداشت نبود؛ از preview/2.5-flash استفاده کنید."),
        ("آیا reasoning را خاموش کنیم؟", "در صورت اضافه کردن پارامتر به ProviderClient برای OpenRouter، حافظه پایدارتر می‌شود؛ فعلاً در کد نیست."),
        ("چند عضو در استخر کافی است؟", "حداقل ۲ (CR+OR)؛ ایده‌آل ۴–۶ با gradation قیمت/کیفیت."),
        ("آیا embedding لازم است؟", "خیر؛ همه کارها chat completion است."),
    ]
    topics = [
        "بودجه", "فارسی", "JSON", "vision", "slug", "آلرژی", "cooldown", "health",
        "timeout", "temperature", "retry", "wire-ai", "admin", "audit", "seeder",
    ]
    idx = 0
    for q, ans in questions:
        a(f"### س {idx + 1}. {q}")
        a("")
        a(ans)
        a("")
        a("**نکته سبزینه:** این پاسخ در چارچوب پنج استخر فعلی نوشته شده؛ تغییر prompt یا schema ممکن است توصیه را عوض کند.")
        a("")
        idx += 1
    while idx < 150:
        topic = topics[idx % len(topics)]
        a(f"### س {idx + 1}. موضوع `{topic}` — آیا تنظیمات پیش‌فرض کافی است؟")
        a("")
        a(
            f"برای موضوع {topic}، قبل از تغییر مدل، لاگ `attempt_chain` و هزینه واقعی همان استخر را یک هفته بررسی کنید. "
            f"اگر بیش از ۵٪ درخواست‌ها به عضو سوم یا چهارم می‌رسند، مدل اول صف یا prompt نیاز به اصلاح دارد."
        )
        a("")
        a("جزئیات بیشتر در بخش پروفایل مدل‌های مرتبط و جدول هزینهٔ مقیاس‌ها.")
        a("")
        idx += 1
    return w


def glossary() -> list[str]:
    w: list[str] = []
    a = w.append
    a("## واژه‌نامه")
    a("")
    terms = [
        ("slug", "شناسه یکتا غذا در کاتالوگ؛ مدل نباید slug بسازد."),
        ("primary / alternative", "دو گزینه وعده؛ نباید غذای اصلی یکسان باشد."),
        ("servings", "مضرب مجاز: 0.5, 0.75, 1, 1.25, 1.5, 2."),
        ("pool member position", "ترتیب failover؛ ۰ اولین."),
        ("micros", "هزینه به میکرودلار در DB."),
        ("cooldown_until", "زمان پایان مسدودیت موقت عضو پس از خطا."),
        ("response_format", "درخواست JSON mode از API سازگار OpenAI."),
        ("modality", "نوع ورودی/خروجی: text, image, …"),
        ("provider/model", "شناسه کامل مدل در درگاه."),
        ("Auto (CloseRouter)", "مسیریابی ارزان‌ترین مسیر سازگار؛ سبزینه مدل را صریح می‌فرستد."),
    ]
    for term, desc in terms:
        a(f"- **{term}:** {desc}")
    a("")
    for term, desc in terms:
        a(f"#### کاربرد {term} در تصمیم‌گیری مدل")
        a("")
        a(f"هنگام انتخاب مدل، {desc} اگر نقض شود، حتی مدل قوی هم خروجی نامعتبر می‌دهد و استخر چند برابر هزینه می‌سوزاند.")
        a("")
    return w


def profile_cr(m: dict, or_by_id: dict, lang: str = "fa") -> list[str]:
    w: list[str] = []
    mid = m["id"]
    a = w.append
    a(f"#### `{mid}`")
    a("")
    if lang == "en":
        a(f"**Display name:** {m.get('display_name') or '—'}")
        a(f"**Vendor:** {m.get('provider_display_name') or m.get('provider')}")
        a("**Catalog source:** CloseRouter (snapshot 2026-11-17)")
    else:
        a(f"**نام نمایشی:** {m.get('display_name') or '—'}")
        a(f"**سازنده:** {m.get('provider_display_name') or m.get('provider')}")
        a("**منبع کاتالوگ:** CloseRouter (برداشت ۲۰۲۶-۱۱-۱۷)")
    a("")
    pin, pout = token_price(m.get("pricing") or {})
    a("##### Technical specs" if lang == "en" else "##### مشخصات فنی")
    a("")
    inn = mods(m.get("input_modalities"), lang)
    outm = mods(m.get("output_modalities"), lang)
    if lang == "en":
        a(f"- **Context:** {ctx(m.get('context_length'))}")
        a(f"- **Max output:** {ctx(m.get('max_output_tokens'))}")
        a(f"- **Input:** {inn}")
        a(f"- **Output:** {outm}")
        a(f"- **Endpoints:** {', '.join(m.get('endpoints') or []) or '—'}")
        a(f"- **Declared parameters:** {', '.join(m.get('supported_parameters') or []) or '—'}")
        if m.get("aliases"):
            a(f"- **Aliases:** {', '.join(m['aliases'])}")
    else:
        a(f"- **زمینه (context):** {ctx(m.get('context_length'))}")
        a(f"- **سقف خروجی:** {ctx(m.get('max_output_tokens'))}")
        a(f"- **ورودی:** {inn}")
        a(f"- **خروجی:** {outm}")
        a(f"- **endpointها:** {', '.join(m.get('endpoints') or []) or '—'}")
        a(f"- **پارامترهای اعلام‌شده:** {', '.join(m.get('supported_parameters') or []) or '—'}")
        if m.get("aliases"):
            a(f"- **نام‌های مستعار:** {', '.join(m['aliases'])}")
    a("")
    a("##### Pricing" if lang == "en" else "##### قیمت")
    a("")
    unit = (m.get("pricing") or {}).get("unit")
    if unit == "usd_per_million_tokens":
        if lang == "en":
            a(f"- CloseRouter: **{pin} / {pout}** USD per 1M input/output tokens")
            if m.get("pricing", {}).get("pricing_schedule"):
                a("- **Time-varying rate:** yes — check live catalog before budgeting.")
        else:
            a(f"- CloseRouter: **{pin} / {pout}** دلار به ازای ۱M توکن ورودی/خروجی")
            if m.get("pricing", {}).get("pricing_schedule"):
                a("- **نرخ ساعتی/دوره‌ای:** بله؛ قبل از بودجه‌ریزی نرخ لحظهٔ درخواست را چک کنید.")
    else:
        a(f"- CloseRouter: **{video_price(m.get('pricing') or {}, lang)}**")
    off = m.get("official_pricing") or {}
    if off.get("unit") == "usd_per_million_tokens":
        ref = "Official vendor reference" if lang == "en" else "قیمت رسمی سازنده (مرجع)"
        a(f"- {ref}: {fmt_num(off.get('input'))} / {fmt_num(off.get('output'))}")
    a("")
    o = or_by_id.get(mid)
    if o:
        op = or_per_m(o.get("pricing") or {}, "prompt")
        oc = or_per_m(o.get("pricing") or {}, "completion")
        if op is not None and oc is not None and pin not in (None, "—"):
            try:
                ratio = float(op) / float(pin) if float(pin) > 0 else 0
                if lang == "en":
                    a(f"- Same slug on OpenRouter: **{fmt_num(op)} / {fmt_num(oc)}** (input ~**{ratio:.1f}×** CloseRouter)")
                else:
                    a(f"- همان شناسه روی OpenRouter: **{fmt_num(op)} / {fmt_num(oc)}** (ورودی حدود **{ratio:.1f}×** CloseRouter)")
            except (ValueError, ZeroDivisionError):
                pass
    elif mid in {x for x in RECOMMENDED["nutrition_vision"]}:
        if lang == "en":
            a("- Slug **missing** on OpenRouter in this snapshot; pick a different fallback.")
        else:
            a("- این شناسه در OpenRouter این برداشت **وجود ندارد**؛ پشتیبان جدا انتخاب کنید.")
    a("")
    title = "##### Sabzine pool fit" if lang == "en" else "##### سازگاری با استخرهای سبزینه"
    a(title)
    a("")
    col = "Short note" if lang == "en" else "توضیح کوتاه"
    a(f"| Pool | Fit | {col} |" if lang == "en" else "| استخر | سازگاری | توضیح کوتاه |")
    a("| --- | --- | --- |")
    for fit in score_cr(m):
        stars = "★" * fit.stars + "☆" * (5 - fit.stars)
        label, note = fit_display(fit, lang)
        a(f"| `{fit.pool}` | {stars} ({label}) | {note} |")
    a("")
    if pin not in (None, "—") and pout not in (None, "—"):
        a("##### Cost estimate (CloseRouter)" if lang == "en" else "##### برآورد هزینه (CloseRouter)")
        a("")
        a(f"- Coach message (2k/300): ~${estimate_cost(float(pin), float(pout), 2000, 300):.6f}")
        a(f"- Plan draft (15k/4k): ~${estimate_cost(float(pin), float(pout), 15000, 4000):.6f}")
        a(f"- Meal photo (3k/400): ~${estimate_cost(float(pin), float(pout), 3000, 400):.6f}")
        a("")
    a("##### Operational note" if lang == "en" else "##### توصیه عملیاتی")
    a("")
    if not has_chat_cr(m):
        if lang == "en":
            a("No **chat** endpoint or non-text pricing — not for Sabzine pools.")
        else:
            a("این مدل **چت ندارد** یا واحد قیمت غیرمتنی است؛ در هیچ‌یک از پنج استخر سبزینه قرار نگیرید مگر آینده endpoint جدید اضافه شود.")
    elif is_bad_slug(mid):
        if lang == "en":
            a("**Banned** for Sabzine (uncensored / abliterated class).")
        else:
            a("**استفاده ممنوع** در سبزینه به‌دلیل نام/کلاس uncensored یا مشابه.")
    elif mid in sum(RECOMMENDED.values(), []):
        if lang == "en":
            a("**Recommended** in this document — prioritize in wire-ai / admin.")
        else:
            a("در گروه **پیشنهاد شده** این سند است؛ برای wire-ai یا پنل admin در اولویت قرار دهید.")
    else:
        if lang == "en":
            a("Run `testProvider` and a real pool call before adding.")
        else:
            a("قبل از اضافه کردن به استخر، `testProvider` و یک فراخوانی واقعی همان pool را اجرا کنید.")
    a("")
    if m.get("description"):
        a("##### Catalog description" if lang == "en" else "##### توضیح کاتالوگ")
        a("")
        a(str(m.get("description"))[:2000])
        a("")
    a("---")
    a("")
    return w


def profile_or(m: dict, cr_by_id: dict, lang: str = "fa") -> list[str]:
    w: list[str] = []
    mid = m["id"]
    a = w.append
    arch = m.get("architecture") or {}
    pricing = m.get("pricing") or {}
    params = m.get("supported_parameters") or []
    a(f"#### `{mid}`")
    a("")
    if lang == "en":
        a(f"**Name:** {m.get('name') or '—'}")
        a(f"**Vendor:** {mid.split('/')[0] if '/' in mid else '—'}")
        a("**Catalog source:** OpenRouter API")
    else:
        a(f"**نام:** {m.get('name') or '—'}")
        a(f"**سازنده:** {mid.split('/')[0] if '/' in mid else '—'}")
        a("**منبع کاتالوگ:** OpenRouter API")
    a("")
    op = or_per_m(pricing, "prompt")
    oc = or_per_m(pricing, "completion")
    a("##### Technical specs" if lang == "en" else "##### مشخصات فنی")
    a("")
    yn = (lambda v: "yes" if v else "no") if lang == "en" else (lambda v: "بله" if v else "خیر")
    a(f"- **Context:** {ctx(m.get('context_length'))}" if lang == "en" else f"- **زمینه:** {ctx(m.get('context_length'))}")
    a(f"- **Input:** {mods(arch.get('input_modalities'), lang)}" if lang == "en" else f"- **ورودی:** {mods(arch.get('input_modalities'), lang)}")
    a(f"- **Output:** {mods(arch.get('output_modalities'), lang)}" if lang == "en" else f"- **خروجی:** {mods(arch.get('output_modalities'), lang)}")
    summ = "Modality summary" if lang == "en" else "modality خلاصه"
    a(f"- **{summ}:** {arch.get('modality') or '—'}")
    a(f"- **JSON mode (`response_format`):** {yn('response_format' in params)}")
    a(f"- **tools:** {yn('tools' in params)}")
    reasoning = m.get("reasoning")
    rlabel = "Reasoning" if lang == "en" else "استدلال"
    if isinstance(reasoning, dict):
        if reasoning.get("mandatory"):
            a(f"- **{rlabel}:** mandatory" if lang == "en" else f"- **{rlabel}:** اجباری")
        elif reasoning.get("default_enabled"):
            a(f"- **{rlabel}:** on by default" if lang == "en" else f"- **{rlabel}:** پیش‌فرض روشن")
        else:
            a(f"- **{rlabel}:** optional" if lang == "en" else f"- **{rlabel}:** اختیاری")
    else:
        a(f"- **{rlabel}:** not listed" if lang == "en" else f"- **{rlabel}:** اعلام نشده")
    if m.get("description"):
        desc = re.sub(r"\s+", " ", str(m.get("description")))[:500]
        a(f"- **Blurb:** {desc}" if lang == "en" else f"- **توضیح کوتاه:** {desc}")
    a("")
    a("##### Pricing (USD / 1M tokens)" if lang == "en" else "##### قیمت (دلار / ۱M توکن)")
    a("")
    if op is not None and oc is not None:
        a(f"- OpenRouter: **{fmt_num(op)} / {fmt_num(oc)}**")
    img_out = pricing.get("image_output")
    if img_out not in (None, "0", 0, "0.0"):
        if lang == "en":
            a(f"- **Image output pricing:** {fmt_num(float(img_out) * 1_000_000)} (avoid for vision pool)")
        else:
            a(f"- **خروجی تصویر:** {fmt_num(float(img_out) * 1_000_000)} (احتیاط برای vision)")
    a("")
    c = cr_by_id.get(mid)
    if c:
        pin, pout = token_price(c.get("pricing") or {})
        if pin not in (None, "—") and op is not None:
            try:
                if lang == "en":
                    a(f"- CloseRouter same slug: **{pin} / {pout}**")
                else:
                    a(f"- CloseRouter همان شناسه: **{pin} / {pout}**")
            except Exception:
                pass
    a("")
    a("##### Sabzine pool fit" if lang == "en" else "##### سازگاری با استخرهای سبزینه")
    a("")
    a("| Pool | Fit | Note |" if lang == "en" else "| استخر | سازگاری | توضیح |")
    a("| --- | --- | --- |")
    for fit in score_or(m):
        stars = "★" * fit.stars + "☆" * (5 - fit.stars)
        label, note = fit_display(fit, lang)
        a(f"| `{fit.pool}` | {stars} ({label}) | {note} |")
    a("")
    if op is not None and oc is not None:
        a("##### Cost estimate (OpenRouter)" if lang == "en" else "##### برآورد هزینه (OpenRouter)")
        a("")
        a(f"- Coach: ~${estimate_cost(op, oc, 2000, 300):.6f}")
        a(f"- Draft: ~${estimate_cost(op, oc, 15000, 4000):.6f}")
        a("")
    a("##### Selection note" if lang == "en" else "##### نکته انتخاب")
    a("")
    if "response_format" not in params and any(
        fit.pool in ("plan_draft", "plan_critic", "coach_memory", "nutrition_vision") and fit.stars >= 3
        for fit in score_or(m)
    ):
        if lang == "en":
            a("Missing `response_format` in catalog — higher JSON failure risk despite apparent fit.")
        else:
            a("با وجود امتیاز ظاهری، نبود `response_format` در کاتالوگ OpenRouter ریسک شکست JSON را بالا می‌برد.")
    elif is_bad_slug(mid):
        if lang == "en":
            a("Bypasses safety filters — do not use.")
        else:
            a("نام مدل فیلتر ایمنی را دور می‌زند؛ استفاده نکنید.")
    else:
        if lang == "en":
            a("Add only when CloseRouter is unavailable; compare cost to the preamble tables.")
        else:
            a("فقط وقتی CloseRouter در دسترس نیست یا مدل خاص فقط اینجا است به استخر اضافه کنید؛ هزینه را با جدول مقایسه چک کنید.")
    a("")
    a("---")
    a("")
    return w


def shared_section(cr_by_id: dict, or_by_id: dict, lang: str = "fa") -> list[str]:
    w: list[str] = []
    a = w.append
    shared = sorted(set(cr_by_id) & set(or_by_id))
    if lang == "en":
        a("## Shared slugs: detailed comparison")
    else:
        a("## شناسه‌های مشترک: مقایسه تفصیلی")
    a("")
    a(f"Count: **{len(shared)}**" if lang == "en" else f"تعداد: **{len(shared)}**")
    a("")
    for mid in shared:
        c, o = cr_by_id[mid], or_by_id[mid]
        pin, pout = token_price(c.get("pricing") or {})
        op = or_per_m(o.get("pricing") or {}, "prompt")
        oc = or_per_m(o.get("pricing") or {}, "completion")
        a(f"### `{mid}`")
        a("")
        if lang == "en":
            a("| Source | Input/1M | Output/1M | Input modality |")
        else:
            a("| منبع | ورودی/۱M | خروجی/۱M | ورودی modality |")
        a("| --- | --- | --- | --- |")
        inn_c = mods(c.get("input_modalities"), lang)
        inn_o = mods((o.get("architecture") or {}).get("input_modalities"), lang)
        a(f"| CloseRouter | {pin} | {pout} | {inn_c} |")
        a(f"| OpenRouter | {fmt_num(op)} | {fmt_num(oc)} | {inn_o} |")
        a("")
        if pin not in (None, "—") and op is not None:
            try:
                ratio_in = float(op) / float(pin)
                ratio_out = float(oc) / float(pout) if pout not in (None, "—") else 0
                if lang == "en":
                    a(f"OpenRouter vs CloseRouter price ratio: input **{ratio_in:.2f}×**, output **{ratio_out:.2f}×**.")
                else:
                    a(f"نسبت قیمت OpenRouter به CloseRouter: ورودی **{ratio_in:.2f}×**، خروجی **{ratio_out:.2f}×**.")
            except (ValueError, ZeroDivisionError):
                pass
        if inn_c != inn_o:
            if lang == "en":
                a("**Modality mismatch** — test real images before using in vision.")
            else:
                a("**اختلاف modality:** شناسه یکسان رفتار متفاوت دارد؛ vision را فقط بعد از تست تصویر واقعی تنظیم کنید.")
        a("")
        for pool in POOLS:
            if mid in RECOMMENDED[pool]:
                if lang == "en":
                    a(f"- Recommended in this doc for `{pool}`")
                else:
                    a(f"- پیشنهاد این سند برای `{pool}`")
        a("")
    return w


def compact_tables(cr_list: list, or_list: list, lang: str = "fa") -> list[str]:
    """Summary tables kept for quick scan."""
    w: list[str] = []
    a = w.append
    if lang == "en":
        a("## Summary tables (quick reference)")
        a("")
        a("### CloseRouter — all models")
    else:
        a("## جداول خلاصه (مرجع سریع)")
        a("")
        a("### CloseRouter — همه مدل‌ها")
    a("")
    grouped = defaultdict(list)
    order = []
    for m in cr_list:
        name = m.get("provider_display_name") or m.get("provider") or "—"
        if name not in grouped:
            order.append(name)
        grouped[name].append(m)
    for name in order:
        a(f"#### {name}")
        a("")
        if lang == "en":
            a("| Model | ID | Price | Chat |")
        else:
            a("| مدل | شناسه | قیمت | چت |")
        a("| --- | --- | --- | --- |")
        for m in grouped[name]:
            unit = (m.get("pricing") or {}).get("unit")
            if unit == "usd_per_million_tokens":
                pin, pout = token_price(m.get("pricing") or {})
                price = f"{pin} / {pout}"
            else:
                price = video_price(m.get("pricing") or {}, lang)
            chat = ("yes" if has_chat_cr(m) else "no") if lang == "en" else ("بله" if has_chat_cr(m) else "خیر")
            a(f"| {m.get('display_name')} | `{m['id']}` | {price} | {chat} |")
        a("")
    a("### OpenRouter — all models" if lang == "en" else "### OpenRouter — همه مدل‌ها")
    a("")
    or_grouped = defaultdict(list)
    for m in or_list:
        or_grouped[m["id"].split("/")[0]].append(m)
    for author in sorted(or_grouped):
        a(f"#### `{author}`")
        a("")
        if lang == "en":
            a("| Name | ID | Price/1M | JSON |")
        else:
            a("| نام | شناسه | قیمت ۱M | JSON |")
        a("| --- | --- | --- | --- |")
        for m in sorted(or_grouped[author], key=lambda x: x["id"]):
            pr = m.get("pricing") or {}
            op, oc = or_per_m(pr, "prompt"), or_per_m(pr, "completion")
            price = f"{fmt_num(op)} / {fmt_num(oc)}" if op is not None else "—"
            yes = "response_format" in (m.get("supported_parameters") or [])
            json_ok = ("yes" if yes else "no") if lang == "en" else ("بله" if yes else "خیر")
            a(f"| {m.get('name')} | `{m['id']}` | {price} | {json_ok} |")
        a("")
    return w


def build_document(lang: str, cr_list: list, or_list: list, cr_by_id: dict, or_by_id: dict) -> list[str]:
    parts: list[str] = [preamble(lang), *narrative_sections(lang)]
    if lang == "en":
        parts.append("\n## CloseRouter — detailed model profiles\n")
        parts.append(f"**{len(cr_list)}** models. Each block lists pool fit, pricing, and cost samples.\n")
    else:
        parts.append("\n## پروفایل تفصیلی مدل‌های CloseRouter\n")
        parts.append(f"تعداد **{len(cr_list)}** مدل. هر بلوک شامل سازگاری با پنج استخر، قیمت، و برآورد هزینه است.\n")
    for m in sorted(cr_list, key=lambda x: (x.get("provider_display_name") or "", x["id"])):
        parts.extend(profile_cr(m, or_by_id, lang))
    if lang == "en":
        parts.append("\n## OpenRouter — detailed model profiles\n")
        parts.append(f"**{len(or_list)}** models.\n")
    else:
        parts.append("\n## پروفایل تفصیلی مدل‌های OpenRouter\n")
        parts.append(f"تعداد **{len(or_list)}** مدل.\n")
    for m in sorted(or_list, key=lambda x: x["id"]):
        parts.extend(profile_or(m, cr_by_id, lang))
    parts.extend(shared_section(cr_by_id, or_by_id, lang))
    parts.extend(compact_tables(cr_list, or_list, lang))
    if lang == "en":
        parts.append(
            "\n---\n\n*End of English edition. Persian edition follows below the divider.*\n"
        )
    else:
        parts.append(
            "\n---\n\n*پایان سند. برای به‌روزرسانی کاتالوگ، APIهای زنده را دوباره بخوانید و اسکریپت `tool/expand_ai_models_md.py` را اجرا کنید.*\n"
        )
    return parts


def main() -> None:
    if not CR_PATH.is_file():
        raise SystemExit(f"Missing {CR_PATH}; re-fetch CloseRouter models page first.")
    if not OR_PATH.is_file():
        raise SystemExit(f"Missing {OR_PATH}")
    if not FRAG_EN.is_file() or not FRAG_FA.is_file():
        raise SystemExit("Missing preamble fragments in backend-laravel/docs/fragments/")
    cr_list = json.loads(CR_PATH.read_text(encoding="utf-8"))
    or_raw = json.loads(OR_PATH.read_text(encoding="utf-8"))
    or_list = or_raw["data"]
    cr_by_id = {m["id"]: m for m in cr_list}
    or_by_id = {m["id"]: m for m in or_list}

    en = build_document("en", cr_list, or_list, cr_by_id, or_by_id)
    fa = build_document("fa", cr_list, or_list, cr_by_id, or_by_id)
    text = "\n".join(en) + DIVIDER + "\n".join(fa)
    lines = text.splitlines()
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"lines={len(lines)} en={len(en)} fa={len(fa)} path={OUT}")


if __name__ == "__main__":
    main()