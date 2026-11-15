from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parent
photo = Path("D:/ad/My-Diet/app/assets/photo/food/persian_nourish_bowl_with_chicken_t.jpg")
photo_url = "data:image/jpeg;base64," + base64.b64encode(photo.read_bytes()).decode("ascii")

canvas = r'''import { Button, Callout, Divider, Grid, H1, H2, H3, Row, Stack, Table, Text, useEffect, useState, useHostTheme } from "cursor/canvas";
import type { CSSProperties } from "cursor/canvas";

const foodPhoto = "__PHOTO__";
const ideas = [
  {
    "title": "خانهٔ متناسب با امروز",
    "where": "خانه",
    "detail": "وعدهٔ بعدی و اقدام مناسب ساعت و وضعیت واقعی کاربر برجسته شود؛ پایان روز جمع‌بندی کوتاه دیده شود.",
    "motion": "محتوا با تغییر وضعیت، آرام جابه‌جا شود؛ حلقه‌ها خلاصه و کم‌حجم بمانند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "غذا، قهرمان رابط",
    "where": "غذا",
    "detail": "عکس دقیق غذا، مقدار و واحد خوانا، یک اقدام اصلی و جزئیات منظم داشته باشیم.",
    "motion": "عکس و عنوان از کارت تا جزئیات پیوستگی داشته باشند؛ برگشت، جای فهرست را حفظ کند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "آنبوردینگِ ساخت پروفایل",
    "where": "آنبوردینگ",
    "detail": "پاسخ هر بخش، خلاصهٔ قابل‌ویرایش هدف و سلیقه را کامل کند؛ وب و اپ از یک زبان طراحی پیروی کنند.",
    "motion": "خط‌کش‌ها و انتخاب‌گرها پاسخ فوری بدهند؛ حرکت بین مراحل کوتاه باشد و ورود دستی ممکن بماند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "شخصیت اختصاصی مربی",
    "where": "مربی",
    "detail": "یک همراه کوچک با فرم گیاهی برند و حالت آرام، پاسخ‌دادن و تشویق طراحی کنیم.",
    "motion": "واکنش به رخداد واقعی محدود باشد؛ اتود SVG فعلی شخصیت نهایی نیست.",
    "tier": "امضای برند و امکانات پیشرفته"
  },
  {
    "title": "ثبت روزانهٔ ملموس",
    "where": "ثبت",
    "detail": "ثبت آب و وعده با عدد روشن، تأیید قابل‌فهم و امکان برگرداندن همراه باشد.",
    "motion": "سطح آب، تیک وعده و خلاصهٔ روز پس از ذخیرهٔ موفق واکنش کوتاه نشان بدهند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "باغ یا تقویم عادت",
    "where": "پیشرفت",
    "detail": "پیشرفت را با عادت‌های واقعی نمایش بدهیم؛ روز ازدست‌رفته دعوتی برای ادامه باشد.",
    "motion": "رشد باغ و جشن فقط در نقاط عطف واقعی رخ بدهد؛ باغ قابلیت اختیاری باشد.",
    "tier": "امضای برند و امکانات پیشرفته"
  },
  {
    "title": "حالت آشپزی",
    "where": "دستورپخت",
    "detail": "مرحله‌های درشت، مواد لازم همان مرحله، مرور کل مواد و تایمر اختیاری در صورت وجود داده داشته باشیم.",
    "motion": "گذار مرحله کوتاه و قابل‌برگشت باشد؛ استفاده به کشیدن انگشت وابسته نباشد.",
    "tier": "امضای برند و امکانات پیشرفته"
  },
  {
    "title": "طراحی انتظار و خطا",
    "where": "وضعیت‌ها",
    "detail": "تولید پیش‌نویس، پرداخت، بررسی متخصص و انتشار برنامه وضعیت‌های مجزا داشته باشند؛ خطا اقدام بعدی روشن داشته باشد.",
    "motion": "بارگذاری متناسب با شکل محتوا باشد؛ زمان، درصد و موفقیت ساختگی نشان ندهیم.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "سیستم طراحی واحد",
    "where": "تمام اپ",
    "detail": "رنگ، فاصله، گوشه‌ها، دکمه‌ها، ورودی‌ها و اندازهٔ تصویر قواعد مشخص داشته باشند؛ رنگ سبز و کرم فعلی یکدست شود.",
    "motion": "اجزای هم‌نوع رفتار یکسان داشته باشند و همهٔ بخش‌ها در کارت یک‌شکل قرار نگیرند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "تایپوگرافی فارسی و اعداد",
    "where": "تمام اپ",
    "detail": "عنوان، متن، توضیح و عدد سلسله‌مراتب روشن داشته باشند؛ نمایش فارسی اعداد، واحدها و تاریخ یکدست شود.",
    "motion": "هنگام تغییر عدد، عرض کنترل نپرد و متن خوانا بماند؛ بزرگ‌کردن متن آزمایش شود.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "آیکن‌های هماهنگ",
    "where": "تمام اپ",
    "detail": "ضخامت خط، اندازهٔ بصری و حالت انتخاب‌شدهٔ آیکن‌ها هماهنگ باشد؛ مفهوم مبهم با برچسب همراه شود.",
    "motion": "تغییر حالت کوچک و دقیق باشد؛ آیکن بی‌دلیل نچرخد یا نجهد.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "تصویرسازی اختصاصی برند",
    "where": "معرفی و وضعیت‌ها",
    "detail": "خانواده‌ای کوچک از تصویرهای گیاهی، غذا و عادت بسازیم که با شخصیت مربی و لوگو هم‌زبان باشند.",
    "motion": "حرکت تصویرسازی محدود و قابل‌حذف باشد؛ تصویر غذا همچنان دقیق و مرتبط بماند.",
    "tier": "امضای برند و امکانات پیشرفته"
  },
  {
    "title": "ناوبری سه‌تب با حفظ زمینه",
    "where": "خانه، مربی، برنامه",
    "detail": "انتخاب تب روشن باشد؛ موقعیت اسکرول، روز انتخابی و متن نوشته‌شدهٔ چت حفظ شوند.",
    "motion": "نشانگر تب حرکت کوتاه داشته باشد؛ با هر بازگشت، ورود تمام محتوا تکرار نشود.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "پنل‌های پایین هماهنگ",
    "where": "انتخاب و ویرایش",
    "detail": "ثبت مقدار، انتخاب واحد و جایگزین غذا در پنل‌های خوانا با دکمهٔ تأیید در دسترس و هماهنگ با کیبورد انجام شود.",
    "motion": "پنل حرکت انگشت را دنبال کند، وضعیت نیمه‌کاره روشن باشد و تأیید تصادفی رخ ندهد.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "بازخورد لمس و اصلاح",
    "where": "تمام کنترل‌ها",
    "detail": "فشار دکمه، انتخاب گزینه، در حال ذخیره و ذخیره‌شده از هم قابل‌تشخیص باشند؛ تغییر قابل‌برگشت امکان اصلاح داشته باشد.",
    "motion": "فشار کوچک، تغییر رنگ یا تیک و در صورت پشتیبانی بازخورد لمسی اختیاری کافی است.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "زبان حرکت مشترک",
    "where": "تمام اپ و وب",
    "detail": "برای لمس، بازشدن محتوا، تغییر صفحه و نقطهٔ عطف، زمان و حس هماهنگ تعریف کنیم.",
    "motion": "حرکت کوتاه، قابل‌ادامه و هم‌جهت باشد؛ جشن بزرگ برای کار تکراری استفاده نشود.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "برنامهٔ هفتگی در دسترس",
    "where": "برنامه",
    "detail": "انتخاب امروز و روزهای هفته بالاتر و خواناتر باشد؛ وضعیت گذشته، امروز و آینده روشن بماند.",
    "motion": "انتخاب روز با گذار کوتاه همراه شود؛ هنگام بارگذاری یا خطا روز انتخابی تغییر نکند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "جایگزینی قابل‌مقایسهٔ غذا",
    "where": "برنامه",
    "detail": "غذای فعلی و گزینهٔ جدید با عکس، مقدار و اطلاعات موجود کنار هم قابل‌مقایسه باشند؛ تأیید مشخص داشته باشند.",
    "motion": "جایگزین انتخاب‌شده به جای همان کارت بنشیند؛ تغییر قبل از تأیید نهایی قابل‌فهم باشد.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "حالت‌های واضح وعده",
    "where": "برنامه و خانه",
    "detail": "ثبت‌نشده، ثبت‌شده و قابل‌ویرایش ظاهر و متن متفاوت داشته باشند؛ وضعیت فقط به رنگ وابسته نباشد.",
    "motion": "ثبت، خلاصه و خود کارت را هماهنگ به‌روز کند؛ undo نزدیک اقدام باشد.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "خلاصهٔ تغذیهٔ خوانا",
    "where": "خانه و برنامه",
    "detail": "نمودارهای کالری و درشت‌مغذی‌ها فشرده‌تر، با برچسب و عدد دقیق از دادهٔ معتبر باشند؛ جزئیات با لمس در دسترس باشد.",
    "motion": "حلقه‌ها از مقدار قبلی به مقدار جدید حرکت کنند؛ با هر ورود از صفر شروع نکنند.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "نمودار پیشرفت قابل‌لمس",
    "where": "پیشرفت",
    "detail": "بازهٔ زمانی، مقدار و تاریخ نقطهٔ انتخابی خوانا باشد؛ دادهٔ واقعی و پیش‌بینی ظاهر متفاوت داشته باشند.",
    "motion": "نشانگر لمس را دنبال کند؛ منحنی تزئینی یا انیمیشن، داده را تحریف نکند.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "فهرست خرید خوش‌ساخت",
    "where": "خرید",
    "detail": "مواد بر اساس دسته گروه‌بندی شوند؛ مقدار، تیک و ویرایش در دسترس باشد.",
    "motion": "تیک فوری باشد و جابه‌جایی قلم خریدشده تا وقتی کاربر مشغول لمس است مزاحم نشود.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "جست‌وجو و فیلتر غذا",
    "where": "کاتالوگ",
    "detail": "عکس کوچک یکدست، نام خوانا و فیلترهای قابل‌حذف داشته باشیم؛ نتیجهٔ خالی پیشنهاد اصلاح جست‌وجو بدهد.",
    "motion": "فیلتر فعال و نتیجهٔ جدید آرام تغییر کنند؛ صفحه با هر حرف دوباره وارد نشود.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "غذاهای محبوب",
    "where": "کاتالوگ و جایگزین‌ها",
    "detail": "غذاهای ذخیره‌شده با یک اقدام ساده دوباره در دسترس باشند؛ ذخیره‌کردن به‌معنای تأیید مصرف نباشد.",
    "motion": "نشان علاقه با واکنش کوتاه تغییر کند؛ پیام تأیید کوچک و قابل‌فهم باشد.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "گفتگوی مربی با سلسله‌مراتب",
    "where": "مربی",
    "detail": "پیام کاربر، پاسخ AI و پیام متخصص با نام و برچسب روشن از هم متمایز شوند؛ پیام بلند پاراگراف و کارت قابل‌خواندن داشته باشد.",
    "motion": "ورود پاسخ آرام باشد؛ کاربر هنگام خواندن پیام قبلی به پایین پرتاب نشود.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "اقدام‌های سریع و مرتبط مربی",
    "where": "مربی",
    "detail": "پیشنهادهایی مثل جایگزینی وعده و توضیح برنامه در زمان مناسب ظاهر شوند؛ کارت اقدام نتیجهٔ روشن داشته باشد.",
    "motion": "پیشنهادها بعد از تکمیل پاسخ ظاهر شوند و تایپ کاربر را نپوشانند.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "پیوست و ارسال شفاف",
    "where": "مربی",
    "detail": "پیش‌نمایش عکس، حذف قبل از ارسال، در حال ارسال، خطا و ارسال دوباره ظاهر مشخص داشته باشند.",
    "motion": "تغییر اندازهٔ کادر پیام نرم باشد؛ موفقیت قبل از تأیید واقعی نشان داده نشود.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "اعلان‌های داخل اپ",
    "where": "تمام اپ",
    "detail": "پیام کوتاه و متناسب با اهمیت استفاده شود؛ اعلان، دکمهٔ مهم یا نوشتهٔ کاربر را نپوشاند.",
    "motion": "ورود و خروج کوتاه، بدون تکرار مزاحم؛ پیام مهم تا اقدام کاربر قابل‌بازیابی باشد.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "معرفی اولین برنامه",
    "where": "ورود پس از تأیید",
    "detail": "پس از انتشار واقعی برنامه، یک معرفی کوتاه شامل نام متخصص، شروع برنامه و اولین وعده داشته باشیم.",
    "motion": "یک لحظهٔ خوشامد کوتاه و قابل‌ردکردن؛ نمایش کامل برنامه منتظر پایان جشن نماند.",
    "tier": "امضای برند و امکانات پیشرفته"
  },
  {
    "title": "اولین استفاده و حالت خالی",
    "where": "خانه، چت و گزارش",
    "detail": "برای اولین پیام، نبود ثبت و گزارش هنوز شکل‌نگرفته، توضیح کوتاه و یک اقدام مناسب طراحی شود.",
    "motion": "تصویرسازی کوچک اختیاری باشد؛ حالت خالی حس شکست ایجاد نکند.",
    "tier": "پایه و نسخهٔ بعد"
  },
  {
    "title": "حالت شب و تنظیم راحتی",
    "where": "تمام اپ",
    "detail": "حالت روشن و تیرهٔ خوانا، رنگ طبیعی عکس غذا، متن بزرگ و کنترل کاهش حرکت داشته باشیم.",
    "motion": "تغییر تم ملایم باشد؛ تنظیم دستگاه محترم بماند و حالت کم‌حرکت اطلاعات کامل بدهد.",
    "tier": "تکمیل تجربهٔ روزانه"
  },
  {
    "title": "کیفیت اجرا و دسترس‌پذیری",
    "where": "تمام اپ",
    "detail": "راست‌به‌چپ، برچسب صفحه‌خوان، کنتراست، محدودهٔ لمس و کیبورد را در کنار کیفیت بصری بررسی کنیم.",
    "motion": "روی گوشی هدف اندازه‌گیری شود؛ انیمیشن پنهان متوقف و تصویر متناسب با اندازهٔ نمایش آماده شود.",
    "tier": "پایه و نسخهٔ بعد"
  }
];
const stages = ["آماده‌سازی", "پیش‌نویس AI", "پرداخت تأییدشده", "تأیید متخصص", "برنامه منتشرشده"];
const labNames = ["کارت غذا", "آب و بازخورد", "حضور مربی", "تحویل برنامه"];

function Sprout({ mood, replay, reduced }: { mood: string; replay: number; reduced: boolean }) {
  const t = useHostTheme();
  return <svg key={mood + replay} viewBox="0 0 160 160" role="img" aria-label={`اتود همراه گیاهی؛ حالت ${mood}`} style={{ width: 146, height: 146, overflow: "visible" }}>
    <circle cx="80" cy="80" r="70" fill={t.fill.tertiary} />
    <g className={!reduced ? "rm-sprout" : undefined} style={{ transformOrigin: "80px 115px" }}>
      <path d="M80 119V77" stroke={t.category.green} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M78 83C46 83 37 58 40 42C65 41 83 59 78 83Z" fill={t.category.green} />
      <path d="M82 94C111 91 126 69 122 49C98 50 79 69 82 94Z" fill={t.category.green} />
      <path d="M53 58L72 77M108 65L87 88" stroke={t.bg.editor} strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
    <path d={mood === "تشویق" ? "M67 123Q80 136 93 123" : "M70 125Q80 130 90 125"} fill="none" stroke={t.text.primary} strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export default function UIMotionConcept() {
  const theme = useHostTheme();
  const [page, setPage] = useState("آزمایش تعامل");
  const [lab, setLab] = useState("کارت غذا");
  const [manualReduce, setManualReduce] = useState(false);
  const [osReduce, setOsReduce] = useState(false);
  const [slow, setSlow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [eaten, setEaten] = useState(false);
  const [glasses, setGlasses] = useState(3);
  const [replay, setReplay] = useState(0);
  const [mood, setMood] = useState("آرام");
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsReduce(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const reduce = manualReduce || osReduce;
  const duration = reduce ? "0ms" : slow ? "720ms" : "300ms";
  const phone = { maxWidth: 390, width: "100%", minHeight: 610, border: `1px solid ${theme.stroke.primary}`, borderRadius: 24, background: theme.bg.editor, overflow: "hidden", margin: "0 auto" };
  const primary: CSSProperties = { background: theme.category.green, color: theme.bg.editor, border: 0, borderRadius: 12, minHeight: 44, padding: "9px 16px", font: "inherit", cursor: "pointer" };
  const secondary: CSSProperties = { background: theme.fill.tertiary, color: theme.text.primary, border: 0, borderRadius: 10, minHeight: 44, padding: "8px 12px", font: "inherit", cursor: "pointer" };
  const vars = { "--rm-duration": duration, "--rm-color": theme.category.green, "--rm-focus": theme.stroke.focused, "--rm-surface": theme.fill.tertiary } as CSSProperties;
  const reset = () => { setExpanded(false); setEaten(false); setGlasses(3); setStage(0); setMood("آرام"); setReplay(v => v + 1); };

  return <main className={`regime-motion ${reduce ? "rm-reduced" : ""}`} dir="rtl" lang="fa" style={{ ...vars, maxWidth: 1140, padding: 24, margin: "0 auto", color: theme.text.primary, background: theme.bg.editor, lineHeight: 1.9 }}>
    <style>{`
      .regime-motion button:focus-visible,.regime-motion input:focus-visible { outline:3px solid var(--rm-focus); outline-offset:3px; }
      .regime-motion button:disabled { cursor:default; opacity:.5; }
      .regime-motion .rm-photo { transition:transform var(--rm-duration) cubic-bezier(.2,.8,.2,1); }
      .regime-motion .rm-enter { animation:rm-enter var(--rm-duration) cubic-bezier(.2,.8,.2,1) both; }
      .regime-motion .rm-sprout { animation:rm-grow var(--rm-duration) ease-out both; }
      .regime-motion .rm-ripple { animation:rm-ripple 600ms ease-out both; transform-origin:center; }
      .regime-motion .rm-tick { stroke-dasharray:30; stroke-dashoffset:0; animation:rm-tick var(--rm-duration) ease-out both; }
      .regime-motion .rm-level { transition:transform var(--rm-duration) cubic-bezier(.2,.8,.2,1); transform-origin:100px 235px; }
      @keyframes rm-enter { from { opacity:0; transform:translateY(8px); } to {opacity:1;transform:translateY(0);} }
      @keyframes rm-grow { 0% {transform:rotate(-5deg) scale(.95);} 60% {transform:rotate(2deg) scale(1.015);} 100% {transform:rotate(0) scale(1);} }
      @keyframes rm-ripple { from {opacity:.4;transform:scale(.7);} to {opacity:0;transform:scale(1.28);} }
      @keyframes rm-tick { from {stroke-dashoffset:30;} to {stroke-dashoffset:0;} }
      .regime-motion.rm-reduced .rm-photo,.regime-motion.rm-reduced .rm-level {transition:none!important;}
      .regime-motion.rm-reduced .rm-enter,.regime-motion.rm-reduced .rm-sprout,.regime-motion.rm-reduced .rm-ripple,.regime-motion.rm-reduced .rm-tick {animation:none!important;}
      @media(prefers-reduced-motion:reduce) { .regime-motion * {animation:none!important;transition:none!important;} }
    `}</style>
    <Stack gap={20}>
      <header><Text size="small" tone="secondary">اتود UI و حرکت · رژیم من · ۱۵ نوامبر ۲۰۲۶</Text><H1>یک تجربهٔ آرام، شخصی و غذا‌محور</H1><Text tone="secondary">جهت پیشنهادی بر پایهٔ رابط Flutter فعلی و شناخت فیبو. این صفحه نمونهٔ مفهومی است؛ داده‌ها نمایشی‌اند و هیچ غذا، آب یا پرداخت واقعی ثبت نمی‌شود.</Text></header>
      <nav aria-label="بخش‌های اتود"><Row gap={6} wrap>{["آزمایش تعامل", "جهت‌های طراحی", "زبان حرکت", "ترتیب پیشنهاد"].map(p => <Button key={p} variant={page === p ? "primary" : "ghost"} onClick={() => setPage(p)}>{p}</Button>)}</Row></nav>
      <Divider />

      {page === "آزمایش تعامل" && <Stack gap={18}>
        <Row gap={14} wrap>
          <label><input type="checkbox" checked={reduce} disabled={osReduce} onChange={(e: { currentTarget: HTMLInputElement }) => setManualReduce(e.currentTarget.checked)} /> کاهش حرکت{osReduce ? "؛ تنظیم دستگاه فعال است" : ""}</label>
          <label><input type="checkbox" checked={slow} disabled={reduce} onChange={(e: { currentTarget: HTMLInputElement }) => setSlow(e.currentTarget.checked)} /> پخش آهستهٔ گذارها</label>
          <Button variant="ghost" onClick={reset}>بازنشانی نمونه</Button>
        </Row>
        <Grid columns="repeat(auto-fit, minmax(310px, 1fr))" gap={28} align="start">
          <div>
            <Row gap={5} wrap>{labNames.map(name => <Button key={name} variant={lab === name ? "primary" : "ghost"} onClick={() => setLab(name)}>{name}</Button>)}</Row>
            <div style={{ ...phone, marginTop: 14 }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.stroke.tertiary}` }}><Text size="small" tone="secondary">رژیم من · پیش‌نمایش</Text><H3>{lab}</H3></div>

              {lab === "کارت غذا" && <div style={{ padding: 18 }}>
                <Text size="small" tone="secondary">وعدهٔ بعدی تو</Text>
                <div style={{ borderRadius: 18, overflow: "hidden", position: "relative", background: theme.fill.tertiary }}>
                  <img className="rm-photo" src={foodPhoto} alt="تصویر موجود در پروژه: کاسهٔ مرغ، غلات و سبزیجات" style={{ width: "100%", height: 230, objectFit: "cover", display: "block", transform: expanded ? "scale(1.07) translateY(-4px)" : "scale(1)" }} />
                  {eaten && <span key={replay} className="rm-enter" style={{ position: "absolute", insetInlineEnd: 12, top: 12, padding: "4px 12px", borderRadius: 8, background: theme.bg.editor, color: theme.text.primary }}>ثبت نمونه انجام شد</span>}
                </div>
                <div style={{ padding: "12px 0" }}><H3>کاسهٔ مرغ و سبزیجات</H3><Text size="small" tone="secondary">ناهار · مقدار و اطلاعات این اتود، نمایشی است</Text></div>
                <Row gap={8} wrap><button style={primary} onClick={() => {setEaten(v => !v);setReplay(v => v + 1);}}>{eaten ? "برگرداندن ثبت نمونه" : "طبق برنامه خوردم"}</button><button style={secondary} aria-expanded={expanded} aria-controls="rm-recipe" onClick={() => setExpanded(v => !v)}>{expanded ? "جمع‌کردن جزئیات" : "مواد و دستورپخت"}</button></Row>
                <section id="rm-recipe" hidden={!expanded} className="rm-enter" style={{ paddingTop: 16 }}><Text>مرغ گریل‌شده، غلات و سبزیجات تازه.</Text><Text size="small" tone="secondary">در محصول واقعی، مقدار، واحد و مراحل تأییدشدهٔ همین غذا اینجا قرار می‌گیرد. این نمونه فقط پیوستگی عکس و باز شدن محتوا را نشان می‌دهد.</Text></section>
                <div role="status" style={{ marginTop: 14, fontSize: 12, color: theme.text.secondary }}>{eaten ? "در نمونه، ثبت را می‌توانی برگردانی." : "ثبت وعده به یک اقدام واضح دسترسی دارد."}</div>
              </div>}

              {lab === "آب و بازخورد" && <div style={{ padding: 24, textAlign: "center" }}>
                <Text tone="secondary">تعامل نمایشی آب‌شمار</Text>
                <svg viewBox="0 0 200 250" role="img" aria-label={`نمونهٔ آب‌شمار: ${glasses} از ۸ لیوان`} style={{ display: "block", width: 185, height: 230, margin: "18px auto" }}>
                  <defs><clipPath id="rm-glass-clip"><path d="M42 35H158L145 214Q100 234 55 214Z" /></clipPath></defs>
                  <g clipPath="url(#rm-glass-clip)"><rect x="40" y="35" width="120" height="200" fill={theme.fill.tertiary}/><rect className="rm-level" x="40" y="35" width="120" height="200" fill={theme.category.green} style={{ transform: `scaleY(${glasses / 8})` }}/></g>
                  <path d="M42 35H158L145 214Q100 234 55 214Z" fill="none" stroke={theme.text.primary} strokeWidth="3" />
                  {replay > 0 && !reduce && <ellipse key={replay} className="rm-ripple" cx="100" cy="219" rx="68" ry="11" fill="none" stroke={theme.category.green} strokeWidth="2" />}
                </svg>
                <H2>{glasses} از ۸ لیوان</H2><Text size="small" tone="secondary">عدد و هدف صرفاً برای نمایش تعامل</Text>
                <Row gap={12} justify="center"><button style={secondary} disabled={glasses === 0} aria-label="یک لیوان از نمونه کم کن" onClick={() => {setGlasses(v => Math.max(0,v-1));setReplay(v => v + 1);}}>−</button><button style={primary} disabled={glasses === 8} onClick={() => {setGlasses(v => Math.min(8,v+1));setReplay(v => v + 1);}}>یک لیوان اضافه کن</button></Row>
                <p role="status" style={{ fontSize: 13, marginTop: 22 }}>{glasses === 8 ? "هدف نمونه کامل شد؛ واکنش کوتاه کافی است." : `مقدار نمونه: ${glasses} لیوان؛ همیشه قابل‌اصلاح.`}</p>
              </div>}

              {lab === "حضور مربی" && <div style={{ padding: 22 }}>
                <div style={{ textAlign: "center", padding: "12px 0" }}><Sprout mood={mood} replay={replay} reduced={reduce}/><H3>همراه کوچک رژیم من</H3><Text size="small" tone="secondary">اتود خطی شخصیت؛ طرح نهایی برند نیست</Text></div>
                <Row gap={6} justify="center" wrap>{["آرام", "در حال پاسخ", "تشویق"].map(m => <button key={m} aria-pressed={mood === m} style={{ ...secondary, borderBottom: mood === m ? `2px solid ${theme.category.green}` : "2px solid transparent" }} onClick={() => {setMood(m);setReplay(v => v + 1);}}>{m}</button>)}</Row>
                <div key={mood + replay} className="rm-enter" style={{ padding: 18, background: theme.fill.tertiary, borderRadius: 14, marginTop: 22 }} role="status"><Text>{mood === "تشویق" ? "ثبت امروزت انجام شد. قدم بعدی رو با هم ادامه می‌دیم." : mood === "در حال پاسخ" ? "در محصول، این حالت فقط هنگام انتظار پاسخ واقعی فعال می‌شود." : "می‌خوای برای وعدهٔ بعدی آماده بشیم؟"}</Text></div>
                <Text size="small" tone="secondary" style={{ marginTop: 18 }}>واکنش محدود به رویداد است. نام و نوع پاسخ‌دهنده، پیام و اقدام اصلی گفتگو باید روشن بمانند.</Text>
              </div>}

              {lab === "تحویل برنامه" && <div style={{ padding: 24 }}>
                <Text size="small" tone="secondary">هر فشار، یک رویداد فرضی را شبیه‌سازی می‌کند</Text>
                <H3>{stages[stage]}</H3>
                <ol style={{ margin: "18px 0", paddingInlineStart: 24 }}>{stages.slice(1).map((s,index) => <li key={s} style={{ padding: "9px 0", fontWeight: index < stage ? 600 : 400, color: index < stage ? theme.text.primary : theme.text.secondary }}>{index < stage ? "انجام‌شده · " : "در انتظار · "}{s}</li>)}</ol>
                <div key={stage + replay} className="rm-enter" style={{ minHeight: 92, padding: 14, borderRadius: 12, background: theme.fill.tertiary }} role="status"><Text>{stage === 4 ? "برنامه منتشر شد. اکنون می‌توان وعده‌ها را نمایش داد." : stage === 3 ? "متخصص تأیید کرده؛ انتشار برنامه مرحلهٔ بعد است." : stage === 2 ? "پرداخت تأیید شد؛ برنامه منتظر بررسی متخصص است." : stage === 1 ? "پیش‌نویس آماده است؛ هنوز پرداخت و بررسی متخصص باقی مانده." : "حالت آغاز نمونه؛ هیچ موفقیتی پیش از رخدادش نشان داده نمی‌شود."}</Text></div>
                <Row gap={8} wrap style={{ marginTop: 18 }}><button style={primary} disabled={stage === 4} onClick={() => {setStage(v => Math.min(4,v+1));setReplay(v => v+1);}}>رویداد بعدی نمونه</button><button style={secondary} onClick={() => setStage(0)}>از ابتدا</button></Row>
              </div>}
            </div>
          </div>

          <Stack gap={16}>
            <H2>{lab}</H2>
            <Text>{lab === "کارت غذا" ? "عکس و عنوان غذا نقطهٔ شروع باشند. همان محتوا هنگام باز شدن جزئیات هویت خود را حفظ کند؛ کاربر احساس جابه‌جایی به یک صفحهٔ نامرتبط نداشته باشد." : lab === "آب و بازخورد" ? "ثبت با یک اقدام واضح، عدد خوانا، واکنش کوتاه و امکان برگشت. در اپ نهایی، تأیید موفقیت به ذخیرهٔ واقعی متصل می‌شود." : lab === "حضور مربی" ? "شخصیت به برند جان می‌دهد؛ حضورش کوچک، قابل‌کنترل و هماهنگ با گفتگو باشد. این اتود SVG است و انیمیشن Rive نهایی محسوب نمی‌شود." : "ساخت AI، تأیید پرداخت، تأیید متخصص و انتشار چهار وضعیت متفاوت‌اند. حرکت باید این تفاوت را قابل‌فهم کند."}</Text>
            <H3>معیار طراحی</H3>
            <ul style={{ margin: 0, paddingInlineStart: 22 }}>
              <li>کاربر در حین حرکت امکان ادامه یا برگشت داشته باشد.</li>
              <li>معنا با متن و وضعیت هم منتقل شود؛ حرکت تنها نشانه نباشد.</li>
              <li>حرکتِ کوچک با لمس کوچک؛ صحنهٔ بزرگ برای نقطهٔ عطف واقعی.</li>
              <li>حالت کاهش حرکت و صفحه‌کلید در نمونه قابل‌آزمایش‌اند.</li>
            </ul>
            <Text size="small" tone="secondary">پالت این برد از تم میزبان می‌آید؛ رنگ و تایپوگرافی نهایی محصول باید با طراحی سبز/کرم رژیم من روی دستگاه بررسی شوند. این نمونه، کارایی Flutter یا حس لمس گوشی را اندازه‌گیری نمی‌کند.</Text>
          </Stack>
        </Grid>
      </Stack>}

      {page === "جهت‌های طراحی" && <Stack gap={20}>
        <H2>پیشرفت‌هایی فراتر از ظاهر فعلی</H2>
        {ideas.map((idea,index) => <section key={idea.title} style={{ borderBottom: `1px solid ${theme.stroke.tertiary}`, paddingBottom: 16 }}><Text size="small" tone="secondary">{index+1} · {idea.where} · {idea.tier}</Text><H3>{idea.title}</H3><Text>{idea.detail}</Text><Text tone="secondary">حرکت پیشنهادی: {idea.motion}</Text></section>)}
      </Stack>}

      {page === "زبان حرکت" && <Stack gap={20}>
        <H2>یک دستور زبان مشترک برای وب و اپ</H2>
        <Table headers={["نوع تعامل", "بازهٔ شروع پیشنهادی", "حس مطلوب"]} rows={[["فشردن و انتخاب", "۱۰۰ تا ۱۶۰ میلی‌ثانیه", "فوری و لمسی"],["تأیید کوتاه", "۱۶۰ تا ۲۴۰ میلی‌ثانیه", "دقیق و قابل‌فهم"],["باز شدن جزئیات/مرحله", "۲۴۰ تا ۳۶۰ میلی‌ثانیه", "پیوسته و قابل‌ردیابی"],["نقطهٔ عطف", "۶۰۰ تا ۹۰۰ میلی‌ثانیه، یک بار", "گرم و به‌یادماندنی"]]} columnAlign={["right","right","right"]}/>
        <Text size="small" tone="secondary">این اعداد پیشنهاد اولیهٔ طراحی برای رژیم من‌اند؛ استاندارد اجباری یا زمان استخراج‌شده از فیبو نیستند. پس از تست روی گوشی و وب تنظیم شوند.</Text>
        <H3>سه جنس حرکت</H3><ul style={{ margin: 0, paddingInlineStart: 22 }}><li>تغییر مکان و اندازه: easing نرم یا spring مهارشده، با پایان آرام.</li><li>رنگ، متن و وضعیت: fade کوتاه و پایدار؛ بدون جهش پی‌درپی.</li><li>تصویرسازی: یک صحنهٔ کوچک با شروع، پایان و توقف در پس‌زمینه.</li></ul>
        <H3>اجرای قابل‌سنجش</H3><Text>روی گوشی هدف در profile mode، با Flutter DevTools اندازه‌گیری شود. انیمیشن‌های مخفی متوقف شوند، تصاویر در اندازهٔ نمایش decode شوند و هزینهٔ opacity، clipping و saveLayer بررسی شود. نرم بودن در این اتود مرورگری، مدرک نرم بودن نسخهٔ Flutter نیست.</Text>
        <Text>حرکت هدفمند، کوتاه و اختیاری با راهنمای رسمی Apple هم‌راستاست؛ نکات کارایی بر مستندات Flutter تکیه دارند. مشخصات بصری و زمان‌های جدول، پیشنهاد خود این پروژه‌اند.</Text>
      </Stack>}

      {page === "ترتیب پیشنهاد" && <Stack gap={20}>
        <H2>برای نسخهٔ بعد، این چهار کار بیشترین ارزش طراحی را دارند</H2>
        <ol style={{ margin: 0, paddingInlineStart: 24 }}><li>خانهٔ غذا‌محور با وعدهٔ بعدی و خلاصهٔ فشردهٔ امروز.</li><li>کارت غذا و جزئیات پیوسته، با تصویر، مقدار و دستورپخت خوانا.</li><li>پرداخت ورودی‌های آنبوردینگ و بازخورد ثبت آب/وعده.</li><li>تکمیل ظاهر وضعیت‌های انتظار، خطا و برنامهٔ تأییدشده.</li></ol>
        <H3>مرحلهٔ ساخت امضای برند</H3><Text>شخصیت اختصاصی مربی، باغ پیشرفت عادت‌ها و معرفی برنامهٔ منتشرشده؛ با آزمایش یک نمونهٔ کوچک و سنجش خوانایی، راحتی و تکرارپذیری حرکت.</Text>
        <H3>پذیرش طراحی</H3><ul style={{ margin: 0, paddingInlineStart: 22 }}><li>اندازهٔ متن بزرگ و صفحهٔ کوچک، محتوا و کنترل‌ها را پنهان نکند.</li><li>تمام کنترل‌ها نام، فوکوس واضح و راه استفاده بدون gesture اجباری داشته باشند.</li><li>حرکت مانع انجام کار نباشد؛ حالت کاهش حرکت، همان اطلاعات را منتقل کند.</li><li>واحد، مقدار، وضعیت ثبت و نقش متخصص در نگاه اول قابل‌تشخیص باشند.</li></ul>
      </Stack>}

      <Divider />
      <footer><Text size="small" tone="secondary">مبنا: مرور Flutter و رندرهای ۱۵ نوامبر، تحلیل استاتیک فیبو و ایده‌های طراحی پیشنهادی. تصویر غذا از دارایی موجود پروژه است.</Text><Row gap={14} wrap><a href="https://developer.apple.com/design/human-interface-guidelines/motion" style={{ color: theme.text.link }}>راهنمای حرکت Apple</a><a href="https://docs.flutter.dev/perf/best-practices" style={{ color: theme.text.link }}>کارایی Flutter</a><a href="https://m3.material.io/styles/motion" style={{ color: theme.text.link }}>Material Motion</a></Row></footer>
    </Stack>
  </main>;
}
'''
target = Path("C:/Users/pc/.cursor/projects/d-My-Diet/canvases/regime-man-ui-motion.canvas.tsx")
target.write_text(canvas.replace("__PHOTO__", photo_url), encoding="utf-8")
print("Created single-file UI/motion concept with four interactive studies and one embedded project photo.")
