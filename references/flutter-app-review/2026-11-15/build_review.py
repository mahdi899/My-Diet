from pathlib import Path
import base64
import json

ROOT = Path(__file__).resolve().parent
REPO = Path("D:/ad/My-Diet")
data = json.loads((ROOT / "review-data.json").read_text(encoding="utf-8"))


def source_link(evidence):
    path = REPO / evidence["file"]
    label = evidence["file"] + (":" + str(evidence["line"]) if evidence["line"] else "")
    target = path.as_posix() + (":" + str(evidence["line"]) if evidence["line"] else "")
    return f"[{label}]({target})"


lines = [
    "# بررسی Flutter فعلی و پیشنهاد تغییرات رژیم من",
    "",
    "تاریخ بررسی: ۲۰۲۶-۱۱-۱۵، Asia/Tehran. مبنای مخزن: commit `103ac3d`. نیازمندی محصول از توضیحات کاربر و سند تحلیل فیبو در ۱۴ نوامبر گرفته شده است.",
    "",
    "## پیشنهاد اصلی",
    "",
    "بازطراحی مرحله‌ای روی پایهٔ فعلی: ابتدا مسیر دریافت برنامه و دقت داده، سپس پایداری و هماهنگی، و بعد چیدمان و حرکت‌های اختصاصی. اپ فعلی از نظر قابلیت از یک نمونهٔ اولیهٔ ساده جلوتر است. بیشتر ارزش کار بعدی در کامل‌کردن اتصال بین بخش‌های موجود است.",
    "",
    "مسیر هدف برای **اولین برنامه**: آنبوردینگ ← تولید واقعی پیش‌نویس AI ← پرداخت ← بررسی/اصلاح متخصص ← انتشار برنامه و ورود به خانه/مربی/برنامه. برای تمدید، دسترسی به برنامهٔ معتبر قبلی باید قرارداد جدا داشته باشد.",
    "",
    "## دامنه و روش",
    "",
    "فهرست ۱۴۶ فایل Dart بررسی شد و مرور کد روی مسیرهای فعال ورود و آنبوردینگ، shell، خانه، مربی، برنامه، adapterهای API، مدل‌های غذا و قراردادهای مرتبط بک‌اند/وب متمرکز بود؛ همهٔ خطوط همهٔ فایل‌ها بازبینی نشدند. گراف قبلی مسیرهای قدیمی داشت و نتیجه‌ها با فایل‌های فعلی تأیید شدند. تحلیل قبلی APK فیبو استاتیک بود؛ در این نوبت برای خود رژیم من پنج رندر محلی Flutter با دادهٔ نمونه ساخته و دیده شد.",
    "",
    "کد محصول تغییر نکرده است. این پوشه فقط گزارش، دادهٔ مرور و harness ثبت تصویر را اضافه می‌کند.",
    "",
    "## قابلیت‌هایی که از قبل داریم",
    "",
    *["- " + item for item in data["existing"]],
    "",
    "پس افزودن سه تب، چت، دستورپخت، خط‌کش یا یک کیت انیمیشن از صفر، پیشنهاد این بررسی نیست. دامنهٔ تغییر بر اتصال، دقت و تجربهٔ همین اجزا متمرکز است.",
    "",
    "## پیشنهادها با اولویت",
    "",
    "P0: شرط تطبیق با مسیر اصلی و دادهٔ قابل‌اتکای محصول. P1: هماهنگی و تجربهٔ استفادهٔ روزمره. P2: هویت حرکتی و ساختار قابل‌نگهداری. این اولویت‌بندی پیشنهاد اجرایی است، نه درجه‌بندی امنیتی.",
]
for finding in data["findings"]:
    lines += [
        "", f"### {finding['id']} · {finding['priority']} · {finding['title']}", "",
        "**وضع فعلی:** " + finding["current"], "",
        "**تغییر پیشنهادی:** " + finding["proposal"], "",
        "**معیار پذیرش:** " + finding["acceptance"], "",
        "**حدود نتیجه‌گیری:** " + finding["note"], "",
        "**شواهد:** " + "، ".join(source_link(e) for e in finding["evidence"]),
    ]

lines += [
    "", "## چیدمان پیشنهادی سه تب", "",
    "### خانه؛ اقدام امروز", "",
    "سلام و وضعیت برنامه → وعدهٔ بعدی و اقدام ثبت → خلاصهٔ فشردهٔ کالری و ماکرو با واحد → ثبت سریع آب و وزن → پیشرفت هفتگی و پیام مرتبط مربی. حلقهٔ کالری می‌تواند کوچک‌تر بماند و به جزئیات باز شود.",
    "", "### برنامه؛ اجرای وعده‌ها", "",
    "سربرگ نسخه/متخصص → نوار روزهای هفته → وعده‌ها و مقدار مصرف → جزئیات غذا و دستورپخت → تعویض تأییدشده → لیست خرید. هدف و مسیر وزن در بخش جمع‌شونده یا صفحهٔ پیشرفت باشند. روزهای گذشته قابل‌مرور بمانند؛ اجازهٔ ویرایش از اجازهٔ مشاهده جدا باشد.",
    "", "### مربی؛ گفتگو با زمینهٔ درست", "",
    "هویت مربی و وضعیت پاسخ → تاریخچهٔ پایدار → کارت‌های مرتبط با برنامه و اقدامات ثبت → ورودی پیام/عکس → دسترسی روشن به خانه و برنامه. نقش پاسخ‌دهنده و مسیر ارجاع به متخصص در محصول مشخص شود. تغییرات پیشنهادی چت نباید بدون طی مسیر انتشار، نسخهٔ برنامهٔ تأییدشده را عوض کنند.",
    "", "## حرکت‌هایی که از تحلیل فیبو الهام می‌گیرند", "",
    "سه تعامل شاخص پیشنهادی: ورودی وزن/قد با کنترل دقیق؛ ثبت آب/وعده با واکنش کوتاه بعد از ذخیره؛ نمایش باز شدن برنامه پس از انتشار واقعی. خط‌کش، Ring، Ticker و کاهش حرکت در پروژه وجود دارند و نقطهٔ شروع مناسبی‌اند. شخصیت اختصاصی Rive یک آزمایش بعدی است؛ دارایی فیبو در محصول کپی نشده است.",
    "",
    "PlanBuildTheater فعلی هنگام ارسال پاسخ‌ها اجرا می‌شود و عنوان ساخت برنامه دارد. پیشرفت نمایشی باید به رخداد درست وصل شود. خواندن پاسخ، ساخت AI، پرداخت موفق و تأیید متخصص مراحل جدا هستند و نشانهٔ موفقیت هرکدام باید همان رویداد را نشان دهد.",
    "", "## ترتیب اجرای پیشنهادی", "",
]
for phase in data["phases"]:
    lines += [f"- **{phase['title']}** ({'، '.join(phase['items'])}): {phase['exit']}"]
lines += [
    "",
    "برای Laravel، ابتدا DTOها، JourneyState، کد خطا و قرارداد idempotency تثبیت شود. هم‌زمان تغییر فناوری بک‌اند و طراحی تازهٔ UI بدون قرارداد روشن، تشخیص علت اشکال را دشوار می‌کند. در این بررسی Laravel نصب یا مهاجرت داده نشده است.",
    "", "## نتیجهٔ بررسی‌های اجرایی", "",
    "- `flutter analyze --no-pub`: موفق، **No issues found**.",
    "- اجرای ۵ فایل تست موجود: **۱۴ موفق، ۱ ناموفق**. فایل‌ها: `session/live_plan_test.dart`، `onboarding/flow_test.dart`، `customer_access_test.dart`، `features/tabs_test.dart` و `coach/coach_flow_test.dart`.",
    "- شکست `completing a plan meal uses the store` در `app/test/features/tabs_test.dart:161` در اجرای مستقل هم تکرار شد.",
    "- تست پس از لمس «انجام شد» انتظار ثبت فوری دارد. کد فعلی `plan_meals.dart:28` پنجرهٔ ConsumeSheet را باز می‌کند و ثبت در `consume_sheet.dart:90` انجام می‌شود. بنابراین این شکست نشان‌دهندهٔ انتظار قدیمی تست نسبت به UI دو مرحله‌ای است؛ به‌تنهایی خرابی کل مسیر ثبت مصرف را ثابت نمی‌کند.",
    "- harness ثبت تصویر: موفق؛ پنج تصویر ۳۹۰×۸۴۴ از رندر واقعی ویجت‌های فعلی با دادهٔ نمونه و تاریخ ثابت ۲۰۲۶-۱۱-۰۹ تولید و مشاهده شد.",
    "",
    "این تست‌ها پوشش ورود واقعی، درگاه، تأیید متخصص، AI زنده، کارایی روی گوشی یا کل suite مخزن نیستند. داده‌های تصاویر، حساب واقعی کاربر نیستند. دکمهٔ «نمایش برنامه» در تصویر انتظار به fixture بدون serverAuth تعلق دارد؛ این دکمه در کد live با همین شرط نمایش داده نمی‌شود.",
    "", "## تصاویر مشاهده‌شده", "",
    "- [خانه با دادهٔ نمونه](./captures/01-home-fixture.png)",
    "- [برنامه با دادهٔ نمونه](./captures/02-plan-fixture.png)",
    "- [مربی با پاسخ‌های نمونه](./captures/03-coach-fixture.png)",
    "- [انتظار متخصص با fixture](./captures/04-waiting-fixture.png)",
    "- [صفحهٔ ورود فعلی](./captures/05-first-login.png)",
    "",
    "برای تکمیل بازبینی قبل از انتشار: یک چرخهٔ یکپارچه وب→اپ با همان هویت، draft→پرداخت→متخصص→انتشار، خطای شبکه و جابه‌جایی حساب در محیط تست کنترل‌شده اجرا شود. این سناریوها در این نوبت علیه محیط عملیاتی اجرا نشده‌اند.",
]
(ROOT / "REVIEW.fa.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

shots = []
for name, label in [
    ("01-home-fixture", "خانه"), ("02-plan-fixture", "برنامه"),
    ("03-coach-fixture", "مربی"), ("04-waiting-fixture", "انتظار نمونه"),
    ("05-first-login", "ورود"),
]:
    shots.append({"name": name, "label": label, "src": "data:image/png;base64," + base64.b64encode((ROOT / "captures" / (name + ".png")).read_bytes()).decode("ascii")})

template = r'''import { Button, Callout, Divider, Grid, H1, H2, H3, Row, Stack, Table, Text, useCanvasState, useHostTheme } from "cursor/canvas";
const data = __DATA__;
const shots = __SHOTS__;
const sections = ["نتیجهٔ بررسی", "پیشنهادها", "طرح سه تب", "ترتیب اجرا", "تصاویر و آزمون‌ها"];
const layouts = [
  { title: "خانه", subtitle: "اقدام بعدی امروز", rows: ["سلام و وضعیت امروز", "وعدهٔ بعدی + ثبت مصرف", "خلاصهٔ فشردهٔ کالری و ماکرو", "ثبت سریع آب و وزن", "پیشرفت هفتگی و راهنمای مربی"] },
  { title: "برنامه", subtitle: "اجرای وعده‌های تأییدشده", rows: ["نسخه و تأیید متخصص", "انتخاب روز در بالای صفحه", "وعده‌ها، مقدار و واحد", "جزئیات و دستورپخت", "جایگزین تأییدشده و خرید"] },
  { title: "مربی", subtitle: "گفتگوی مرتبط با برنامه", rows: ["هویت و وضعیت پاسخ", "تاریخچه و پیش‌نویس پایدار", "کارت‌های اقدام مرتبط", "ورودی پیام و عکس", "دسترسی مستقیم به سه تب"] },
];

export default function FlutterReview() {
  const theme = useHostTheme();
  const [section, setSection] = useCanvasState("flutter-review-section", "نتیجهٔ بررسی");
  const [priority, setPriority] = useCanvasState("flutter-review-priority", "همه");
  const [selectedShot, setSelectedShot] = useCanvasState("flutter-review-shot", "02-plan-fixture");
  const filtered = data.findings.filter(f => priority === "همه" || f.priority === priority);
  const shot = shots.find(s => s.name === selectedShot) ?? shots[0];
  const surface = { padding: 18, background: theme.fill.quaternary, borderRadius: 8 };

  return <main dir="rtl" lang="fa" style={{ maxWidth: 1160, padding: 24, margin: "0 auto", lineHeight: 1.9, color: theme.text.primary, background: theme.bg.editor }}>
    <Stack gap={20}>
      <header>
        <Text size="small" tone="secondary">۱۵ نوامبر ۲۰۲۶ · Flutter فعلی · commit 103ac3d · پیشنهاد تغییر، بدون تغییر کد محصول</Text>
        <H1>رژیم من؛ از قابلیت‌های موجود تا تجربهٔ یکپارچه</H1>
        <Text tone="secondary">نتیجهٔ مرور مسیرهای فعال، مدل‌های داده و پنج رندر واقعی ویجت‌ها با دادهٔ نمونه. پیشنهادها با نیازمندی محصول و تحلیل استاتیک فیبو تطبیق داده شده‌اند.</Text>
      </header>
      <nav aria-label="بخش‌های بررسی"><Row gap={6} wrap>{sections.map(s => <Button key={s} variant={section === s ? "primary" : "ghost"} onClick={() => setSection(s)}>{s}</Button>)}</Row></nav>
      <Divider />

      {section === "نتیجهٔ بررسی" && <Stack gap={20}>
        <Callout title="اولویت پیشنهادی">ابتدا مسیر دریافت برنامه و دقت داده؛ سپس پایداری و هماهنگی؛ بعد چیدمان و سه حرکت اختصاصی روی کیت موجود.</Callout>
        <H2>مسیر هدف اولین برنامه</H2>
        <ol style={{ margin: 0, paddingInlineStart: 24 }}>
          {["آنبوردینگ مشترک وب و اپ", "تولید واقعی پیش‌نویس AI", "پرداخت متصل به همان پیش‌نویس", "بررسی و اصلاح متخصص", "انتشار و باز شدن خانه / مربی / برنامه"].map(s => <li key={s} style={{ padding: "4px 0" }}>{s}</li>)}
        </ol>
        <Text tone="secondary">اکنون محیط اصلی بعد از آنبوردینگ باز می‌شود و خرید کیف پول، تولید AI را شروع می‌کند. هماهنگ کردن این ترتیب مهم‌ترین تغییر محصول است؛ این موضوع به‌تنهایی ادعای دسترسی به برنامهٔ تأییدنشده از API نیست.</Text>
        <H2>پایه‌هایی که حفظ می‌کنیم</H2>
        <ul style={{ margin: 0, paddingInlineStart: 22 }}>{data.existing.map(item => <li key={item}>{item}</li>)}</ul>
        <Grid columns="repeat(auto-fit, minmax(170px, 1fr))" gap={20}>
          {[["۳ اولویت P0", "مسیر و دادهٔ معتبر"], ["۵ اولویت P1", "هماهنگی و تجربهٔ استفاده"], ["۲ اولویت P2", "حرکت و ساختار قابل‌نگهداری"]].map(([value, label]) => <div key={value}><H2>{value}</H2><Text size="small" tone="secondary">{label}</Text></div>)}
        </Grid>
        <Text size="small" tone="secondary">منبع: ۱۰ پیشنهاد این بررسی؛ P0/P1/P2 اولویت اجرایی پیشنهادی‌اند و درجهٔ آسیب‌پذیری امنیتی نیستند.</Text>
      </Stack>}

      {section === "پیشنهادها" && <Stack gap={16}>
        <H2>تغییرها، شواهد و معیار پذیرش</H2>
        <Row gap={6} wrap>{["همه", "P0", "P1", "P2"].map(p => <Button key={p} variant={priority === p ? "primary" : "ghost"} onClick={() => setPriority(p)}>{p}</Button>)}</Row>
        {filtered.map(f => <details key={f.id} open={priority === "P0"} style={{ padding: "14px 0", borderBottom: `1px solid ${theme.stroke.tertiary}` }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}><span style={{ color: theme.accent.primary }}>{f.priority} · {f.id}</span> — {f.title}</summary>
          <Stack gap={10} style={{ padding: "12px 16px 2px" }}>
            <Text><strong>وضع فعلی: </strong>{f.current}</Text>
            <Text><strong>پیشنهاد: </strong>{f.proposal}</Text>
            <div style={surface}><Text><strong>معیار پذیرش: </strong>{f.acceptance}</Text></div>
            <Text size="small" tone="secondary">{f.note}</Text>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", direction: "ltr", fontSize: 11 }}>
              {f.evidence.map(e => <a key={e.file + e.line} style={{ color: theme.text.link, overflowWrap: "anywhere" }} href={`D:/ad/My-Diet/${e.file}${e.line ? ":" + e.line : ""}`}>{e.file}{e.line ? ":" + e.line : ""}</a>)}
            </div>
          </Stack>
        </details>)}
      </Stack>}

      {section === "طرح سه تب" && <Stack gap={20}>
        <H2>هر تب، یک مأموریت روشن</H2>
        <Text>در رندر فعلی، هدف و نمودار بخش زیادی از ابتدای تب برنامه را می‌گیرند. پیشنهاد این است که انتخاب روز و وعده‌ها زودتر دیده شوند و نمایش مفصل پیشرفت جمع‌شونده باشد.</Text>
        <Grid columns="repeat(auto-fit, minmax(230px, 1fr))" gap={20}>
          {layouts.map(layout => <section key={layout.title}>
            <H3>{layout.title}</H3><Text size="small" tone="secondary">{layout.subtitle}</Text>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>{layout.rows.map((row, index) => <li key={row} style={{ padding: "12px 10px", borderBottom: `1px solid ${theme.stroke.tertiary}`, background: index === 1 ? theme.fill.tertiary : theme.bg.editor }}><span style={{ color: theme.text.tertiary, paddingInlineEnd: 8 }}>{index + 1}</span>{row}</li>)}</ol>
          </section>)}
        </Grid>
        <H2>سه حرکت شاخص پیشنهادی</H2>
        <Table headers={["تعامل", "رخداد معتبر", "رفتار"]} rows={[
          ["ورودی قد و وزن", "انتخاب و تأیید مقدار", "خط‌کش/عدد دقیق با امکان ورود دستی و بازخورد کوتاه"],
          ["ثبت آب یا وعده", "ثبت موفق در منبع مشترک", "واکنش کوچک عدد/آب/تیک؛ بدون موفقیت ساختگی"],
          ["باز شدن برنامه", "انتشار واقعی پس از تأیید متخصص", "نمایش مرحله‌ای وعده‌ها، بدون القای تأیید زودهنگام"],
        ]} columnAlign={["right", "right", "right"]} />
        <Text tone="secondary">Motion، Ring، Ticker و کاهش حرکت از قبل وجود دارند. تصویرسازی و در صورت نیاز شخصیت اختصاصی، بر همین پایه آزمایش شوند. دارایی فیبو وارد محصول نشده است.</Text>
      </Stack>}

      {section === "ترتیب اجرا" && <Stack gap={20}>
        <H2>پیشنهاد ترتیب انجام</H2>
        {data.phases.map(phase => <section key={phase.title} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.stroke.tertiary}` }}><H3>{phase.title}</H3><Text size="small" tone="secondary">{phase.items.join(" · ")}</Text><Text>{phase.exit}</Text></section>)}
        <Callout title="قرارداد API قبل از مهاجرت">بک‌اند فعلی NestJS و انتخاب هدف Laravel است. DTOهای غذا، JourneyState، نسخهٔ برنامه، خطاها و idempotency ابتدا تثبیت شوند تا Flutter یک قرارداد روشن داشته باشد. این بررسی مهاجرتی انجام نداده است.</Callout>
        <H2>سناریوهای کلیدی پذیرش</H2>
        <ul style={{ margin: 0, paddingInlineStart: 22 }}>
          <li>وب را نیمه‌کاره رها کن و با همان هویت در اپ ادامه بده؛ پاسخ و مرحله حفظ شوند.</li>
          <li>تولید پیش‌نویس، پرداخت و تأیید متخصص به ترتیب واقعی اجرا شوند.</li>
          <li>دادهٔ غذا از پنل تا مقدار، عکس و دستورپخت اپ بدون حذف اطلاعات منتقل شود.</li>
          <li>ثبت در خانه با مربی و دستگاه دوم هماهنگ باشد؛ خطای شبکه برنامهٔ فعلی را خالی نکند.</li>
          <li>تعویض تب، پیام نیمه‌نوشته و روز انتخابی را از بین نبرد.</li>
        </ul>
      </Stack>}

      {section === "تصاویر و آزمون‌ها" && <Stack gap={20}>
        <H2>رندر فعلی Flutter با دادهٔ نمونه</H2>
        <Row gap={6} wrap>{shots.map(s => <Button key={s.name} variant={selectedShot === s.name ? "primary" : "ghost"} onClick={() => setSelectedShot(s.name)}>{s.label}</Button>)}</Row>
        <Grid columns="repeat(auto-fit, minmax(290px, 1fr))" gap={24} align="start">
          <figure style={{ margin: 0 }}><img src={shot.src} alt={`رندر فعلی ${shot.label} در Flutter با دادهٔ نمونه`} style={{ display: "block", width: "100%", maxWidth: 390, height: "auto", border: `1px solid ${theme.stroke.tertiary}` }} /><figcaption style={{ fontSize: 12, color: theme.text.secondary, marginTop: 10 }}>منبع: Flutter widget renderer، ۳۹۰×۸۴۴، ثبت ۲۰۲۶-۱۱-۱۵ با تاریخ دادهٔ ثابت ۲۰۲۶-۱۱-۰۹. تصویر حساب واقعی نیست.</figcaption></figure>
          <Stack gap={14}>
            <H3>بررسی‌های اجراشده</H3>
            <Table headers={["بررسی", "نتیجه"]} rows={[["flutter analyze --no-pub", "بدون ایراد"], ["۱۵ تست منتخب در ۵ فایل", "۱۴ موفق / ۱ ناموفق"], ["تکرار مستقل تست ناموفق", "همان شکست تکرار شد"], ["ثبت پنج رندر ویجت", "موفق؛ تصاویر مشاهده شدند"]]} columnAlign={["right", "right"]} />
            <Text>تست ثبت وعده بعد از لمس «انجام شد» منتظر ثبت فوری است؛ رابط فعلی پنجرهٔ تأیید باز می‌کند. این شکست، قدیمی بودن انتظار تست نسبت به UI فعلی را نشان می‌دهد و به‌تنهایی اثبات خرابی کل ثبت مصرف نیست.</Text>
            <Text size="small" tone="secondary">شاهد: app/test/features/tabs_test.dart:161؛ plan_meals.dart:28؛ consume_sheet.dart:90.</Text>
            <Text>ورود واقعی، درگاه، AI و تأیید متخصص در محیط عملیاتی تست نشده‌اند. سرعت و FPS روی گوشی هم اندازه‌گیری نشده است.</Text>
            <Text size="small" tone="secondary">دکمهٔ «نمایش برنامه» در تصویر انتظار فقط برای fixture بدون serverAuth است؛ آن را دسترسی زودهنگام تأییدشده در نسخهٔ واقعی نمی‌دانیم.</Text>
          </Stack>
        </Grid>
      </Stack>}

      <Divider />
      <Text size="small" tone="secondary">منابع: کد فعلی در D:/ad/My-Diet/app/، قراردادهای مرتبط backend/ و onboarding/، تحلیل فیبو ۲۰۲۶-۱۱-۱۴، و تصاویر محلی. گزارش نوشتاری: references/flutter-app-review/2026-11-15/REVIEW.fa.md.</Text>
    </Stack>
  </main>;
}
'''
canvas = template.replace("__DATA__", json.dumps(data, ensure_ascii=False)).replace("__SHOTS__", json.dumps(shots, ensure_ascii=False))
path = Path("C:/Users/pc/.cursor/projects/d-My-Diet/canvases/flutter-review-regime-man.canvas.tsx")
path.write_text(canvas, encoding="utf-8")
print("Wrote review report and single-file interactive canvas with five embedded fixture renders.")
