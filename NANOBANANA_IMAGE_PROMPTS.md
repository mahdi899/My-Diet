# 🌿 کتابچه راهنمای جامع تولید تصاویر هوش مصنوعی رژیم من (Nano Banana AI Prompt Library)
> **نسخه جامع:** مهندسی پرامپت حرفه‌ای برای تولید بیش از ۲۳۰ تصویر اختصاصی، واقع‌گرایانه (Photorealistic) و منسجم برای اپلیکیشن، دمو، وب‌سایت و دیتابیس غذایی ایرانی **«رژیم من»**.

---

## 📑 فهرست مطالب
1. [شناسنامه بصری و استایل‌گاید اختصاصی (Brand Visual Identity)](#1-شناسنامه-بصری-و-استایلگاید-اختصاصی)
2. [متدولوژی و فرمول مهندسی پرامپت در نانو بنانا (Nano Banana Formula)](#2-متدولوژی-و-فرمول-مهندسی-پرامپت-در-نانو-بنانا)
3. [راهنمای حفظ یکپارچگی تصویری (Visual Consistency & Style Locking)](#3-راهنمای-حفظ-یکپارچگی-تصویری)
4. [بخش اول: عکس‌های آنبوردینگ، پرسشنامه و دمو (Onboarding & Quiz)](#بخش-اول-عکسهای-آنبوردینگ-پرسشنامه-و-دمو)
   - ۴.۱ تصاویر بنر و ویژگی‌های اصلی هیرو (Feature Cards)
   - ۴.۲ تصاویر کارت‌های هدف رژیم (Goal Selection Cards)
   - ۴.۳ تصاویر پرتره متخصصین و مشاوران تغذیه (Doctor & Specialist Portraits)
   - ۴.۴ تصاویر دسته‌بندی سن، شغل و فعالیت بدنی (Demographics & Lifestyle)
   - ۴.۵ تصاویر انواع ورزش و فعالیت (Exercise & Sports)
   - ۴.۶ تصاویر سبک‌های رژیم غذایی (Dietary Patterns)
5. [بخش دوم: وب‌سایت، مقالات مجله و فضاهای داخلی اپلیکیشن (UI, States & Web)](#بخش-دوم-وبسایت-مقالات-مجله-و-فضاهای-داخلی-اپلیکیشن)
   - ۵.۱ هیرو و سکشن‌های لندینگ‌پیج وب‌سایت
   - ۵.۲ کاور مقالات مجله سلامتی (Health Magazine Articles)
   - ۵.۳ دسته‌بندی‌های لیست خرید هوشمند (Shopping Categories)
   - ۵.۴ وضعیت‌های خالی (Empty States)، مدال‌ها و نشان‌های انگیزه
6. [بخش سوم: کاتالوگ مستر غذاها و تغذیه کاملاً ایرانی (Iranian Food Master Catalog)](#بخش-سوم-کاتالوگ-مستر-غذاها-و-تغذیه-کاملا-ایرانی)
   - ۶.۱ صبحانه‌های مقوی و سنتی ایرانی (Breakfasts)
   - ۶.۲ چلوها، پلوها و خورش‌های اصیل ایرانی (Persian Rice & Stews)
   - ۶.۳ غذاهای نانی، کوکوها، دلمه‌ها و خوراک‌های سنتی (Traditional Dishes)
   - ۶.۴ آش‌ها، سوپ‌ها و کاسه‌های سلامت (Soups & Ash)
   - ۶.۵ سالادها، ماست‌ها و چاشنی‌های اصیل سفره ایرانی (Salads & Sides)
   - ۶.۶ میان‌وعده‌ها، تنقلات سالم و میوه‌های ایرانی (Healthy Snacks)
   - ۶.۷ نوشیدنی‌ها، شربت‌ها و دمنوش‌های شفابخش سنتی (Herbal Drinks)

---

## ۱. شناسنامه بصری و استایل‌گاید اختصاصی

برای اینکه تصاویر تولید شده با هوش مصنوعی نانو بنانا (Nano Banana / Gemini Imagen Architecture) حالت پلاستیکی، کارتونی یا استوک غیرواقعی نداشته باشند و دقیقاً حس یک **«برند سلامت و تغذیه معتبر، اصیل، مدرن و باهویت ایرانی»** را القا کنند، تمام پرامپت‌ها بر پایه این استایل‌گاید پایه‌ریزی شده‌اند:

### پالت رنگی هماهنگ با کد اپلیکیشن (App Color Harmony)
- **سبز کاجی (Pine Green - `#205638`):** رنگ اصلی، حس اعتماد، پزشکی، طبیعت و سلامت
- **سبز مریم‌گلی (Muted Sage - `#EAF1DC` / `#7C9C58`):** رنگ ملایم پس‌زمینه و المان‌های تعاملی
- **کرم استخوانی و عاجی (Warm Cream - `#F7F8F0`):** نور طبیعی صبحگاهی، کتان، پارچه‌های نخ‌رنگ طبیعی
- **رنگ‌های خاکی و اشتها‌آور:** کهربایی ملایم (`#AC7B24`)، سفال آجری، چوب بلوط روشن و قهوه‌ای گرم گردو
- **کنتراست زنده غذاهای ایرانی:** قرمز دانه انار و سماق، زرد درخشان زعفران قائنات، سبز تازه نعنا و ریحان

### اتمسفر و نورپردازی (Lighting & Atmosphere)
- **نور طبیعی روز (Natural Side-Window Sunlight):** ملایم، از کناره‌ها، ایجاد سایه‌های نرم و عمق‌دار طبیعی
- **حس لمس‌پذیر و خانگی (Tactile Home Feel):** دوری از استودیوهای هایپرلوکس غربی؛ نمایش خانه‌ها، آشپزخانه‌ها و میزهای واقعی ایرانی در فرمی مینیمال و تمیز
- **احترام و خنثی‌بودن بدنی (Body Neutrality):** عدم نمایش اندازه‌گیری متریک دور کمر، سرزنش چاقی، ترازو یا عضلات اغراق‌شده فتوشاپی؛ تمرکز روی حال خوب، سرزندگی، انرژی و سبک زندگی شاداب.

---

## ۲. متدولوژی و فرمول مهندسی پرامپت در نانو بنانا

مدل نانو بنانا برخلاف مدل‌های قدیمی (مثل Midjourney v4 یا Stable Diffusion اولیه) پردازش معنایی بسیار قوی دارد. یعنی به‌جای لیست کلمات کلیدی گنگ مثل `8k, hyperrealistic, trending on artstation`، نیازمند **توصیف روایی، تکنیکی و دقیق عکاسی** است.

### فرمول طلایی هر پرامپت (The 6-Part Master Blueprint):
```text
[1. Shot Type & Lens] + [2. Primary Subject & Plating] + [3. Tableware, Props & Surface] + [4. Lighting & Color Palette] + [5. Sensory Cues & Dynamic Textures] + [6. Technical Quality & Aspect Ratio]
```

1. **نوع شات و لنز:** مثلاً `Editorial food photography, 45-degree angle shot on 85mm prime lens, f/2.8 with shallow depth of field`
2. **سوژه و چیدمان غذا:** ترکیب دقیق، مواد اولیه تازه، میزان پختگی و تزئین
3. **ظروف و پس‌زمینه:** ظروف سرامیک مات دست‌ساز سفید، سفال فیروزه‌ای یا لاجوردی لالجین، قاشق چوبی، رانر کتان طبیعی، سنگ اسلیت یا میز چوب بلوط گرم
4. **نور و رنگ:** نور ملایم پنجره، سایه‌های نرم، پالت عاجی و سبز مریم‌گلی و تناژ گرم زعفرانی
5. **جلوه‌های حسی زنده:** بخار ملایم برمی‌خیزد، قطرات شبنم روی ریحان تازه، درخشش روغن زیتون بکر، برشتگی ته‌دیگ زعفرانی
6. **دستورات تکنیکی پایانی:** `photorealistic, natural film grain, authentic Iranian culinary details, true-to-life appetizing colors, no CGI look, no oversaturation, 4K resolution --ar [RATIO]`

---

## ۳. راهنمای حفظ یکپارچگی تصویری

برای اینکه ۲۰۰ تا ۳۰۰ عکس مختلف در اپلیکیشن مانند یک پروژه عکاسی یکپارچه و آلبوم اختصاصی به نظر برسند، از راهکارهای زیر استفاده کنید:

1. **انکر استایل ثابت (Anchor Style Block):** عبارت زیر در انتهای تمام پرامپت‌های غذایی به عنوان لنگر پایدار حفظ شده است:
   > `Warm ivory and sage green tones, soft natural morning window lighting, organic textures, shallow depth of field, high-end editorial food magazine aesthetic, authentic Persian domestic setting, photorealistic, 4K resolution.`
2. **استفاده از قابلیت Reference Image در نانو بنانا:** اولین عکس خروجی مورد تایید از یک بشقاب ناهار یا صبحانه را ذخیره کرده و در تولید تصاویر بعدی به عنوان `Style Reference` آپلود کنید.
3. **کنترل زاویه دوربین (Camera Angle Locking):**
   - برای کارت‌های غذا و لیست منو: زاویه **۴۵ درجه (45-degree angle)** برای عمق و اشتهاآوری
   - برای دسته‌بندی‌ها و نمای رژیم روزانه: نمای بالا **(Overhead flat lay / Top-down)**
   - برای پرتره پزشکان و کارت‌های هدف: نمای روبه‌رو پرتره مستند **(Eye-level portrait, 50mm or 85mm)**

---

## بخش اول: عکس‌های آنبوردینگ، پرسشنامه و دمو

این بخش شامل تمام تصاویری است که کاربر در اولین ورود به اپلیکیشن و وب‌سایت دمو مشاهده می‌کند (مطابق فایل‌های `demo/index.html` و `demo/questionnaire-data.js` و صفحات `app/lib/real/onboarding`).

---

### ۴.۱ تصاویر بنر و ویژگی‌های هیرو (Feature Cards - نسبت ۳:۲)

#### 001. نظارت متخصص تغذیه (intro-specialist.jpg)
- **محل استفاده:** کارت هیرو دمو، معرفی سرویس، صفحه درباره ما
- **نسبت تصویر:** 3:2 (Landscape)
- **پرامپت نانو بنانا:**
```text
Photorealistic natural editorial photography for an Iranian nutrition service feature card. Chest-up portrait of a thoughtful Iranian male clinical nutritionist around 40 years old with neatly trimmed dark beard, wearing a crisp modern white lab coat over a sage-green linen shirt. He is sitting at a minimalist light oak consultation desk in a bright contemporary Tehran clinic, warmly looking towards an off-camera client with an attentive, reassuring smile. In the background, soft morning window daylight illuminates a blurred Monstera plant and neatly arranged nutrition reference books on a light wooden shelf. Warm ivory and pine green color harmony, real skin texture, subtle documentary film grain, clean authentic lighting, no medical drama, no stethoscopes, no text, 4K resolution --ar 3:2
```

#### 002. رژیم هوشمند و هوش مصنوعی (intro-ai.jpg)
- **محل استفاده:** کارت ویژگی هوش مصنوعی در اینترو، صفحه ساخت برنامه
- **نسبت تصویر:** 3:2 (Landscape)
- **پرامپت نانو بنانا:**
```text
Candid editorial lifestyle photograph for an Iranian health application. A modern Iranian woman around 30 years old with a loosely draped cream headscarf and olive linen blouse, comfortably seated at her sunlit home dining table in Tehran. She is looking at her sleek laptop with a thoughtful, satisfied smile while reviewing her weekly meal schedule. On the light wooden table beside the laptop rests a small handmade ceramic bowl with fresh mint leaves and crisp cucumber slices, and a clear glass of infused lemon water. Warm natural side daylight streaming through sheer linen curtains, soft focus background of a cozy contemporary Iranian living room. High authenticity, no futuristic holographic clichés, genuine lifestyle documentary feel, 4K resolution --ar 3:2
```

#### 003. پشتیبانی همراه و پاسخگو (intro-support.jpg)
- **محل استفاده:** کارت پشتیبانی و پاسخگویی سریع، صفحه تماس با ما
- **نسبت تصویر:** 3:2 (Landscape)
- **پرامپت نانو بنانا:**
```text
Professional editorial workplace photograph for a client support feature. An Iranian female healthcare support consultant around 28 years old with a loosely styled sand-beige headscarf and muted sage blazer, wearing a modern slim professional headset with microphone. She is seated in a sunlit boutique office in Tehran, attentively listening and smiling with genuine warmth while typing a supportive diet update on a desktop keyboard. Background is softly blurred with warm wooden wall slats and potted indoor greenery. Natural soft lighting, authentic friendly demeanor, natural skin pores, high dynamic range, no stock-photo stiffness, no watermarks, 4K resolution --ar 3:2
```

#### 004. پلن‌های متنوع و سفره ایرانی (intro-plans.jpg)
- **محل استفاده:** کارت پلن‌های غذایی متنوع، معرفی پکیج‌های رژیم
- **نسبت تصویر:** 3:2 (Landscape)
- **پرامپت نانو بنانا:**
```text
Warm documentary lifestyle food photography for a personalized nutrition meal-plan feature. An Iranian man in his mid-30s with short styled dark hair wearing an oatmeal linen shirt, seated at a light oak kitchen table. He is thoughtfully planning his weekly meals with an open kraft-paper planner and pen. Beside his notebook sits an appetizing, perfectly balanced Iranian lunch: a ceramic plate with fragrant saffron-dusted rice, a tender grilled chicken breast kebab, fresh Persian herbs (sabzi khordan) with red radishes, and a slice of fresh lemon. Bright natural morning sunlight filtering across the table, peaceful homely atmosphere, true culinary textures, 4K resolution --ar 3:2
```

---

### ۴.۲ تصاویر کارت‌های هدف رژیم (Goal Selection Cards - نسبت ۲:۱ Diptych)

> **نکته استراتژیک طراحی:** این تصاویر به صورت دو پنل متصل (Diptych) در یک کادر عریض ۲:۱ طراحی شده‌اند که یک فرد واحد با جثه یکسان را در دو موقعیت روزمره سبک زندگی سالم نشان می‌دهد، بدون تحقیر بدنی و بدون خطای قبل/بعد فیک.

#### 005. هدف لاغری و کاهش وزن پایدار (goal-loss.jpg)
- **محل استفاده:** کارت انتخاب هدف لاغری در کوییز و لندینگ پیج
- **نسبت تصویر:** 2:1 (Wide Landscape Diptych)
- **پرامپت نانو بنانا:**
```text
Photorealistic wide 2:1 landscape diptych editorial photograph for an Iranian nutrition app goal-selection card. Two equal photographic panels separated only by a fine vertical line, both depicting the SAME Iranian plus-size woman in her early 30s with the SAME natural body proportions and respectful styling, wearing a softly draped beige headscarf and olive tunic. Left panel: in her warm sunlit Tehran kitchen, thoughtfully serving a wholesome balanced home-cooked Persian meal featuring steamed rice, grilled herb chicken, and a colorful tomato-cucumber salad. Right panel: the same woman enjoying a calm, invigorating walk down a lush tree-lined residential street in Tehran with a confident, peaceful expression. Authentic daylight, warm ivory and sage tones, body-neutral, no measuring tape, no scale, no shame, natural skin textures, 4K resolution --ar 2:1
```

#### 006. هدف افزایش وزن سالم و تثبیت (goal-gain.jpg)
- **محل استفاده:** کارت انتخاب هدف افزایش وزن در کوییز
- **نسبت تصویر:** 2:1 (Wide Landscape Diptych)
- **پرامپت نانو بنانا:**
```text
Photorealistic wide 2:1 landscape diptych editorial photograph for an Iranian nutrition app goal-selection card. Two equal photographic panels separated by a fine line, depicting the SAME naturally lean Iranian adult man around 30 years old with the SAME body frame, short dark hair, wearing an oatmeal textured overshirt. Left panel: seated at a wooden dining table reviewing a meal plan notebook next to a hearty lunch plate of Persian lentils, rice and roasted vegetables, relaxed and optimistic. Right panel: the same slim man in his bright modern kitchen preparing a nutrient-dense Iranian breakfast with fresh Sangak flatbread, sheep's milk cheese, walnuts, honey, and boiled eggs. Warm morning daylight, calm lifestyle atmosphere, respectful, no exaggerated gym gear, no body dysmorphia, 4K resolution --ar 2:1
```

#### 007. هدف بارداری و شیردهی ایمن (goal-maternal.jpg)
- **محل استفاده:** کارت انتخاب هدف بارداری و شیردهی
- **نسبت تصویر:** 2:1 (Wide Landscape Diptych)
- **پرامپت نانو بنانا:**
```text
Photorealistic wide 2:1 landscape diptych editorial photograph for an Iranian maternal nutrition card. Two equal panels depicting the SAME Iranian pregnant woman in her early 30s with the SAME healthy body, wearing an elegant loose sage-green maxi dress and cream cotton headscarf. Left panel: seated comfortably beside a sunny window at home, holding a glass of pure water and enjoying a snack bowl of raw almonds, dried figs, and fresh berries. Right panel: the same expectant mother at a friendly nutrition consultation with her supportive partner seated nearby, attentively conversing with a female nutritionist whose notebook rests on the desk. Loving, calm, trustworthy atmosphere, gentle natural lighting, medically supportive, no exposed belly, 4K resolution --ar 2:1
```

#### 008. هدف سلامت، پاکسازی و انرژی روزانه (goal-wellness.jpg)
- **محل استفاده:** کارت هدف دتوکس، بهبود گوارش و انرژی روزانه
- **نسبت تصویر:** 2:1 (Wide Landscape Diptych)
- **پرامپت نانو بنانا:**
```text
Photorealistic wide 2:1 landscape diptych editorial photograph for an Iranian wellness and vitality nutrition card. Two equal panels depicting the SAME Iranian woman in her 40s with a natural everyday build, loosely draped dark teal headscarf, and light linen top. Left panel: relaxing in an armchair next to sunlit balcony plants, sipping a warm herbal tea infusion with mint and lemon, looking refreshed and clear-minded. Right panel: preparing a vibrant, digestion-friendly Persian salad in a bright kitchen with fresh parsley, mint, diced cucumbers, tomatoes, and pomegranate seeds. Warm natural sunlight, organic textures, balanced living, no detox gimmick products, authentic documentary quality, 4K resolution --ar 2:1
```

---

### ۴.۳ تصاویر پرتره متخصصین و پزشکان منتخب (Doctor Portraits - نسبت ۴:۵)

#### 009. دکتر سارا محمدی - متخصص تغذیه و کاهش وزن (doctor-demo-female.jpg)
- **محل استفاده:** کارت تطبیق متخصص، لیست پزشکان، مشاوره آنلاین
- **نسبت تصویر:** 4:5 (Vertical Portrait)
- **پرامپت نانو بنانا:**
```text
Photorealistic natural editorial portrait of a professional Iranian female clinical nutritionist around 38 years old. She has kind, intelligent brown eyes, warm engaging smile, and wears a neatly draped sand-beige linen scarf and a modern tailored white medical coat over a sage-green blouse. Chest-up portrait, perfectly centered composition, generous headroom. Clean background featuring a softly blurred, bright nutrition clinic interior in Tehran with a small indoor succulent and wooden bookshelves. Gentle diffused morning daylight from the side, natural skin pores without airbrushing, confident, approachable and highly credible medical demeanor, 4K resolution --ar 4:5
```

#### 010. دکتر امیر حسینی - متخصص متابولیسم و رژیم درمانی (doctor-demo-male.jpg)
- **محل استفاده:** کارت تطبیق پزشک، پروفایل متخصصین
- **نسبت تصویر:** 4:5 (Vertical Portrait)
- **پرامپت نانو بنانا:**
```text
Photorealistic natural editorial portrait of an Iranian male nutritionist and diet therapist around 42 years old. He has short dark hair with subtle grey temples, a neatly trimmed beard, friendly reassuring eyes, wearing a crisp white clinical coat over a light sage button-down shirt. Eye-level portrait, centered, comfortable crop. Background is a softly out-of-focus modern medical consultation room with warm ivory tones and subtle indoor greenery. Soft natural side-window lighting, authentic skin texture and realistic depth of field, professional, warm and scientifically trustworthy, 4K resolution --ar 4:5
```

#### 011. دکتر مریم نوری - فوق تخصص تغذیه بارداری و اطفال
- **محل استفاده:** پزشک پیشنهادی برای پلن‌های بارداری و مادران
- **نسبت تصویر:** 4:5 (Vertical Portrait)
- **پرامپت نانو بنانا:**
```text
Natural photographic portrait of an Iranian female clinical dietitian specializing in maternal health, around 45 years old. Warm, empathetic facial expression, modest cream hijab, light khaki jacket over a white medical tunic. Background is a brightly lit, modern clinical office with soft wood accents and soft sage wall paint. Natural daylight from a large window, soft shadows, genuine documentary look, highly professional, 4K resolution --ar 4:5
```

#### 012. دکتر رضا احمدی - مشاور تغذیه ورزشی و هایپرتروفی
- **محل استفاده:** متخصص پلن‌های افزایش وزن و ورزشکاران
- **نسبت تصویر:** 4:5 (Vertical Portrait)
- **پرامپت نانو بنانا:**
```text
Editorial portrait of an Iranian male sports nutritionist around 35 years old. Fit, healthy posture, friendly confident smile, short black hair and clean-cut stubble, wearing an olive-green polo shirt and a light white consultation coat. Modern clinical wellness office background with warm daylight, natural depth of field, sharp focus on facial features, authentic skin tones, 4K resolution --ar 4:5
```

---

### ۴.۴ تصاویر بازه‌های سنی و سبک‌های زندگی (Demographics & Quiz Options - نسبت ۱:۱)

#### 013. بازه سنی ۱۸ تا ۳۰ سال (age-18-30.jpg)
- **پرامپت نانو بنانا:**
```text
Candid documentary lifestyle portrait of a young Iranian university student in her early 20s, wearing a relaxed forest green hoodie and casual light grey scarf. She is sitting in a sunlit university courtyard in Tehran, happily eating a crisp red apple while holding a notebook. Natural candid smile, vibrant morning daylight, soft blurred campus greenery in background, authentic skin texture, relatable youth lifestyle, square framing, 4K resolution --ar 1:1
```

#### 014. بازه سنی ۳۰ تا ۴۰ سال (age-30-40.jpg)
- **پرامپت نانو بنانا:**
```text
Lifestyle portrait of an Iranian professional man in his mid-30s wearing a modern casual linen blazer over an ivory t-shirt. He is standing in a bright contemporary kitchen holding a reusable glass water bottle, looking forward with a relaxed, confident smile. Soft window lighting, modern Iranian apartment background, genuine everyday look, square composition, 4K resolution --ar 1:1
```

#### 015. بازه سنی ۴۰ تا ۵۰ سال (age-40-50.jpg)
- **پرامپت نانو بنانا:**
```text
Warm lifestyle portrait of an Iranian woman around 45 years old with graceful laugh lines and a friendly demeanor, wearing a navy-blue casual scarf and beige knit cardigan. She is standing on her sun-drenched apartment terrace holding a cup of herbal tea, surrounded by potted geraniums. Natural morning sunlight, calm vitality, square framing, 4K resolution --ar 1:1
```

#### 016. بازه سنی بالای ۵۰ سال (age-50-plus.jpg)
- **پرامپت نانو بنانا:**
```text
Authentic lifestyle portrait of a healthy, active Iranian gentleman in his late 50s with neatly groomed silver hair and gentle smile, wearing a warm olive wool sweater. He is in a sunlit home library holding a freshly peeled sweet orange, reflecting vitality and healthy longevity. Soft ambient light, warm domestic feel, square composition, 4K resolution --ar 1:1
```

---

### ۴.۵ سبک‌های رژیم غذایی (Dietary Patterns - نسبت ۱:۱)

#### 017. همه‌چیزخواری و سفره کامل (diet-normal.jpg)
- **پرامپت نانو بنانا:**
```text
Overhead 45-degree angle food photography of a healthy, comprehensive balanced meal plate. Tender roasted saffron chicken breast strips alongside steamed fragrant basmati rice with sumac, grilled green zucchini slices, steamed broccoli florets, and a wedge of juicy fresh lemon. Arranged on a minimalist matte ceramic plate resting on a light oak wood surface with a small side cup of homemade probiotic yogurt. Crisp natural daylight, rich colors, authentic home cooking, square framing, 4K resolution --ar 1:1
```

#### 018. گیاه‌خواری با تخم‌مرغ و لبنیات (diet-vegetarian.jpg)
- **پرامپت نانو بنانا:**
```text
Artisan food photography of a vibrant lacto-ovo vegetarian Persian dish. A wholesome bowl of traditional Persian Kuku Sabzi (aromatic herb frittata with barberries and chopped walnuts) paired with crumbled white Lighvan cheese, heirloom cherry tomatoes, Persian wild mint, and slices of whole-grain Sangak bread. Plated on handmade stoneware pottery, bright morning window light, fresh culinary textures, square framing, 4K resolution --ar 1:1
```

#### 019. رژیم کاملاً گیاهی و وگان (diet-vegan.jpg)
- **پرامپت نانو بنانا:**
```text
Top-tier lifestyle food photography of a 100% plant-based nutritious Iranian dish. A hearty bowl of slow-cooked Persian lentil soup (Adasi) topped with cold-pressed olive oil, roasted pumpkin seeds, fresh coriander, and a pinch of ground angelica (golpar). Served alongside crisp cucumber ribbons, radishes, and toasted flatbread. Earthy natural colors, warm sunlight, clean minimal aesthetic, square composition, 4K resolution --ar 1:1
```

---

### ۴.۶ سطوح فعالیت روزانه و انواع ورزش‌ها (Activity & Sports - نسبت ۱:۱)

#### 020. فعالیت نشسته و پشت‌میزنشینی (activity-sedentary.jpg)
- **پرامپت نانو بنانا:**
```text
Modern documentary photograph of an Iranian tech worker seated comfortably at an ergonomic standing desk in a bright Tehran co-working space. A glass bottle of water with mint leaves and a small bowl of raw almonds sit on the wooden desk next to a modern keyboard. Soft ambient daylight, relatable daily routine, square format, 4K resolution --ar 1:1
```

#### 021. فعالیت روزمره ترکیبی (activity-mixed.jpg)
- **پرامپت نانو بنانا:**
```text
Candid photograph of an active Iranian woman in comfortable everyday smart-casual attire walking purposefully through an airy architectural atrium with stairs, holding a reusable canvas tote with fresh farmers market greens. Natural dynamic motion, bright diffused sunlight, positive active routine, square crop, 4K resolution --ar 1:1
```

#### 022. فعالیت بدنی سرپا و پیوسته (activity-standing.jpg)
- **پرامپت نانو بنانا:**
```text
Warm lifestyle photograph of an Iranian woman working standing up in a contemporary art/design studio, actively moving around a large wooden table with fabric swatches and color palettes, looking engaged and full of stamina. Natural side lighting, authentic craft environment, square format, 4K resolution --ar 1:1
```

#### 023. کار فیزیکی سنگین و پرتحرک (activity-heavy.jpg)
- **پرامپت نانو بنانا:**
```text
Documentary portrait of a fit Iranian professional landscape architect in outdoor utility workwear, taking a purposeful pause on a sunny green park project in Tehran, holding a stainless steel water thermos with a healthy, energized expression. Bright natural daylight, authentic physical engagement, square format, 4K resolution --ar 1:1
```

#### 024. ورزش قدرتی و عضله‌سازی (sport-strength.jpg)
- **پرامپت نانو بنانا:**
```text
Clean, modern fitness lifestyle photograph. A pair of stylish neoprene dumbbells and a set of resistance bands neatly placed on a cork exercise mat in a sunlit Iranian apartment corner. A stainless steel shaker bottle and a fresh folded towel beside them. Soft morning light, healthy habit vibe, no intimidating bodybuilding aggression, square framing, 4K resolution --ar 1:1
```

#### 025. ورزش هوازی و استقامتی (sport-cardio.jpg)
- **پرامپت نانو بنانا:**
```text
Inspiring outdoor lifestyle photo of modern running shoes and a sports smartwatch showing completed morning steps, resting on a clean wooden park bench with morning autumn leaves along a Tehran mountain trail (Tochal or Darband). Golden sunrise lighting, invigorating cardio mood, square format, 4K resolution --ar 1:1
```

#### 026. تمرینات ترکیبی و یوگا / پیلاتس (sport-combined.jpg)
- **پرامپت نانو بنانا:**
```text
Calm lifestyle wellness photograph. A rolled sage-green yoga mat resting next to a small wooden block, a glass of water with sliced lime, and a single stem of eucalyptus in a ceramic vase in a sunlit Tehran living room. Serene, balanced exercise environment, square framing, 4K resolution --ar 1:1
```

#### 027. سایر ورزش‌ها و تفریحات حرکتی (sport-other.jpg)
- **پرامپت نانو بنانا:**
```text
Vibrant lifestyle photograph showing a recreational sports setup: a pair of badminton rackets and shuttlecocks resting beside a bicycle parked in a leafy Tehran public park under golden dappled afternoon sun. Casual joyful active lifestyle, square format, 4K resolution --ar 1:1
```

---

### ۴.۷ تصاویر آنالیز هوش مصنوعی و پرسشنامه (AI Processing & Quiz Hero)

#### 028. بنر اصلی بالای پرسشنامه (quiz-hero-diet.jpg / hero.jpg)
- **محل استفاده:** سربرگ اصلی صفحه سوالات و دمو
- **نسبت تصویر:** 16:9 یا 2:1
- **پرامپت نانو بنانا:**
```text
Commercial culinary hero banner for an Iranian smart nutrition app. A sweeping, impeccably styled overhead shot of a fresh Iranian dietary banquet: a large centerpiece white ceramic bowl with crisp romaine lettuce, Persian baby cucumbers, ruby-red pomegranate seeds, fresh mint, and chopped walnuts, surrounded by small earthenware ramekins with extra-virgin olive oil, dried wild sumac, dried mint, and thin crisp slices of whole-wheat Sangak bread. Bright, clean morning window daylight casting soft natural shadows across a light sand-beige travertine stone surface. Pine green and warm ivory color tones, fresh, hydrating, invigorating, ultra-detailed textures, 4K resolution --ar 16:9
```

#### 029. تصویر پس‌زمینه کارت آنالیز هوش مصنوعی (analysis-orbit-background.jpg)
- **محل استفاده:** صفحه در حال پردازش رژیم غذایی توسط هوش مصنوعی
- **نسبت تصویر:** 1:1 یا 4:3
- **پرامپت نانو بنانا:**
```text
Abstract minimalist wellness background with organic culinary elements. Soft focus view of floating fresh green mint leaves, golden olive oil droplets suspended in pristine water, and faint geometric circular rings of light reminiscent of a modern compass. Deep pine green (#205638) gradient melting into sage green (#EAF1DC) and soft white. Serene, clinical precision combined with biological vitality, no dark sci-fi tropes, smooth glowing gradients, 4K resolution --ar 1:1
```

---

## بخش دوم: وب‌سایت، مقالات مجله و فضاهای داخلی اپلیکیشن

این بخش پوشش‌دهنده تصاویر مورد نیاز لندینگ‌پیج وب‌سایت (`site/index.html`، `about.html`، `pricing.html`)، کاور مقالات مجله سلامتی رژیم من، و تمام تصاویر رابط کاربری اپلیکیشن فلاتر (وضعیت‌های خالی، تبریک‌ها، دسته‌بندی‌های خرید و کیف پول) است.

---

### ۵.۱ تصاویر اصلی لندینگ‌پیج وب‌سایت (Website Landing Assets)

#### 030. سالاد تازه و رنگارنگ هیرو سایت (site/assets/salad.jpg)
- **محل استفاده:** تصویر هیرو بخش معرفی بالای وب‌سایت
- **نسبت تصویر:** 4:3 یا 16:9
- **پرامپت نانو بنانا:**
```text
Commercial editorial culinary photography of a gourmet Persian health salad. A wide shallow matte ivory ceramic bowl overflowing with crisp baby spinach, Persian cucumber ribbons, sun-ripened ruby-red heirloom tomatoes, creamy chunks of ripe avocado, toasted Persian walnuts, and bright red pomegranate seeds. Lightly dressed with extra-virgin olive oil and aged verjuice (ab-ghooreh), garnished with delicate purple basil and mint flowers. The bowl rests on a rustic light grey travertine kitchen counter with a folded linen napkin and vintage wooden salad servers. Soft morning window lighting entering from top-left, glistening moisture on the leaves, rich appetizing colors, authentic Iranian culinary aesthetics, 4K resolution --ar 4:3
```

#### 031. صبحانه سالم و پرانرژی (site/assets/breakfast.jpg)
- **محل استفاده:** کارت نمونه وعده صبحانه در شبیه‌ساز موبایل سایت
- **نسبت تصویر:** 1:1 یا 4:3
- **پرامپت نانو بنانا:**
```text
Bright morning editorial food photograph of a complete healthy Iranian breakfast. A crisp golden-toasted slice of traditional Sangak bread spread with creamy low-fat sheep's milk cheese, sliced ripe Persian figs, fresh mint leaves, and a sprinkle of raw crushed walnuts with nigella seeds. Accompanied by a glass of freshly squeezed orange juice catching the early sun and a small glass cup of light Persian black tea. Clean white linen tablecloth on a warm oak surface, uplifting dawn daylight, crisp textures, delicious and wholesome, square crop, 4K resolution --ar 1:1
```

#### 032. سبزیجات و مواد اولیه تازه بازار (site/assets/vegetables.jpg)
- **محل استفاده:** بنر میانی وب‌سایت، کارت‌های ویژگی تغذیه طبیعی
- **نسبت تصویر:** 16:9
- **پرامپت نانو بنانا:**
```text
Artisan flat lay photography of fresh Iranian market ingredients arranged in organic harmony. Plump Persian purple eggplants, crisp bunches of aromatic tarragon, mint and cilantro with visible water droplets, bright red bell peppers, young green zucchini with blossoms, garlic bulbs, and juicy fresh limes. Displayed on a rustic butcher block wooden table with a handwoven Persian kilim runner partially visible at the edge. Soft diffused window lighting, vivid natural produce colors, earthy, farm-to-table authenticity, 4K resolution --ar 16:9
```

#### 033. کاسه سلامت غلات و پروتئین ایرانی (site/assets/bowl.jpg)
- **محل استفاده:** تصاویر بخش امکانات برنامه، فواید تغذیه هوشمند
- **نسبت تصویر:** 1:1
- **پرامپت نانو بنانا:**
```text
Editorial food photography of a modern Persian nourish bowl. Fluffy steamed Persian brown lentils and quinoa base, topped neatly with marinated saffron-grilled chicken strips, roasted spiced chickpeas, pickled red onions (torshi-ye piaz), Persian herb salad (sabzi khordan), and a dollop of thick strained labneh with sumac. Served in a handcrafted speckled ceramic bowl, photographed at a 45-degree angle under soft directional window light. High gastronomic appeal, balanced macros, authentic culinary appeal, 4K resolution --ar 1:1
```

---

### ۵.۲ کاور مقالات مجله رژیم من (Health Journal Article Covers - نسبت ۱۶:۹)

#### 034. اهمیت آبرسانی و نقش آب در کاهش وزن پایدار
- **موضوع مقاله:** آبرسانی، سم‌زدایی و تنظیم سوخت‌وساز
- **پرامپت نانو بنانا:**
```text
Minimalist lifestyle photography for a health article about optimal daily hydration. A sleek, condensation-covered clear glass carafe and a matching tumbler filled with pure ice water, infused with fresh Persian cucumber rounds, sprigs of wild mint, and a thin slice of lime. Resting on a light sun-drenched marble windowsill in Tehran with leafy balcony plants in the soft-focus background. Crystal clear reflections, sparkling water droplets, revitalizing morning light, refreshing and pure, 4K resolution --ar 16:9
```

#### 035. مدیریت کربوهیدرات و ته‌دیگ در سفره ایرانی
- **موضوع مقاله:** چطور بدون حذف برنج و نان سنگک لاغر شویم؟
- **پرامپت نانو بنانا:**
```text
Appetizing culinary close-up shot of a golden-brown crispy saffron potato Tahdig (Persian crunchy rice crust), carefully broken to show steam rising and fluffy separate grains of white basmati rice underneath. Plated on a modern celadon-green ceramic platter next to a small bowl of wild sumac. Warm amber side lighting highlighting the crunchy texture, mouthwatering authentic Iranian dining aesthetic, no greasiness, elegant food styling, 4K resolution --ar 16:9
```

#### 036. کنترل ولع قند و شیرینی در ساعات بعدازظهر
- **موضوع مقاله:** جایگزین‌های سالم قند در رژیم روزانه
- **پرامپت نانو بنانا:**
```text
Warm lifestyle food still-life for a nutrition article about healthy sweet alternatives. A beautiful shallow wooden bowl filled with soft Iranian Medjool dates stuffed with raw walnut halves, alongside dried golden white mulberries (toot khoshk), raw pistachio kernels, and a pot of soothing cardamom chamomile tea in a clear glass teapot. Soft warm afternoon sunlight, peaceful and comforting composition, healthy mindful eating aesthetic, 4K resolution --ar 16:9
```

#### 037. نقش پروتئین صبحگاهی در ثبات انرژی روزانه
- **موضوع مقاله:** بهترین ترکیب‌های پروتئینی برای صبحانه
- **پرامپت نانو بنانا:**
```text
Editorial food photography of high-protein Iranian breakfast components. A rustic cast-iron skillet with two sunny-side-up organic eggs with bright orange yolks cooked in cold-pressed olive oil, sprinkled with black cumin seeds, resting beside a plate of sliced boiled eggs, crumbled goat feta cheese, and a pile of freshly washed watercress and radishes. Morning sun rays, rustic modern breakfast table, 4K resolution --ar 16:9
```

#### 038. ارتباط خواب باکیفیت و هورمون‌های گرسنگی (گرلین و لپتین)
- **موضوع مقاله:** خواب کافی و تاثیر آن بر کاهش اشتها
- **پرامپت نانو بنانا:**
```text
Serene lifestyle photography for a sleep and metabolism health article. A cozy minimalist nightstand with an open hardcover book, a steaming ceramic mug of soothing Persian borage (Gol-Gavzaban) tea with dried lime, and a subtle glowing bedside lamp with warm 2700K light. Deep calming nocturnal tones, peaceful bedtime ritual, cozy and restorative atmosphere, 4K resolution --ar 16:9
```

#### 039. راهنمای خرید هوشمندانه از میدان میوه و تره‌بار
- **موضوع مقاله:** انتخاب فیبرهای باکیفیت و سبزیجات تازه فصلی
- **پرامپت نانو بنانا:**
```text
Atmospheric documentary photography of a vibrant, orderly Persian neighborhood produce stall in Tehran. Woven wicker baskets filled with fresh Persian cucumbers, fragrant bunches of mint, scallions, radishes, purple eggplants, and sweet melons. Soft natural ambient market light, rich organic textures, colorful, bountiful and trustworthy, 4K resolution --ar 16:9
```

#### 040. رژیم در مهمانی‌ها و دورهمی‌های خانوادگی ایرانی
- **موضوع مقاله:** حفظ تعادل و کالری در مهمانی‌های پرغذا
- **پرامپت نانو بنانا:**
```text
Warm documentary lifestyle scene of an Iranian family dining table (Sofreh). Elegant modern tableware set with saffron chicken, vibrant Shirazi salad, and fresh herbs, with natural hands reaching to serve mindful, moderate portions onto a plate. Soft warm ceiling chandelier light, joyful authentic family gathering, respectful social eating, 4K resolution --ar 16:9
```

#### 041. تغذیه و سلامت مادر در سه ماهه اول بارداری
- **موضوع مقاله:** رفع حالت تهوع و تامین ریزمغذی‌ها
- **پرامپت نانو بنانا:**
```text
Gentle morning lifestyle photography for a pregnancy nutrition feature. A sunlit breakfast tray on crisp white bed linens holding a bowl of warm oatmeal porridge topped with sliced bananas and crushed walnuts, a cup of mild ginger tea, and a small dish of dried apricots. Soft luminous daylight, comforting, nurturing, safe maternal healthcare atmosphere, 4K resolution --ar 16:9
```

#### 042. کبد چرب و رژیم پاکسازی با گیاهان دارویی ایرانی
- **موضوع مقاله:** بهبود آنزیم‌های کبد با اصلاح رژیم غذایی
- **پرامپت نانو بنانا:**
```text
Still-life culinary photography focusing on liver-supportive Persian herbs. Fresh artichoke, sliced bitter chicory, fresh green lemons, bunches of fresh dill and parsley, and a small glass bottle of cold-pressed virgin olive oil on a dark slate surface. Directional studio light, rich deep greens and clean natural textures, scientific and natural health aesthetic, 4K resolution --ar 16:9
```

#### 043. عضله‌سازی و افزایش وزن بدون مکمل‌های شیمیایی
- **موضوع مقاله:** پروتئین‌های باکیفیت در سفره ایرانی
- **پرامپت نانو بنانا:**
```text
Fitness nutrition food photography. A wholesome post-workout meal plate featuring grilled tender lean beef fillets, steamed lentils, roasted sweet potato wedges, and a fresh spinach salad with toasted pumpkin seeds. Clean gym-lifestyle wooden table background, crisp high-protein food styling, vibrant and satisfying, 4K resolution --ar 16:9
```

---

### ۵.۳ دسته‌بندی‌های لیست خرید هوشمند (Shopping Categories - نسبت ۱:۱)

این تصاویر به صورت آیکون‌های تصویری باکیفیت یا تامبنیل در بخش سبد خرید اپلیکیشن (`app/lib/real/plan/plan.dart` - `_ShoppingPage`) قرار می‌گیرند:

#### 044. دسته‌بندی پروتئین و گوشت (Protein & Meat)
- **پرامپت نانو بنانا:**
```text
Editorial macro food photograph of fresh raw healthy protein staples. Fresh skinless chicken breast fillet, a block of firm organic tofu, farm-fresh brown eggs with speckled shells, and a cut of lean beef, cleanly arranged on a white marble cutting board with a sprig of fresh rosemary. Bright clean overhead lighting, pristine food quality, square framing, 4K resolution --ar 1:1
```

#### 045. دسته‌بندی نان و غلات کامل (Breads & Grains)
- **پرامپت نانو بنانا:**
```text
Artisan bakery still-life of healthy Persian grains. Folded warm whole-wheat Sangak flatbread with sesame seeds, a rustic bowl of Persian aromatic brown rice, whole rolled oats, and quinoa seeds. Plated on a light linen cloth over wood, warm golden lighting, wholesome fiber textures, square format, 4K resolution --ar 1:1
```

#### 046. دسته‌بندی لبنیات و پروبیوتیک (Dairy & Probiotics)
- **پرامپت نانو بنانا:**
```text
Clean culinary photograph of traditional healthy Persian dairy items. A terracotta pot of thick creamy strained Greek yogurt (labneh), a wedge of white brined Lighvan cheese, a glass bottle of fresh pasture-raised milk, and a small ceramic jug of homemade mint doogh. Clean ivory background, pure and fresh, square framing, 4K resolution --ar 1:1
```

#### 047. دسته‌بندی میوه و سبزیجات تازه (Fruits & Vegetables)
- **پرامپت نانو بنانا:**
```text
Vibrant macro food photo of fresh farm produce. Crisp Persian baby cucumbers with fresh yellow blossom, sweet heirloom vine tomatoes, a bunch of aromatic sweet basil with glistening dew drops, and sliced juicy lemons on a pale grey stone plate. Crisp daylight, saturated natural colors, square format, 4K resolution --ar 1:1
```

#### 048. دسته‌بندی مغزها، دانه‌ها و روغن‌های سالم (Nuts & Healthy Oils)
- **پرامپت نانو بنانا:**
```text
Still-life macro photo of healthy Persian fats. A small glass cruet filled with golden-green extra virgin olive oil, surrounded by raw Persian walnuts, green pistachio kernels, whole raw almonds, and flaxseeds on a dark walnut wood board. Warm side light, rich textures, square framing, 4K resolution --ar 1:1
```

#### 049. دسته‌بندی حبوبات و ادویه‌جات سنتی (Legumes & Persian Spices)
- **پرامپت نانو بنانا:**
```text
Artisan culinary flat lay of healthy Iranian legumes and spices. Small handmade ceramic bowls filled with brown Persian lentils, pinto beans, chickpeas, fragrant saffron threads in a glass vial, deep red sumac powder, and golden turmeric powder on a slate surface. Warm culinary aesthetic, square format, 4K resolution --ar 1:1
```

---

### ۵.۴ نشان‌های دستاورد، استریک و وضعیت‌های کاربری (Badges & In-App UI States)

#### 050. استریک ۷ روزه پایبندی به برنامه (7-Day Streak Badge)
- **پرامپت نانو بنانا:**
```text
Photorealistic 3D premium emblem on a clean minimalist ivory background. A luminous polished emerald-green sprout rising through an elegant gold metallic heptagon ring, subtle glowing particles, soft drop shadow, luxurious modern finish, celebrating 7 days of nutrition consistency, clean aesthetic, 4K resolution --ar 1:1
```

#### 051. استریک ۳۰ روزه تبدیل عادت (30-Day Habit Mastery Badge)
- **پرامپت نانو بنانا:**
```text
Photorealistic 3D achievement medal for healthy nutrition habits. A stylized golden pomegranate sculpture with polished facets, cradled inside a satin-finish pine-green laurel wreath. Warm directional lighting, elegant reflective surfaces, prestige award aesthetic, square framing, 4K resolution --ar 1:1
```

#### 052. وضعیت خالی: تکمیل تمام وعده‌های روز (Day Fully Completed)
- **پرامپت نانو بنانا:**
```text
Clean, comforting lifestyle illustration photograph. An empty, gleaming white ceramic plate with a modern satin-finish golden fork resting neatly across it, beside a small crystal vase with a fresh sprig of green mint on a sunlit oak tabletop. Soft morning light, sense of accomplished calm, clutter-free, square framing, 4K resolution --ar 1:1
```

#### 053. وضعیت در انتظار بررسی پزشک (Doctor In-Review State)
- **پرامپت نانو بنانا:**
```text
Minimalist lifestyle scene of medical care. A neat leather portfolio notebook closed with a golden pen resting on a modern nutritionist desk next to a small cup of tea and a small healthy green bonsai plant. Soft, trustworthy daylight, calm patience, professional clinical care, square format, 4K resolution --ar 1:1
```

---

## بخش سوم: کاتالوگ مستر غذاها و تغذیه کاملاً ایرانی (Iranian Food Master Catalog)

این بخش قلب تپنده دیتابیس غذایی اپلیکیشن است. تمامی پرامپت‌ها بر اساس دستورپخت‌های واقعی ایرانی، اندازه‌گیری‌های رژیمی، مواد اولیه بومی (زعفران قائنات، سماق تبریز، زرشک پفکی، لیمو عمانی، سبزی خوردن تازه، نان‌های سنگک و بربری) و با بالاترین استانداردهای عکاسی تبلیغاتی غذا تنظیم شده‌اند.

---

### ۶.۱ صبحانه‌های مقوی و سنتی ایرانی (Persian Healthy Breakfasts - نسبت ۱:۱)

#### 054. املت گوجه سنتی بازاری با نان بربری و ریحان (Omelet Gojeh)
- **کالری تقریبی:** ۲۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial editorial food photography of a classic Iranian tomato omelet (Omelet Gojeh). Fresh ripe vine tomatoes slowly stewed down into a thick, aromatic crimson sauce cooked in virgin olive oil, with organic eggs gently folded in, creating a glossy, rich marbled red and gold texture. Served in a shallow rustic cast-iron skillet, garnished with fresh whole purple basil leaves and a pinch of black pepper. Accompanied by thick warm slices of traditional sesame Barbari bread and a wedge of fresh Persian lime on a light oak table. Natural morning window sunlight from the side, rising delicate steam, crisp textures, mouthwatering and authentic, square framing, 4K resolution --ar 1:1
```

#### 055. نان سنگک سبوس‌دار، پنیر لیقوان و گردوی تویسرکان (Noon-o-Panir-o-Gerdoo)
- **کالری تقریبی:** ۲۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan lifestyle food photography of the quintessential Persian breakfast spread. A folded piece of warm, freshly baked whole-wheat Sangak flatbread showing characteristic pebble dimples and toasted sesame seeds, served next to a thick rectangular block of creamy, crumbly white Iranian Lighvan sheep's milk cheese on a handcrafted turquoise ceramic plate. Garnished with halves of freshly cracked raw Persian walnuts and a generous bunch of washed sabzi khordan (fresh mint, tarragon, crisp radishes). Warm early morning sun streaming across a clean linen runner, cozy and wholesome, square crop, 4K resolution --ar 1:1
```

#### 056. عدسی اصیل با گلپر، روغن زیتون بکر و لیمو ترش (Adasi)
- **کالری تقریبی:** ۲۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial macro food photography of traditional Persian brown lentil soup (Adasi). A rich, creamy, slow-simmered lentil stew in a handcrafted matte cream stoneware bowl, topped with a delicate drizzle of golden cold-pressed olive oil, a sprinkle of ground angelica powder (golpar), and finely chopped fresh cilantro. Resting beside a freshly sliced Persian lime half and toasted strips of Lavash bread on a dark slate tabletop. Soft side-studio daylight, rich velvety texture, warm comforting aroma, square framing, 4K resolution --ar 1:1
```

#### 057. حلیم سنتی بوقلمون کم‌روغن با دارچین و کنجد (Haleem Booghalamoo)
- **کالری تقریبی:** ۳۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
High-end food magazine photography of a healthy shredded turkey Haleem (Persian slow-cooked wheat and turkey porridge). The porridge has a silky, thick, shredded texture served in a wide earthenware bowl, artfully garnished with an elegant line of fragrant ground cinnamon powder, toasted white sesame seeds, and a tiny teardrop drizzle of raw organic honey. A silver spoon rests beside the bowl on a rustic wooden table. Morning window light catching the textured surface, subtle steam rising, nutritious comfort food, square framing, 4K resolution --ar 1:1
```

#### 058. نیمرو عسلی در روغن زیتون با نان جو و سبزیجات (Nimroo with Barley Bread)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Appetizing food photography of two farm-fresh sunny-side-up eggs cooked gently in cold-pressed extra virgin olive oil, featuring vibrant runny golden-orange yolks and lightly crisped white edges, dusted with sea salt and cracked black pepper. Served with slices of dark rustic whole-grain barley flatbread (Noon-e Jo) and sweet cherry tomatoes on the vine. Clean white ceramic dish on a pale oak surface, bright morning daylight, fresh and vibrant, square format, 4K resolution --ar 1:1
```

#### 059. فرنی جو دوسر با شیر کم‌چرب، موز، خرما و دارچین (Persian Oatmeal Bowl)
- **کالری تقریبی:** ۲۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Modern healthy breakfast food photography of Persian spiced oatmeal porridge. Rolled oats cooked in low-fat almond milk in a white ceramic bowl, neatly arranged with sliced fresh bananas, pitted Medjool dates, a handful of raw pistachio slivers, and a dusting of sweet Ceylon cinnamon. Photographed from a 45-degree angle under soft diffuse daylight, wholesome, clean aesthetic, nourishing and energizing, square crop, 4K resolution --ar 1:1
```

#### 060. تخم‌مرغ آب‌پز سفت، خیار بوته‌ای، گوجه گیلاسی و سبزی خوردن (Boiled Eggs & Crudités)
- **کالری تقریبی:** ۱۷۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Minimalist lifestyle food photo of a clean high-protein breakfast. Two perfectly hard-boiled free-range eggs cut in half displaying firm bright yellow yolks, arranged neatly on a stone plate alongside crisp slices of Persian cucumbers, sweet red cherry tomatoes, and fresh sprigs of wild mint and basil. A small wooden pinch bowl of Himalayan pink salt beside it. Clean natural lighting, refreshing simplicity, square format, 4K resolution --ar 1:1
```

#### 061. ارده کنجد طبیعی با شیره انگور ملایر و نان سنگک (Ardeh Shireh)
- **کالری تقریبی:** ۲۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisanal culinary photograph of Iranian Ardeh Shireh. A small ceramic dipping bowl featuring stone-ground sesame tahini swirled with rich dark amber grape molasses (shireh-ye angoor) in an elegant marble pattern. Served with freshly torn pieces of warm whole-wheat Sangak bread with toasted sesame seeds on a light linen cloth. Warm golden morning sunlight, rich creamy textures, nostalgic and pure, square framing, 4K resolution --ar 1:1
```

#### 062. ساندویچ تخم‌مرغ و سبزیجات در نان تست سبوس‌دار (Egg & Herb Toast)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Bright commercial cafe-style food photo of an open-faced Iranian breakfast sandwich. A toasted slice of artisan multi-grain sourdough bread layered with mashed avocado, thinly sliced hard-boiled eggs, fresh watercress, Persian cucumber rounds, and a light sprinkle of sumac and olive oil. Plated on a white matte ceramic plate on a sunny breakfast table, crisp fresh colors, square crop, 4K resolution --ar 1:1
```

#### 063. ماست پروبیوتیک با توت خشک، بادام ایرانی و خلال پسته (Yogurt & Dried Berries)
- **کالری تقریبی:** ۱۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial macro food photography of a healthy Persian yogurt bowl. Thick strained creamy Greek probiotic yogurt in a speckled ceramic bowl, topped with dried white mulberries (toot khoshk), raw Iranian wild almonds, vibrant green pistachio slivers, and a gentle swirl of orange blossom honey. Soft morning daylight, pure clean aesthetic, delicious gut-health breakfast, square format, 4K resolution --ar 1:1
```

#### 064. املت اسفناج و قارچ رژیمی با روغن زیتون (Spinach & Mushroom Omelet)
- **کالری تقریبی:** ۲۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Appetizing culinary photography of a fluffy folded Iranian spinach and button mushroom omelet. Sautéed tender baby spinach and golden sliced mushrooms folded inside fluffy whipped eggs, lightly browned on the outside with a moist interior, garnished with fresh dill. Plated on a sage-green stoneware plate with a side of whole-wheat pita bread, natural window light, square framing, 4K resolution --ar 1:1
```

#### 065. کوکو سیب‌زمینی پخته کم‌روغن با گوجه و خیارشور خونگی (Kuku Sibzamini)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Home-style editorial food photo of healthy oven-baked Persian potato patties (Kuku Sibzamini). Golden-brown potato patties with crispy herbaceous edges, served with sliced ripe tomatoes, homemade low-salt pickled cucumbers (khiarshoor), and fresh Persian flat-leaf parsley on a vintage Iranian floral plate. Warm nostalgic morning light, wholesome home cooking, square format, 4K resolution --ar 1:1
```

#### 066. پنکیک جو دوسر رژیمی با عسل طبیعی و توت‌فرنگی تازه (Oat Pancakes)
- **کالری تقریبی:** ۲۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant lifestyle food photography of a stack of three fluffy whole-oat banana pancakes. Golden-brown pancakes drizzled with a thread of wild thyme honey and topped with freshly sliced red strawberries and crushed Persian pistachios. Clean white porcelain plate on a light-washed wood table, bright morning sunshine, appetizing and healthy, square crop, 4K resolution --ar 1:1
```

#### 067. کاسه میوه فصلی با ماست یونانی و دانه چیا (Seasonal Fruit & Chia Bowl)
- **کالری تقریبی:** ۱۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Bright refreshing breakfast bowl photography. Hydrated chia seeds layered with thick strained yogurt, topped with neatly fanned slices of sweet Persian melon, fresh ruby pomegranate arils, and mint leaves in a clear glass bowl. Sparkling morning light, invigorating hydration, square framing, 4K resolution --ar 1:1
```

#### 068. نان تافتون گرم با کره بادام‌زمینی طبیعی و برش‌های موز (Taftoon Peanut Butter Toast)
- **کالری تقریبی:** ۲۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Warm food photography of a modern nutritious Persian breakfast. Freshly baked whole-wheat Taftoon flatbread spread with all-natural creamy peanut butter, topped with thinly sliced banana rounds and a light sprinkle of cinnamon and chia seeds. Plated on a dark wooden board, soft warm side lighting, wholesome energy breakfast, square format, 4K resolution --ar 1:1
```

#### 069. املت شاپوری رژیمی (املت تخم‌مرغ با خوراک لوبیا چیتی گیلانی)
- **کالری تقریبی:** ۲۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic Northern Iranian culinary photo of Omelet Shapouri. Slow-simmered rich pinto beans in tomato reduction layered with softly fried eggs with golden runny yolks, served in a traditional blue-rimmed enamel plate. Garnished with cracked black pepper and accompanied by warm Barbari bread and sour Seville orange wedges (Narenj). Atmospheric morning cafe light, rustic and satisfying, square crop, 4K resolution --ar 1:1
```

#### 070. سیب‌زمینی تنوری با تخم‌مرغ آب‌پز و پودر آویشن کوهی (Baked Potato & Egg)
- **کالری تقریبی:** ۲۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Rustic wholesome breakfast photography. Small baby potatoes roasted in their skins with sea salt and wild mountain thyme, served alongside two soft-boiled eggs sliced open to reveal warm jammy centers. Arranged on a slate board with a sprig of fresh rosemary and olive oil drizzle, soft natural light, square format, 4K resolution --ar 1:1
```

#### 071. بورانی اسفناج کم‌چرب با تخم‌مرغ نیمرو و نان جو (Borani Esfenaj Breakfast)
- **کالری تقریبی:** ۲۰۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan Iranian food photography of steamed Persian baby spinach folded with thick strained garlic yogurt (Borani), topped with a gently poached farm egg with an oozing warm yolk, dusted with sumac and toasted pine nuts. Served with toasted thin barley crackers, soft side lighting, elegant culinary presentation, square framing, 4K resolution --ar 1:1
```

#### 072. تخم‌مرغ هم‌زده (اسکرامبل) با گوجه فرنگی گیلاسی و پیازچه (Scrambled Eggs with Chives)
- **کالری تقریبی:** ۱۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Close-up food photograph of soft, creamy scrambled eggs cooked in olive oil, intermingled with roasted blistered red cherry tomatoes and finely chopped green scallions. Served in an off-white stoneware bowl with toasted multi-seed bread soldiers, soft morning sunlight, velvety texture, square format, 4K resolution --ar 1:1
```

#### 073. پنیر فتا کم‌نمک با گوجه خیار خردشده و نعناع تازه (Persian Classic Crudités Spread)
- **کالری تقریبی:** ۱۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Fresh minimalist breakfast photography. Diced ripe tomatoes, crisp Persian cucumbers, and chopped fresh mint tossed lightly with cold-pressed olive oil, paired with cubes of low-salt sheep's milk cheese on an artisanal ceramic platter. Warm dawn light, vibrant red and green colors, refreshing morning vitality, square crop, 4K resolution --ar 1:1
```

---

### ۶.۲ چلوها، پلوها و خورش‌های اصیل ایرانی (Persian Rice & Stews - نسبت ۱:۱ یا ۴:۳)

#### 074. چلو کباب کوبیده رژیمی با گوجه کبابی و سماق (Chelo Kabab Koobideh)
- **کالری تقریبی:** ۵۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial restaurant culinary photography of high-protein healthy Persian Chelo Kabab Koobideh. Two freshly grilled skewers of lean minced lamb and beef kebab with caramelized grill marks, resting across a fluffy mound of steaming Persian basmati rice dusted with golden saffron threads. Garnished with charred whole vine tomatoes, a roasted green chili pepper, a generous dusting of deep-red wild sumac, and a wedge of fresh Persian lemon. Plated on an artisanal white ceramic platter on an oak table, 45-degree angle shot, shallow depth of field, glistening meat juices, appetizing steam rising, natural lighting, square framing, 4K resolution --ar 1:1
```

#### 075. زرشک‌پلو با مرغ زعفرانی کم‌روغن (Zereshk Polo ba Morgh)
- **کالری تقریبی:** ۴۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet editorial food photography of iconic Persian Zereshk Polo ba Morgh. A tender, slow-simmered chicken breast fillet braised in a golden saffron, turmeric and tomato glaze, served next to an exquisite mound of aromatic basmati rice layered with vibrant ruby-red barberries (zereshk) sautéed with saffron and slivered green pistachios. Accompanied by a crispy square of golden potato Tahdig at the plate's edge. Warm directional window light, rich colors, authentic Iranian hospitality aesthetic, square crop, 4K resolution --ar 1:1
```

#### 076. خورش قورمه‌سبزی جاافتاده با گوشت لخم و کته طارم (Ghormeh Sabzi)
- **کالری تقریبی:** ۴۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic Persian culinary photography of slow-cooked Ghormeh Sabzi. A deep traditional blue-glazed earthenware bowl filled with rich, dark-green herb stew (fenugreek, parsley, leek, coriander) packed with tender lean veal chunks, red kidney beans, and pierced dried black limes (limoo amani) with a shimmering natural oil sheen on top. Served beside a plate of fluffy white Persian Kateh rice. Overhead 45-degree composition, moody natural light, deep rich emerald and golden tones, delicious home-cooked perfection, square framing, 4K resolution --ar 1:1
```

#### 077. خورش قیمه سنتی با خلال سیب‌زمینی تنوری (Gheimeh Sibzamini)
- **کالری تقریبی:** ۴۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Top-tier food photography of traditional Persian Khoresht Gheimeh. A rich golden-orange stew of yellow split peas, tender braised beef cubes, and sun-dried black limes in a fragrant cinnamon-saffron tomato sauce, crowned with crisp, oven-baked golden potato matchsticks. Served in an artisanal ceramic bowl beside a plate of saffron-accented basmati rice. Warm side-window lighting, aromatic steam rising, mouthwatering texture, square crop, 4K resolution --ar 1:1
```

#### 078. خورش قیمه بادمجان کم‌روغن با غوره (Gheimeh Bademjan)
- **کالری تقریبی:** ۴۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of Persian eggplant and split-pea stew. Golden-braised slender Persian eggplants resting atop a flavorful tomato and yellow split-pea stew with lean meat and sour unripened green grapes (ghooreh), garnished with fresh herbs. Plated on an off-white stoneware dish, soft daylight highlighting the glossy texture of the eggplant skin and rich sauce, square framing, 4K resolution --ar 1:1
```

#### 079. عدس‌پلو اصیل با کشمش پلویی، خرما و گوشت قلقلی (Adas Polo)
- **کالری تقریبی:** ۴۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of traditional Persian Adas Polo. Steamed fragrant basmati rice layered with tender brown lentils, richly garnished with glistening golden raisins, plump pitted dates sautéed in saffron butter, and delicate lean spiced mini meatballs (kufteh ghezel). Accented with slivered toasted almonds on a traditional Persian serving platter, warm ambient lighting, rich fragrant textures, square format, 4K resolution --ar 1:1
```

#### 080. سبزی‌پلو با ماهی قزل‌آلا تنوری و لیمو ترش (Sabzi Polo ba Mahi)
- **کالری تقریبی:** ۴۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial food photography of Persian herb rice with grilled trout. A bed of fragrant basmati rice steamed with abundant fresh dill, cilantro, chives, and garlic chives (Sabzi Polo), topped with a beautifully roasted whole trout fillet with golden crisped skin, garnished with grilled lemon wheels and fresh Seville orange juice. Served on a modern ivory platter, crisp natural daylight, clean high-protein meal presentation, square crop, 4K resolution --ar 1:1
```

#### 081. لوبیاپلو شیرازی با گوشت تکه‌ای و ته‌دیگ نان (Loobia Polo)
- **کالری تقریبی:** ۴۷۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Close-up editorial food photograph of authentic Persian Loobia Polo. Fluffy basmati rice layered and steamed together with tender green beans, succulent lean beef cubes, cinnamon, and a vibrant tomato sauce, displaying a golden Lavash bread Tahdig crust leaning against the side. Accompanied by a small bowl of Shirazi salad and homemade yogurt. Warm side lighting, mouthwatering homemade comfort food, square framing, 4K resolution --ar 1:1
```

#### 082. خورش فسنجان ملس با فیله مرغ و دانه انار (Fesenjan)
- **کالری تقریبی:** ۵۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
High-end food magazine photography of slow-simmered Persian Khoresht Fesenjan. A deep earthenware bowl containing a velvety, dark walnut stew with a sweet-and-sour pomegranate molasses reduction and tender chicken fillets, garnished with bright ruby pomegranate seeds and finely chopped raw walnuts. Served alongside steamed white rice, moody natural window light, rich glossy sauce texture, square format, 4K resolution --ar 1:1
```

#### 083. باقلاپلو با شوید تازه و ماهیچه گوسفندی کم‌روغن (Baghali Polo ba Mahicheh)
- **کالری تقریبی:** ۵۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Luxury culinary photography of Persian Baghali Polo ba Mahicheh. Tender, fall-off-the-bone braised lamb shank in its natural caramelized onion broth, served beside a fragrant mound of basmati rice mixed with bright green fava beans and fragrant dried dill weed, topped with saffron rice. Plated on an elegant handmade ceramic platter, warm cinematic daylight, succulent textures, prestigious dining aesthetic, square crop, 4K resolution --ar 1:1
```

#### 084. آلبالوپلو با فیله مرغ و خلال پسته (Albaloo Polo)
- **کالری تقریبی:** ۴۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant gourmet food photography of Persian sour cherry rice (Albaloo Polo). Sweet-tart preserved Persian sour cherries layered throughout fluffy basmati rice giving it a gorgeous ruby-pink hue, topped with tender saffron-marinated grilled chicken breast strips and bright green pistachio slivers. Served on a white ceramic dish, bright cheerful daylight, stunning visual contrast, square framing, 4K resolution --ar 1:1
```

#### 085. ته‌چین مرغ زعفرانی قالبی با زرشک و خلال بادام (Tahchin Morgh)
- **کالری تقریبی:** ۴۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of a slice of baked Persian saffron rice cake (Tahchin Morgh). A golden, deep-crisp saffron Tahdig crust encasing a moist, fragrant interior of yogurt-egg-infused rice and shredded seasoned chicken breast, garnished on top with sautéed tart barberries and silvered almonds. Shot at a 45-degree angle showing internal layers, warm directional lighting, crisp culinary perfection, square format, 4K resolution --ar 1:1
```

#### 086. دمپختک دمی گوجه با پیازداغ و سالاد شیرازی (Dampokhtak Gojeh)
- **کالری تقریبی:** ۳۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Cozy rustic food photography of Persian tomato rice (Dami Gojeh). A hearty home-cooked mound of orange-red tinted rice cooked with sweet tomatoes, baby potatoes, and golden caramelized onions, showing a chewy golden rice crust at the base. Served in a shallow clay bowl beside a glass dish of fresh Shirazi salad and mint leaves, warm nostalgic daylight, humble comfort meal, square crop, 4K resolution --ar 1:1
```

#### 087. استانبولی پلو با فیله مرغ نگینی و سیب‌زمینی (Estanboli Polo)
- **کالری تقریبی:** ۴۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Home-style food photograph of Persian Estanboli Polo. Steamed rice cooked with diced organic chicken breast, cubed golden potatoes, and rich tomato paste infused with turmeric and black pepper. Served with a bowl of refreshing Mast-o-Khiar (cucumber yogurt) with dried rose petals. Natural kitchen daylight, hearty healthy family dinner, square framing, 4K resolution --ar 1:1
```

#### 088. کلم‌پلو شیرازی با سبزیجات معطر و کوفته قلقلی (Kalam Polo Shirazi)
- **کالری تقریبی:** ۴۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet regional food photography of authentic Shirazi Kalam Polo. Basmati rice steamed with finely shredded sautéed white cabbage and aromatic regional herbs (tarragon, dill, basil, leek), studded with delicate seasoned mini lamb meatballs. Served on a vintage Persian patterned plate, soft diffused daylight, rich herbaceous textures, square format, 4K resolution --ar 1:1
```

#### 089. ماش‌پلو با شوید تازه و گوشت بوقلمون چرخ‌کرده (Mash Polo)
- **کالری تقریبی:** ۳۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Nutritious food photography of Persian Mung Bean Rice (Mash Polo). Fragrant basmati rice steamed with tender green mung beans, abundant fresh dill, and caramelized minced turkey breast spiced with saffron and turmeric. Plated on an off-white stoneware dish, clean modern healthy eating aesthetic, bright natural light, square crop, 4K resolution --ar 1:1
```

#### 090. خورش بامیه با غوره و گوشت گوساله بدون چربی (Khoresht Bamieh)
- **کالری تقریبی:** ۳۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of Southern Iranian okra stew (Khoresht Bamieh). Tender intact baby okra pods simmered gently in a zesty garlic-infused tomato sauce with lean beef cubes and tart sour grapes (ghooreh), garnished with fresh coriander. Served with steamed basmati rice, warm natural lighting highlighting the tender glossy okra texture, square framing, 4K resolution --ar 1:1
```

#### 091. خورش کرفس کم‌روغن با نعنا و جعفری و فیله مرغ (Khoresht Karafs)
- **کالری تقریبی:** ۳۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Healthy lifestyle food photography of Persian Celery Stew (Khoresht Karafs). Crisp-tender celery stalks braised in a vibrant green herb broth of mint and parsley with juicy pieces of chicken breast fillet and fresh lime juice, served in an artisanal ceramic bowl beside a plate of fluffy saffron rice. Bright clean daylight, fresh verdant colors, wholesome digestion-friendly meal, square format, 4K resolution --ar 1:1
```

#### 092. خورش آلو اسفناج مجلسی با گوشت تکه‌ای (Khoresht Aloo Esfenaj)
- **کالری تقریبی:** ۴۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet food magazine photo of Persian Plum and Spinach Stew (Aloo Esfenaj). Rich, dark velvety sautéed spinach stew simmered with golden dried Bokhara plums and tender lean meat cubes, offering a balanced sweet-and-tart flavor profile. Plated beside a portion of white basmati rice, warm directional side light, mouthwatering textures, square crop, 4K resolution --ar 1:1
```

#### 093. کته برنج قهوه‌ای با مرغ گریل شده و کلم بروکلی (Brown Rice & Grilled Chicken)
- **کالری تقریبی:** ۳۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Modern fitness nutrition photography of Persian-style brown rice plate. Fluffy nutty Persian brown rice steamed with saffron, paired with tender char-grilled saffron chicken breast slices and lightly steamed green broccoli florets with lemon-pepper seasoning. Minimalist white ceramic plate on light oak, crisp high-protein fitness meal presentation, square framing, 4K resolution --ar 1:1
```

#### 094. جوجه کباب فیله زعفرانی با برنج کته و گوجه کبابی (Joojeh Kabab)
- **کالری تقریبی:** ۴۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial restaurant food photography of healthy Persian Joojeh Kabab. Skewered chunks of tender chicken breast marinated in rich saffron, grated onion, and freshly squeezed lemon juice, grilled over charcoal with charred edges. Plated alongside a portion of Persian Kateh rice and roasted whole tomatoes with sumac, 45-degree angle, juicy glistening texture, bright natural light, square crop, 4K resolution --ar 1:1
```

#### 095. جوجه کباب ترش گیلانی با برنج دودی و زیتون پرورده (Joojeh Torsh)
- **کالری تقریبی:** ۴۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary photography of Northern Iranian Joojeh Torsh. Char-grilled chicken breast pieces marinated in crushed walnuts, tart pomegranate molasses, garlic, and wild mountain herbs (chochagh), served next to steaming Persian smoked rice (Berenj Doodi) and a side of green marinated olives (Zeytoon Parvardeh). Rustic wooden table, warm ambient light, rich complex textures, square framing, 4K resolution --ar 1:1
```

#### 096. کباب چنجه ماستی با نان سنگک و سبزی خوردن (Chenjeh ba Sangak)
- **کالری تقریبی:** ۴۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Appetizing food photography of succulent Persian Chenjeh lamb skewers marinated in Greek yogurt, olive oil and black pepper, grilled to medium-rare tenderness. Served on a large sheet of warm sesame Sangak bread with charred sweet peppers, raw onion wedges, and a fresh herb bouquet. Warm outdoor terrace lighting, mouthwatering grill presentation, square crop, 4K resolution --ar 1:1
```

#### 097. ماهی سفید شکم‌پر تنوری گیلانی با رب انار و گردو (Mahi Shekampor)
- **کالری تقریبی:** ۴۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet regional food photography of Persian stuffed Caspian Whitefish. Whole baked whitefish stuffed with a savory paste of crushed Persian walnuts, sour pomegranate paste, garlic, and wild herbs, roasted to a golden crispy skin. Garnished with Seville orange slices and fresh cilantro, served on a vintage fish platter, soft daylight, prestigious culinary heritage, square framing, 4K resolution --ar 1:1
```

#### 098. میگو پلو بوشهری با گشنیز، شنبلیله و سیر (Meygoo Polo)
- **کالری تقریبی:** ۴۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant Southern Iranian seafood photography of Bushehri Meygoo Polo. Fragrant basmati rice tossed with fresh plump Persian Gulf shrimp sautéed with abundant garlic, fresh coriander, fenugreek, and warm tamarind spices. Plated on a terracotta platter, warm afternoon sunshine, succulent seafood textures, square crop, 4K resolution --ar 1:1
```

#### 099. خورش کدو سبز با گوجه تازه و غوره (Khoresht Kadoo)
- **کالری تقریبی:** ۳۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Healthy home-cooking photography of Persian Zucchini Stew (Khoresht Kadoo). Tender sliced green zucchini halves braised in a light tomato-garlic broth with lean veal chunks and sour unripened grapes, garnished with fresh mint. Served in a shallow ivory bowl with saffron rice, soft natural lighting, light and refreshing dinner, square framing, 4K resolution --ar 1:1
```

#### 100. خورش ریواس بهاری با نعنا و جعفری (Khoresht Rivas)
- **کالری تقریبی:** ۳۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Seasonal spring culinary food photography of Persian Rhubarb Stew (Khoresht Rivas). Tender stalks of wild spring rhubarb with a vibrant pink-green hue, simmered in a tart mint and parsley herb sauce with lean chicken fillets. Served beside steamed basmati rice, bright crisp spring daylight, uniquely refreshing sour notes, square crop, 4K resolution --ar 1:1
```

#### 101. هویج پلو تبریزی با زرشک و فیله مرغ زعفرانی (Havij Polo Tabrizi)
- **کالری تقریبی:** ۴۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of Azeri Havij Polo. Basmati rice steamed with julienned sweet Persian carrots caramelized with saffron and a splash of lemon juice, topped with shredded saffron chicken breast and ruby-red tart barberries. Plated on a fine blue-and-white porcelain dish, warm daylight, elegant color contrast, square framing, 4K resolution --ar 1:1
```

---

### ۶.۳ غذاهای نانی، کوکوها، دلمه‌ها و خوراک‌های سنتی (Traditional Dishes & Stews - نسبت ۱:۱)

#### 102. کشک بادمجان کم‌روغن با نعناداغ و گردوی نگینی (Kashk-e Bademjan)
- **کالری تقریبی:** ۳۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary food photography of authentic Persian Kashk-e Bademjan. Silky mashed roasted eggplants seasoned with garlic and onions, served warm in a shallow clay bowl, artfully topped with swirls of thick cultured whey (kashk), dark-green sizzling mint oil (na'na dagh), golden crispy onions (piaz dagh), and crushed raw Persian walnuts. Served with triangles of toasted whole-wheat Sangak bread on the side, soft directional side lighting, rich tactile textures, square framing, 4K resolution --ar 1:1
```

#### 103. میرزاقاسمی اصیل گیلانی با گوجه کبابی دودی و تخم‌مرغ (Mirza Ghasemi)
- **کالری تقریبی:** ۲۷۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Atmospheric food photography of Northern Iranian Mirza Ghasemi. Charred smoky eggplants stewed with ripe vine tomatoes and fragrant browned garlic cloves, crowned with two soft poached eggs folded gently into the savory red sauce. Served in a traditional rustic clay dish (Gamaj), garnished with fresh basil leaves and accompanied by warm flatbread, soft warm daylight, authentic smoky appetizing texture, square crop, 4K resolution --ar 1:1
```

#### 104. کوکو سبزی گردویی با زرشک و نان سنگک (Kuku Sabzi)
- **کالری تقریبی:** ۲۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of healthy Persian Herb Frittata (Kuku Sabzi). Thick wedges of deep-emerald frittata made with fresh parsley, cilantro, dill, chives, and fenugreek bound with whisked eggs, studded with ruby-red tart barberries and toasted walnut pieces. Plated on a white ceramic platter with sliced fresh radishes and pickled shallots, bright morning daylight, vibrant colors and fluffy texture, square framing, 4K resolution --ar 1:1
```

#### 105. دیزی سنگی (آبگوشت) سنتی رژیمی با ترشی و سبزی خوردن (Dizi / Abgoosht)
- **کالری تقریبی:** ۵۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic documentary food photograph of a traditional Persian Dizi spread. A traditional grey stone crock pot (Dizi Sangi) filled with aromatic slow-simmered broth with lean lamb shank, chickpeas, white beans, whole potatoes, and tomatoes, with a traditional stone pestle (Gooshtkoob) alongside for pounding the meat. Served with a wicker basket of whole-wheat Sangak, homemade garlic pickles (Seer Torshi), and crisp Persian fresh herbs on a rustic wooden table. Warm vintage lighting, nostalgic cultural feast, square crop, 4K resolution --ar 1:1
```

#### 106. کوفته تبریزی اصیل با آلو بخارا و گردو (Kufteh Tabrizi)
- **کالری تقریبی:** ۴۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet food magazine photo of Azeri Kufteh Tabrizi. A magnificent, large savory meatball made of pounded lean beef, yellow split peas, and fragrant herbs, resting in a rich saffron-tomato broth, cut open to show its hidden stuffing of a hard-boiled egg, dried Bokhara plum, walnuts, and caramelized fried onions. Garnished with fresh mint on an artisanal serving plate, warm directional lighting, succulent home-cooked masterpiece, square format, 4K resolution --ar 1:1
```

#### 107. تاس‌کباب سنتی با به، هویج، آلو و گوشت تکه‌ای (Tas Kabab)
- **کالری تقریبی:** ۳۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Cozy home-style food photograph of Persian layered pot roast (Tas Kabab). Harmoniously layered slices of sweet quince (beh), yellow carrots, onions, tomatoes, and tender lean beef braised together in a gentle cinnamon-turmeric reduction. Served in a shallow ceramic dish with warm flatbread, soft warm daylight, comforting fragrant steam rising, square crop, 4K resolution --ar 1:1
```

#### 108. خوراک لوبیاچیتی با قارچ و لیموترش (Loobia Chiti ba Gharch)
- **کالری تقریبی:** ۲۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary food photo of Persian Pinto Bean and Mushroom Stew. Plump, creamy pinto beans slow-simmered with sautéed button mushrooms, caramelized onions, and tomato glaze, topped with chopped fresh cilantro, a pinch of wild angelica (golpar), and olive oil. Served with a lime wedge on a dark ceramic dish, warm morning window lighting, wholesome plant-protein comfort food, square framing, 4K resolution --ar 1:1
```

#### 109. دلمه برگ مو تبریزی با چاشنی ملس سرکه شیره (Dolmeh Barg-e Mo)
- **کالری تقریبی:** ۳۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet food photography of Persian Stuffed Grape Leaves (Dolmeh Barg). Tightly rolled, glossy tender grape leaves stuffed with seasoned aromatic rice, yellow split peas, minced herbs, and lean meat, arranged neatly in circular spirals on a fine porcelain platter, glazed with a subtle sweet-and-sour reduction of grape molasses and verjuice. Garnished with fresh pomegranate seeds and lemon rounds, warm daylight, delicate textures, square format, 4K resolution --ar 1:1
```

#### 110. دلمه فلفل و بادمجان شکم‌پر (Dolmeh Felfel-o-Bademjan)
- **کالری تقریبی:** ۳۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Colorful culinary food photography of stuffed Persian vegetables. A vibrant red bell pepper and a tender purple eggplant, hollowed out and stuffed generously with fragrant herb rice, lentils, and seasoned lean meat, braised in a savory spiced tomato broth. Plated on a turquoise ceramic dish with fresh basil sprigs, bright natural lighting, wholesome and delicious, square crop, 4K resolution --ar 1:1
```

#### 111. خوراک مرغ و قارچ رژیمی با سبزیجات بخارپز (Diet Chicken & Mushroom Skillet)
- **کالری تقریبی:** ۳۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Modern fitness lifestyle food photography of a high-protein chicken skillet. Slices of tender golden pan-seared chicken breast sautéed with white button mushrooms, baby carrots, and green string beans in a light garlic-herb olive oil glaze. Served in a contemporary cast-iron pan with fresh lemon slices, bright crisp daylight, nutritious clean meal, square framing, 4K resolution --ar 1:1
```

#### 112. کوکو لوبیا سبز تبریزی مجلسی (Kuku Loobia Sabz)
- **کالری تقریبی:** ۲۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of Azeri Green Bean Kuku. Baked frittata squares featuring finely chopped tender green beans, carrots, and sweet bell peppers bound with farm eggs and spiced with saffron, turmeric, and black pepper, topped with slivered almonds. Served on a modern white platter with cherry tomatoes, soft window daylight, clean colorful presentation, square crop, 4K resolution --ar 1:1
```

#### 113. یتیمچه بادمجان و کدو سنتی کم‌روغن (Yatimcheh)
- **کالری تقریبی:** ۲۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Home-cooked rustic food photography of Persian Yatimcheh. Stewed cubed purple eggplants, tender zucchini, sweet bell peppers, and fresh chopped tomatoes simmered gently with garlic, turmeric and sour unripened grape juice. Served in an earthy clay bowl with warm Sangak bread and fresh basil leaves, natural light, humble plant-based Persian cooking, square framing, 4K resolution --ar 1:1
```

#### 114. فیله ماهی قزل‌آلا سوخاری در ایرفرایر بدون روغن (Air-Fried Crispy Trout)
- **کالری تقریبی:** ۳۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Crisp modern culinary food photo of an air-fried trout fillet. Golden, perfectly crisped herb-crusted fish fillet served over a fresh arugula, radish, and Persian cucumber salad dressed with cold-pressed olive oil and lemon juice. Plated on a dark slate board, bright appetizing side lighting, super crisp textures with zero greasiness, square format, 4K resolution --ar 1:1
```

#### 115. کوکو کدو سبز رژیمی با شوید و پنیر فتا (Kuku Kadoo Sabz)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Fresh appetizing food photography of baked Persian Zucchini Patties. Golden-green patties made with grated zucchini, fresh dill, garlic, and crumbled low-salt feta cheese, baked to a delicate crisp exterior and moist tender interior. Served with a dollop of strained yogurt and fresh mint on a ceramic plate, soft daylight, light vegetarian meal, square crop, 4K resolution --ar 1:1
```

#### 116. برگر خانگی گوشت بوقلمون با نان چاودار (Healthy Turkey Burger)
- **کالری تقریبی:** ۳۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan gourmet burger food photography. A thick, juicy lean ground turkey breast patty spiced with sumac and grated onion, topped with sliced ripe tomatoes, fresh Persian watercress, and a smear of mustard yogurt sauce inside a toasted dark rye bun. Resting on greaseproof paper on a wooden board, bright studio daylight, healthy delicious comfort food, square framing, 4K resolution --ar 1:1
```

#### 117. ساندویچ مرغ ریش‌ریش با ماست موسیر و کاهو (Shredded Chicken Sandwich)
- **کالری تقریبی:** ۳۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Bright deli-style food photography of a healthy Persian chicken sandwich. Shredded poached chicken breast tossed with light shallot yogurt (mast-o-moosir), fresh dill, and finely diced celery, stuffed into a fresh whole-wheat baguette with crisp romaine lettuce and cucumber pickles. Cut in half on a wooden cutting board, bright natural light, wholesome grab-and-go meal, square format, 4K resolution --ar 1:1
```

---

### ۶.۴ آش‌ها، سوپ‌ها و کاسه‌های سلامت (Soups & Ash - نسبت ۱:۱)

#### 118. آش رشته اصیل ایرانی با کشک رژیمی و نعناداغ (Ash-e Reshteh)
- **کالری تقریبی:** ۳۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Iconic Persian culinary photography of traditional Ash-e Reshteh. A deep, wide decorative Persian ceramic bowl filled with thick, hearty vegetable and noodle soup made with fresh spinach, dill, parsley, cilantro, chickpeas, lentils, and kidney beans, intricately decorated on top with swirling patterns of white whey (kashk), dark-green fried mint oil, crispy golden fried onions, and crushed garlic. Gentle aromatic steam rising from the bowl on a vintage tablecloth, warm overhead daylight, rich cultural feast, square framing, 4K resolution --ar 1:1
```

#### 119. آش جو سنتی با سبزیجات تازه و آب قلم کم‌چرب (Ash-e Jo)
- **کالری تقریبی:** ۳۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary food photo of slow-simmered Persian Barley Soup (Ash-e Jo). A comforting, creamy soup made from whole pearl barley, lentils, and chopped fresh herbs in a light savory broth, garnished on top with a light swirl of yogurt whey, crispy onions, and a sprinkle of dried mint. Served in a handmade speckled clay bowl, soft morning window light, deeply nourishing and wholesome, square crop, 4K resolution --ar 1:1
```

#### 120. آش دوغ اردبیل با سیر تازه، کوفته ریزه و نعنا (Ash-e Doogh)
- **کالری تقریبی:** ۲۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic regional food photography of Azerbaijani Ash-e Doogh. A creamy, pristine white yogurt-and-herb soup with chickpeas, short-grain rice, fresh wild garlic chives (leek), and delicate bite-sized lamb meatballs, garnished with a swirl of emerald mint oil. Served in a shallow blue-glazed earthenware bowl, natural daylight highlighting the silky texture, delightfully tangy and fragrant, square format, 4K resolution --ar 1:1
```

#### 121. سوپ جو قرمز با فیله مرغ، هویج و جعفری (Soup-e Jo ba Morgh)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Classic restaurant food photography of Persian Red Barley Soup. A silky, warm tomato-based broth simmered with pearl barley, shredded chicken breast, finely diced carrots, and chopped flat-leaf parsley, served in an elegant white porcelain bowl with a wedge of fresh Persian lime on the rim. Warm directional studio light, fragrant steam, comforting restorative soup, square framing, 4K resolution --ar 1:1
```

#### 122. سوپ شیر و قارچ سبک رژیمی با جو پرک (Soup-e Shir ba Gharch)
- **کالری تقریبی:** ۲۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet food magazine photograph of healthy Persian Cream of Mushroom and Milk Soup. A creamy, velvety soup made with low-fat pasture milk, rolled oats, and tender sliced sautéed white mushrooms, garnished with freshly ground black pepper and chopped fresh dill. Plated in a modern matte ceramic bowl, soft morning daylight, cozy and comforting texture, square crop, 4K resolution --ar 1:1
```

#### 123. سوپ عدس قرمز (دال عدس) جنوبی با تمبر هندی و سیر (Dal Adas)
- **کالری تقریبی:** ۲۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant Southern Iranian food photography of Bushehri Dal Adas. A rich, golden-orange spiced red lentil soup simmered with garlic, turmeric, tomatoes, and tangy tamarind paste, topped with fresh coriander leaves and a drizzle of cumin oil. Served in a rustic bowl with warm flatbread, warm sunny atmosphere, zesty aroma, square format, 4K resolution --ar 1:1
```

#### 124. آش شله‌قلمکار سنتی با حبوبات کامل و گوشت ریش (Ash-e Sholeh Ghalamkar)
- **کالری تقریبی:** ۳۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Atmospheric culinary photograph of authentic Persian Ash-e Sholeh Ghalamkar. Thick, slow-simmered, textured stew made from multiple legumes, mixed fresh greens, rice, and shredded lean meat, richly topped with caramelized mint onions and saffron oil. Served in an antique copper bowl on an oak table, warm ambient lighting, decadent heritage comfort meal, square framing, 4K resolution --ar 1:1
```

#### 125. سوپ سبزیجات چربی‌سوز و پاکسازی بدن (Detox Vegetable Soup)
- **کالری تقریبی:** ۱۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Clean lifestyle food photography of a light Persian detox vegetable soup. A vibrant, clear broth filled with diced tender zucchini, celery stalks, florets of green broccoli, peeled tomatoes, and fresh parsley leaves, with a slice of fresh lemon. Served in a clear glass bowl on a sunlit table, pure, cleansing and revitalizing, square crop, 4K resolution --ar 1:1
```

---

### ۶.۵ سالادها، ماست‌ها و چاشنی‌های سفره ایرانی (Salads & Sides - نسبت ۱:۱)

#### 126. سالاد شیرازی اصیل با آبغوره و نعناع خشک (Salad Shirazi)
- **کالری تقریبی:** ۶۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Macro culinary food photography of authentic Persian Salad Shirazi. Uniformly finely diced crisp Persian baby cucumbers, ripe firm red tomatoes, and red onions, dressed with tart aged verjuice (ab-ghooreh), extra virgin olive oil, fragrant dried mountain mint, and cracked sea salt. Served in an artisanal turquoise ceramic bowl, glistening with fresh juices catching the light, bright natural daylight, crisp and refreshing, square framing, 4K resolution --ar 1:1
```

#### 127. ماست و خیار مجلسی با گل‌محمدی، گردو و کشمش (Mast-o-Khiar)
- **کالری تقریبی:** ۱۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of Persian Cucumber Yogurt Dip (Mast-o-Khiar). Thick creamy strained Greek yogurt folded with finely diced Persian cucumbers, minced garlic, and fresh mint, artfully decorated on top with dried pink damask rose petals, chopped walnuts, golden sultana raisins, and dried wild mint leaves. Served in a shallow earthenware dish, soft daylight, cooling and fragrant, square format, 4K resolution --ar 1:1
```

#### 128. ماست موسیر چکیده سنتی (Mast-o-Moosir)
- **کالری تقریبی:** ۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of traditional Persian Persian Wild Shallot Yogurt (Mast-o-Moosir). Thick, velvety strained yogurt infused with rehydrated wild mountain shallot slices, garnished with a sprinkle of crushed sumac and a sprig of fresh tarragon in an off-white stoneware ramekin. Pure, clean dairy texture, crisp morning lighting, square crop, 4K resolution --ar 1:1
```

#### 129. بورانی بادمجان کبابی با سیر و نعناع (Borani Bademjan)
- **کالری تقریبی:** ۱۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Food magazine photography of Persian Charred Eggplant Dip (Borani Bademjan). Smoky roasted eggplants blended with thick strained garlic yogurt, topped with a swirl of golden olive oil, toasted pine nuts, and chopped wild mint. Plated on a dark slate dish with toasted Sangak crisps, warm side-studio light, silky texture, square framing, 4K resolution --ar 1:1
```

#### 130. زیتون پرورده اصیل رودبار با رب انار و چوچاق (Zeytoon Parvardeh)
- **کالری تقریبی:** ۱۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Macro culinary photography of authentic Gilani Zeytoon Parvardeh. Pitted plump green olives generously coated in a thick, dark, nutty marinade of finely ground walnuts, tart wild pomegranate molasses, minced garlic, angelica powder, and wild mountain herbs (chochagh), garnished with ruby pomegranate seeds. Served in a traditional green-glazed earthenware bowl, natural side lighting, rich artisanal texture, square crop, 4K resolution --ar 1:1
```

#### 131. بشقاب سبزی خوردن تازه و معطر با تربچه نقلی و پیازچه (Sabzi Khordan Platter)
- **کالری تقریبی:** ۳۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Fresh vibrant culinary still-life of a traditional Persian herb platter (Sabzi Khordan). A bountiful, impeccably arranged bouquet of washed wild mint, purple basil (reyhan), fresh tarragon (tarkhoon), leek chives (tareh), flat-leaf parsley, bright scarlet baby radishes with leafy greens, and crisp scallions with visible glistening water droplets. Plated on a handwoven wicker basket lined with linen, bright morning sun, refreshing and vital, square framing, 4K resolution --ar 1:1
```

#### 132. سالاد فصل رنگارنگ با دانه انار و سس ماست و شوید (Colorful Persian Salad)
- **کالری تقریبی:** ۹۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial restaurant photography of a vibrant Persian garden salad. Shredded red and green crisp cabbage, tender baby romaine hearts, grated sweet carrots, Persian cucumber ribbons, and sweet corn kernels, crowned with ruby pomegranate arils and toasted pumpkin seeds, served with a separate glass boat of creamy lemon-yogurt-dill dressing. Clean modern bowl on light oak, crisp daylight, nutritious, square format, 4K resolution --ar 1:1
```

#### 133. سالاد کینوا و لبو با پنیر فتا و گردو (Quinoa & Beetroot Salad)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Modern Persian health cuisine photography. Fluffy steamed tricolor quinoa tossed with roasted sweet beetroot cubes, crumbled white feta cheese, baby spinach leaves, and toasted Iranian walnuts, lightly drizzled with a pomegranate balsamic glaze. Plated on a matte white plate, bright directional daylight, stunning jewel-toned colors, square crop, 4K resolution --ar 1:1
```

---

### ۶.۶ میان‌وعده‌ها، تنقلات سالم و میوه‌های ایرانی (Healthy Snacks - نسبت ۱:۱)

#### 134. شات خرما، ارده و گردوی تازه (Dates & Tahini Energy Snack)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Macro food photography of a healthy Persian energy snack. Three soft plump Iranian Bam Mazafati dates stuffed with raw walnut halves, arranged on a small ceramic saucer and drizzled with creamy toasted sesame tahini, sprinkled with toasted sesame seeds and crushed cardamom. Soft warm afternoon light, natural sweetness, nutritious clean fuel, square framing, 4K resolution --ar 1:1
```

#### 135. کاسه آجیل خام اصیل ایرانی (Persian Raw Mixed Nuts)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Still-life macro photography of premium Iranian raw tree nuts. A handcrafted small wooden bowl filled with whole Iranian raw Akbari pistachios with open shells, Mamra sweet almonds, raw hazelnuts, and pale walnut halves on a textured linen tablecloth. Soft natural daylight highlighting the natural ridges and earth tones of the nuts, healthy heart snack, square format, 4K resolution --ar 1:1
```

#### 136. میوه خشک سنتی ایرانی (Persian Sun-Dried Fruits)
- **کالری تقریبی:** ۱۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisanal food photograph of traditional Iranian dried fruits. Sun-dried golden apricots (Bargeh Zardaloo), dried Estahban figs cut to show seeds, sweet dried white mulberries, and sour dried cherries arranged neatly on an antique brass tray, warm golden sunlight, chewy organic textures, square crop, 4K resolution --ar 1:1
```

#### 137. دانه‌های انار سرخ ساوه با گلپر (Pomegranate Arils with Angelica)
- **کالری تقریبی:** ۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant macro food photo of fresh Iranian pomegranate arils. A small crystal bowl heaped with glistening, ruby-red pomegranate seeds dusted with fragrant ground wild angelica powder (golpar), with a small silver spoon resting beside it. Sparkling natural daylight creating jewel-like reflections, appetizing and tart, square framing, 4K resolution --ar 1:1
```

#### 138. چاقاله بادام تازه و نوبرانه بهار با نمک دریا (Chaghaleh Badoom)
- **کالری تقریبی:** ۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Seasonal spring food photography of Persian green sour almonds (Chaghaleh Badoom). Tender, velvety green unripened almonds resting on a bed of fresh mint leaves with a pinch of coarse sea salt in a small terracotta dish, glistening with fresh water drops. Bright crisp spring daylight, fresh sour snack nostalgia, square format, 4K resolution --ar 1:1
```

#### 139. گوجه سبز ترش و آبدار با نمک (Ghojeh Sabz)
- **کالری تقریبی:** ۵۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Close-up mouthwatering food photo of fresh Persian green sour greengage plums (Ghojeh Sabz). A heap of crisp, glossy bright green plums with tiny water beads in a small rustic wooden bowl, with a small dish of sea salt beside them. Vibrant natural spring sunlight, crisp refreshing crunch, square crop, 4K resolution --ar 1:1
```

#### 140. لبو (چغندر پخته) داغ و شیرین زمستانی (Laboo)
- **کالری تقریبی:** ۱۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Cozy winter food photograph of Persian steamed beetroot (Laboo). Tender, steaming slices of rich crimson sweet beetroot layered on a rustic tin plate, glistening with their own reduced ruby-red natural syrup. Gentle steam rising in cold ambient light, deep comforting warmth, square framing, 4K resolution --ar 1:1
```

#### 141. باقلا پخته داغ با گلپر و سرکه (Baghala ba Golpar)
- **کالری تقریبی:** ۱۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Atmospheric Persian winter street-food still-life. A bowl of steaming, tender boiled fava beans in their skins, generously dusted with ground wild angelica (golpar), sea salt, and a splash of homemade vinegar. Warm vintage street-lamp lighting, authentic cozy nostalgic snack, square format, 4K resolution --ar 1:1
```

#### 142. برش‌های هندوانه شیرین با پنیر و نعنا (Watermelon, Feta & Mint)
- **کالری تقریبی:** ۱۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant summer lifestyle food photography of a classic Persian afternoon snack. Crisp chilled ruby-red triangular slices of Persian seedless watermelon paired with cubes of salty white sheep's milk cheese and sprigs of fresh garden mint on a white ceramic plate. Bright summer sunshine, hydrating and sweet, square crop, 4K resolution --ar 1:1
```

---

### ۶.۷ نوشیدنی‌ها، شربت‌ها و دمنوش‌های سلامت (Herbal Drinks - نسبت ۱:۱ یا ۳:۴)

#### 143. دوغ سنتی نعناع و گل‌محمدی در پارچ و لیوان مسی (Doogh ba Na'na)
- **کالری تقریبی:** ۷۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary photography of traditional Persian Mint Doogh. A cold, frothy yogurt beverage served in a hammered vintage Iranian copper tumbler with ice cubes, garnished on the foam with dried crushed mint leaves, cracked pink rose petals, and a whole mint sprig. Water condensation beading down the copper surface on a wooden tavern table, refreshing natural lighting, probiotic digestive drink, square framing, 4K resolution --ar 1:1
```

#### 144. شربت خیار سکنجبین سنتی با سرکه طبیعی و عسل (Khiar Sekanjabin)
- **کالری تقریبی:** ۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Lifestyle drink photography of Persian Cucumber Sekanjabin. A tall, elegant ribbed glass filled with chilled ice water, thinly grated crisp Persian cucumbers, fresh mint sprigs, and traditional honey-vinegar syrup (sekanjabin). Sunbeams catching the golden-green effervescence and sparkling condensation, cooling summer elixir, square crop, 4K resolution --ar 1:1
```

#### 145. دمنوش آرام‌بخش گل‌گاوزبان با لیمو عمانی (Gol Gav Zaban Herbal Tea)
- **کالری تقریبی:** ۱۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Serene tea photography of Persian Borage Tea (Gol-Gavzaban). A steaming, clear glass teacup filled with a deep ruby-purple herbal infusion of dried Iranian borage blossoms and a pierced dried black lime, placed on a slate saucer with a single yellow saffron rock candy stick beside it. Soft cozy evening light, restorative calming mood, square format, 4K resolution --ar 1:1
```

#### 146. دمنوش زعفران، هل و بهارنارنج در استکان کمرباریک (Saffron & Orange Blossom Tea)
- **کالری تقریبی:** ۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Elegant tea photography of royal Persian Saffron Infusion. Steaming golden-amber tea brewed with whole green cardamom pods, dried sour orange blossoms (bahar narenj), and crimson saffron threads, served in an authentic traditional Iranian narrow-waisted glass cup (estekan kamar-barik) with a silver filigree saucer. Golden morning window rays, exquisite aroma, square framing, 4K resolution --ar 1:1
```

#### 147. شربت تخم شربتی و خاکشیر با گلاب و زعفران (Khakshir & Tokhm-e Sharbati)
- **کالری تقریبی:** ۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Refreshing culinary drink photography of Persian Chia & Descurainia Sophia Cooler (Khakshir & Tokhm-e Sharbati). A tall clear glass displaying two suspended layers of tiny hydrated basil seeds and golden flixweed seeds swirling in chilled water infused with Persian rosewater and a hint of saffron. Crushed ice and lemon wheels on top, sparkling bright sunlight, traditional gut-cooling summer tonic, square crop, 4K resolution --ar 1:1
```

#### 148. چای سبز لاهیجان با چوب دارچین و برگ لیمو (Lahijan Green Tea)
- **کالری تقریبی:** ۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan tea photography of Northern Iranian Lahijan Green Tea. A clear glass teapot brewing whole green tea leaves with a whole Ceylon cinnamon quill and fresh lemon leaves, surrounded by warm tea cups on a light wooden table. Soft morning mountain light, pure antioxidant metabolism drink, square format, 4K resolution --ar 1:1
```

#### 149. آب انار طبیعی و تازه دست‌افشار ساوه (Fresh Pomegranate Juice)
- **کالری تقریبی:** ۱۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial beverage photography of fresh Persian Pomegranate Juice. A crystal tumbler filled with vibrant, deep ruby-red cold-pressed pomegranate juice with ice cubes, surrounded by cracked fresh Saveh pomegranates spilling glossy seeds onto a marble slab. Bright studio light, rich antioxidant energy drink, square crop, 4K resolution --ar 1:1
```

#### 150. دمنوش زنجبیل، لیمو ترش و عسل کوهی (Ginger Lemon Honey Infusion)
- **کالری تقریبی:** ۳۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Healing wellness tea photograph. Steaming hot infusion of fresh sliced ginger root and lemon wheels in a ceramic mug, with a small jar of raw honeycomb and wooden honey dipper beside it on a sunlit table. Soft uplifting morning rays, comforting immune-boost beverage, square framing, 4K resolution --ar 1:1
```

---

### ۶.۸ غذاهای محلی، رژیمی و تخصصی مناطق ایران (Regional & Specialty Healthy Dishes - نسبت ۱:۱)

#### 151. کباب تابه‌ای رژیمی با گوجه فرنگی پخته و کته زعفرانی (Kabab Tabei)
- **کالری تقریبی:** ۴۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary food photography of healthy Persian pan kebab (Kabab Tabei). Lean minced beef and grated onion patties pan-seared with minimal olive oil, simmered in a rich roasted tomato and bell pepper sauce, served beside a mound of fluffy Persian Kateh rice dusted with sumac. Plated on a turquoise ceramic platter on a light wooden table, natural afternoon light, juicy delicious textures, square framing, 4K resolution --ar 1:1
```

#### 152. باقلاقاتوق اصیل گیلانی با شوید تازه و تخم‌مرغ عسلی (Baghali Ghatogh)
- **کالری تقریبی:** ۲۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic Northern Iranian food photography of Baghali Ghatogh. Tender skinless Persian fava beans (pacheh baghala) simmered with lots of fresh green dill, minced garlic, and turmeric, topped with two intact soft-cooked eggs with glossy warm runny yolks. Served in a traditional green-glazed earthenware Gamaj dish with smoked Kateh rice and garlic cloves, soft daylight, earthy culinary authenticity, square crop, 4K resolution --ar 1:1
```

#### 153. ترش تره گیلانی با سبزی‌های معطر و آب نارنج (Torsh-e Tareh)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Macro food photography of Northern Iranian Herb Stew (Torsh-e Tareh). A vibrant deep-green stew of spinach, parsley, coriander, chives, and garlic thickened with a whisked farm egg and seasoned with sour Seville orange juice (narenj). Plated in a rustic clay bowl alongside whole-wheat Sangak bread, bright natural light, fresh digestion-friendly meal, square format, 4K resolution --ar 1:1
```

#### 154. قلیه ماهی بوشهری با گشنیز، شنبلیله و تمبر هندی (Ghalieh Mahi)
- **کالری تقریبی:** ۳۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet Southern Iranian seafood photography of authentic Ghalieh Mahi. Steaks of fresh Persian Gulf King Mackerel fish simmered in a dark-green, intensely flavorful herb stew of fresh coriander, fenugreek, abundant garlic, and sour tamarind paste. Plated in a shallow terracotta bowl beside steamed basmati rice, warm atmospheric daylight, aromatic and zesty, square framing, 4K resolution --ar 1:1
```

#### 155. قلیه میگو تند و ترش خوزستانی با سیر فراوان (Ghalieh Meygoo)
- **کالری تقریبی:** ۳۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Dynamic food photograph of Southern Iranian Shrimp Ghalieh. Plump pink prawns cooked in a dark emerald herb sauce with tamarind, hot chili peppers, and garlic, garnished with fresh cilantro sprigs. Served with fluffy white rice, warm afternoon sun, exotic savory flavors, square crop, 4K resolution --ar 1:1
```

#### 156. کباب ترش گیلانی با رب انار و گردو در ایرفرایر (Kabab Torsh)
- **کالری تقریبی:** ۴۵۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial culinary photography of Northern Iranian Kabab Torsh. Tender cubes of sirloin steak marinated in finely crushed walnuts, aged pomegranate molasses, garlic, and wild mountain herbs (chochagh), roasted to succulent perfection with charred edges. Plated on a wooden board with grilled whole tomatoes and herbs, warm directional lighting, rich glossy sauce texture, square format, 4K resolution --ar 1:1
```

#### 157. شامی پوک لپه گیلانی با نان سنگک و ریحان (Shami Pook)
- **کالری تقریبی:** ۳۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of Caspian Split-Pea Patties (Shami Pook). Golden-brown, airy patties made from cooked yellow split peas, lean minced beef, eggs, and Persian spices, pan-crisped with a signature center hole. Served on a white ceramic platter with sliced fresh tomatoes, sweet red onions, and fresh sweet basil, bright natural daylight, crisp light texture, square crop, 4K resolution --ar 1:1
```

#### 158. آب‌دوغ‌خیار سنتی ییلاقی پرملات و خنک (Ab Doogh Khiar)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Refreshing summer lifestyle food photography of traditional Persian Cold Yogurt Soup (Ab Doogh Khiar). A large handmade blue ceramic bowl containing chilled, diluted probiotic yogurt mixed with finely diced Persian cucumbers, fragrant chopped fresh mint, basil and tarragon, dried pink rose petals, golden raisins, and crunchy walnut pieces, topped with broken crisps of traditional dry flatbread (Noon-e Khoshk). Dappled garden patio sunlight, cooling and revitalizing, square framing, 4K resolution --ar 1:1
```

#### 159. کال‌کباب اصیل گیلانی با بادمجان کبابی و گردو (Kal Kabab)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan macro food photo of Gilani Kal Kabab. Smoky mashed charcoal-grilled eggplants mixed with finely pulverized Persian walnuts, garlic paste, sour wild pomegranate juice, and dried local mint. Served in a shallow clay dish with warm bread crisps and radish slices, soft daylight, rustic rich texture, square crop, 4K resolution --ar 1:1
```

#### 160. خورش خلال بادام مجلسی کرمانشاهی با زرشک سیاه (Khoresht Khelal)
- **کالری تقریبی:** ۴۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Luxury Persian culinary food photography of Kermanshahi Khoresht Khelal. A glistening ruby-golden stew loaded with tender julienned raw almonds, succulent lean lamb cubes, whole dried black limes, and tart wild black mountain barberries (Zereshk Siah) in a fragrant saffron-rosewater broth. Served with saffron basmati rice on an antique patterned platter, warm cinematic lighting, royal Persian banquet look, square framing, 4K resolution --ar 1:1
```

#### 161. قیمه نثار سنتی قزوین با گوشت راسته و خلال پسته (Gheimeh Nesar)
- **کالری تقریبی:** ۵۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Celebratory food photography of Qazvini Gheimeh Nesar. A spectacular mound of aromatic saffron basmati rice encasing tender spiced lamb, lavishly decorated on top with glowing ribbons of candied orange peel, ruby-red barberries, emerald slivered pistachios, and golden slivered almonds. Plated on an ornate Persian serving dish, bright directional daylight, dazzling royal culinary display, square format, 4K resolution --ar 1:1
```

#### 162. بزقورمه کرمانی کم‌چرب با کشک و سیرداغ (Bozghormeh)
- **کالری تقریبی:** ۳۷۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic regional food photography of Kerman Bozghormeh. Slow-simmered tender lamb shank and chickpea stew pounded and blended with rich cultured whey (kashk), garlic, and saffron, garnished with caramelized onions, fried dried mint, and raw walnut halves. Plated in a rustic bowl with warm flatbread, soft warm daylight, comforting deeply savory dish, square crop, 4K resolution --ar 1:1
```

#### 163. بریانی اصفهان رژیمی با گوشت لخم و نان سنگک (Beryani Esfahan)
- **کالری تقریبی:** ۴۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Authentic documentary food photograph of Esfahani Beryani. Seasoned lean minced lamb roasted on a traditional copper griddle to a golden-brown crust with delicate cinnamon and saffron aromas, served over a soft piece of sesame Sangak bread soaked lightly in clear meat broth, topped with slivered almonds and fresh basil. Warm ambient market lighting, rich historic culinary culture, square framing, 4K resolution --ar 1:1
```

#### 164. حلیم بادمجان اصفهانی با کشک و گردوی فراوان (Haleem Bademjan)
- **کالری تقریبی:** ۳۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Editorial food photography of Persian Eggplant Haleem. Shredded slow-cooked lean lamb and mashed tender eggplants whipped together with thick cultured whey into a silky, stringy texture, artfully decorated with mint oil swirls, golden garlic chips, and whole walnut halves. Served with fresh whole-wheat flatbread, soft side-window daylight, sumptuous comforting texture, square crop, 4K resolution --ar 1:1
```

#### 165. دمی بلغور گندم و عدس سنتی روستایی (Dami Balghoor)
- **کالری تقریبی:** ۲۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Rustic wholesome food photography of Persian Cracked Wheat and Lentil Pilaf (Dami Balghoor). Steamed whole cracked wheat bulgur cooked with brown lentils, caramelized onions, and cumin seeds, served with a side bowl of fresh probiotic yogurt and a herb salad. Served in an earthy stoneware bowl on raw timber, warm rural daylight, fiber-rich ancestral health food, square format, 4K resolution --ar 1:1
```

#### 166. شوید پلو با تن ماهی کم‌نمک در آب‌نمک (Shevid Polo ba Ton Mahi)
- **کالری تقریبی:** ۳۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Healthy fitness meal photography of Persian Dill Rice with Tuna. Fragrant steamed basmati rice with abundant fresh green dill, paired with flaky chunks of low-sodium skipjack tuna in spring water, roasted cherry tomatoes, and fresh lemon wedges. Served on a minimalist ceramic plate, bright clean morning daylight, high-protein clean eating aesthetic, square crop, 4K resolution --ar 1:1
```

#### 167. خوراک قفقازی سبزیجات رژیمی با سس ماست و گردو (Khorak Ghafghazi)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Vibrant culinary food photography of Persian Caucasian Vegetable Medley. Sautéed tender string beans, carrot batons, zucchini, and baby eggplants tossed with shredded boiled chicken breast, coated in a light garlic-walnut yogurt sauce. Plated on a modern rectangular dish with chopped parsley, bright diffuse daylight, crisp and colorful, square framing, 4K resolution --ar 1:1
```

#### 168. سالاد الویه رژیمی با سس ماست یونانی و سینه مرغ (Diet Olivier Salad)
- **کالری تقریبی:** ۲۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial deli food photography of healthy Persian Olivier Salad. Cubed boiled potatoes, shredded tender chicken breast, hard-boiled egg whites, green sweet peas, and finely diced pickled cucumbers, gently bound with a light dressing of Greek yogurt, a touch of Dijon mustard and olive oil, molded into an elegant dome and decorated with sliced boiled eggs and parsley sprigs on an ivory plate. Clean studio light, creamy appetizing texture, square format, 4K resolution --ar 1:1
```

#### 169. کوکو گردو و مرغ رژیمی مازندرانی (Kuku Gerdoo)
- **کالری تقریبی:** ۳۲۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of Caspian Walnut and Chicken Kuku. Baked frittata made with finely ground walnuts, shredded poached chicken breast, wild sour pomegranate reduction, and eggs, resulting in a dark, rich, savory herb cake. Served on a stoneware plate with fresh mint leaves and pomegranate arils, warm directional lighting, unique regional cuisine, square crop, 4K resolution --ar 1:1
```

#### 170. دلمه کلم برگ تبریزی با زرشک و چاشنی سرکه شیره (Dolmeh Kalam)
- **کالری تقریبی:** ۲۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Gourmet regional food photography of Azerbaijani Stuffed Cabbage Rolls. Tender leaves of blanched white cabbage stuffed with a savory filling of aromatic herbed rice, yellow split peas, and minced lean beef, rolled into parcels and simmered in a sweet-and-sour plum glaze. Plated on an ornate ceramic dish, garnished with sautéed barberries, warm daylight, square framing, 4K resolution --ar 1:1
```

#### 171. کباب برگ سلطانی رژیمی با چلو زعفرانی و گوجه (Kabab Barg)
- **کالری تقریبی:** ۵۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial luxury food photography of Persian Kabab Barg. A wide, tender strip of premium lean lamb tenderloin marinated in grated onion and saffron, charcoal-grilled to succulent medium tenderness, laid over aromatic basmati rice with a grilled plum tomato and sumac dusting. Plated on fine tableware on dark wood, 45-degree angle, juicy meat grain visible, natural light, square crop, 4K resolution --ar 1:1
```

#### 172. مرغ شکم‌پر مازندرانی با سبزی اناری و آلو (Morgh-e Shekampor)
- **کالری تقریبی:** ۴۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Festive Iranian culinary photography of Northern Roasted Stuffed Chicken. A whole roasted organic spring chicken with golden-crisp skin, stuffed with a fragrant stuffing of crushed walnuts, wild pomegranate molasses, prunes, and mountain herbs (anari sabzi), garnished with fresh Seville orange halves and parsley on a vintage serving platter, warm ambient lighting, festive feast, square format, 4K resolution --ar 1:1
```

#### 173. ته چین اسفناج و فیله مرغ رژیمی (Tahchin Esfenaj)
- **کالری تقریبی:** ۴۳۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan food photography of Persian Spinach and Saffron Rice Cake (Tahchin Esfenaj). A square slice of golden-crusted saffron rice cake revealing inner layers of tender sautéed baby spinach, garlic, and seasoned chicken breast fillet, garnished on top with barberries and walnut pieces. Served on a ceramic dish, warm side-studio light, crisp rice crust detail, square crop, 4K resolution --ar 1:1
```

#### 174. خوراک میگو گریل شده با سس سیر، لیمو و سبزیجات (Grilled Persian Gulf Shrimp)
- **کالری تقریبی:** ۲۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Commercial seafood food photography of jumbo Persian Gulf prawns. Skewered large prawns marinated in saffron, crushed garlic, lime juice, and olive oil, char-grilled with grill marks, served over a bed of steamed asparagus and baby zucchini with fresh lemon halves. Clean white porcelain plate, bright natural daylight, succulent and lean, square framing, 4K resolution --ar 1:1
```

#### 175. شیربرنج سنتی کم‌شیرین با گلاب، هل و شیره انگور (Shir Berenj)
- **کالری تقریبی:** ۱۸۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Serene lifestyle food photography of traditional Persian Rice Pudding (Shir Berenj). Creamy, fragrant short-grain rice cooked softly in fresh milk with rosewater and ground cardamom, served warm in a shallow white ceramic bowl, artfully drizzled with a ribbon of amber grape molasses (shireh) and dusted with crushed pistachios and cinnamon. Soft morning sunlight, comforting pure dessert, square crop, 4K resolution --ar 1:1
```

#### 176. سمنوی اصیل جوانه گندم بدون شکر افزوده (Samanu)
- **کالری تقریبی:** ۱۶۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Macro food photography of ancient Persian sprouted wheat pudding (Samanu). Thick, glossy, rich dark-amber pudding made purely from sprouted wheat malt and flour with no added sugar, served in a traditional handcrafted earthenware cup, topped with whole raw Persian almonds and a pistachio. Warm natural morning rays, velvety rich texture, authentic Nowruz heritage, square format, 4K resolution --ar 1:1
```

#### 177. شله‌زرد کم‌کالری با زعفران قائنات، دارچین و خلال بادام (Sholeh Zard)
- **کالری تقریبی:** ۱۹۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Exquisite traditional food photography of Persian Saffron Rice Pudding (Sholeh Zard). A shallow crystal bowl containing luminous, bright golden-yellow saffron rice pudding infused with rosewater and cardamom, intricately decorated on the surface with geometric lines of fragrant ground cinnamon powder, slivered green pistachios, and raw almond slivers. Soft ambient daylight, jewel-like glistening surface, square framing, 4K resolution --ar 1:1
```

#### 178. فالوده شیرازی اصیل با آبلیموی تازه جهرم (Faloodeh Shirazi)
- **کالری تقریبی:** ۱۴۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Refreshing culinary dessert photo of authentic Shirazi Faloodeh. Chilled, semi-frozen thin starch vermicelli noodles in a light sweet rosewater granita, drizzled with freshly squeezed sour lime juice from Jahrom and a splash of pure sour cherry syrup (sharbat-e albaloo) in an antique glass dessert cup. Sparkling ice crystals, bright afternoon light, delightfully cooling texture, square crop, 4K resolution --ar 1:1
```

#### 179. کمپوت سیب و دارچین خانگی بدون شکر (Stewed Cinnamon Apples)
- **کالری تقریبی:** ۸۵ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Home-style wellness dessert photography of tender poached Persian apples. Golden apple quarters simmered gently in water infused with whole Ceylon cinnamon sticks and rosewater, served in a glass bowl with a light drizzle of honey and crushed walnuts. Warm cozy kitchen lighting, gentle digestive comfort, square format, 4K resolution --ar 1:1
```

#### 180. حلوا هویج سنتی ارومیه با عسل و خلال پسته (Halva Havij)
- **کالری تقریبی:** ۲۱۰ کیلوکالری
- **پرامپت نانو بنانا:**
```text
Artisan culinary dessert photography of Azerbaijani Carrot Halva. Translucent, bright orange grated sweet carrots slow-caramelized with raw honey, cardamom, and saffron, generously studded with raw walnuts and green pistachios. Plated on a small patterned brass dish, soft warm light, rich chewy texture, square framing, 4K resolution --ar 1:1
```

---

## ۴. راهنمای گام‌به‌گام اجرایی و دستورات Batch Generation در Nano Banana

برای اینکه بهترین نتیجه را هنگام تولید این تصاویر با **Nano Banana (یا Google Gemini Imagen / Flash Image)** بگیرید، نکات عملیاتی زیر را دنبال کنید:

### ۱. دستورات خط فرمان و پارامترهای کلیدی (Parameters Cheat-Sheet)
- **نسبت تصویر (Aspect Ratio):** 
  - برای غذاها، صبحانه‌ها، میان‌وعده‌ها و آیکون‌ها: `--ar 1:1`
  - برای پرتره پزشکان و متخصصین: `--ar 4:5`
  - برای بنرهای هیرو و کارت‌های اینترو: `--ar 3:2` یا `--ar 16:9`
  - برای کارت‌های هدف رژیم (Diptych): `--ar 2:1`
- **رزولوشن خروجی (Resolution):** حتماً از عبارت `4K resolution` یا تنظیم سوییچ `2K / 4K` در پنل استفاده کنید تا جزئیات بافت دانه‌های برنج، سبزیجات و قطرات آب تار نشوند.
- **استفاده از عبارت کلیدی ضد مصنوعی بودن:**
  > `Photorealistic, authentic documentary food photography, natural lighting, true-to-life appetizing colors, no CGI look, no oversaturation, no stock-photo plastic sheen.`

### ۲. تکنیک زنجیره ویرایش (Iterative Editing Workflow)
اگر یک عکس خوب درآمد اما مثلاً می‌خواهید ته‌دیگ برنج طلایی‌تر شود یا سبزی خوردن بیشتر باشد:
1. **تصویر اولیه را به عنوان Reference آپلود کنید.**
2. **فقط تغییر مورد نظر را دستور دهید:**
   - مثال: *"Keep the exact same lighting, wooden table, and ceramic plate from the reference image, but make the rice Tahdig slightly more golden-brown and add a fresh lemon wedge."*
   - از پرامپت‌نویسی مجدد از صفر خودداری کنید تا پیوستگی استایل به هم نخورد.

### ۳. مدیریت ساختار فایل‌ها و ذخیره‌سازی در پروژه
تصاویر تولید شده را با نام‌های منظم در پوشه‌های مربوطه قرار دهید:
- `demo/assets/`: تصاویر کوییز و دمو (`intro-*.jpg`, `goal-*.jpg`, `doctor-demo-*.jpg`)
- `site/assets/`: تصاویر وب‌سایت (`salad.jpg`, `breakfast.jpg`, `vegetables.jpg`, `bowl.jpg`)
- `app/assets/foods/`: تصاویر کاتالوگ ۲۰۰تایی غذاهای ایرانی برای لود سریع در کش اپلیکیشن فلاتر

---
*تهیه شده به عنوان مستند رسمی مهندسی پرامپت و دیزاین سیستم هوش مصنوعی رژیم من.*
