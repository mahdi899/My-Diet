-- Up Migration
CREATE TABLE articles (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 64),
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  version integer NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  category text NOT NULL,
  image_index integer NOT NULL CHECK (image_index BETWEEN 0 AND 3),
  reading_minutes integer NOT NULL CHECK (reading_minutes BETWEEN 1 AND 60),
  intro text NOT NULL,
  sections jsonb NOT NULL,
  position integer NOT NULL,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT articles_publish_pair CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE INDEX articles_public ON articles (status, position);

CREATE TABLE article_versions (
  article_id uuid NOT NULL REFERENCES articles (id),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  title text NOT NULL,
  category text NOT NULL,
  image_index integer NOT NULL,
  reading_minutes integer NOT NULL,
  intro text NOT NULL,
  sections jsonb NOT NULL,
  actor_id uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, version)
);

CREATE TABLE consent_documents (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose ~ '^[a-z][a-z0-9_]{1,40}$'),
  version integer NOT NULL CHECK (version >= 1),
  summary text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purpose, version),
  CONSTRAINT consent_publish_pair CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE TABLE consent_records (
  user_id uuid NOT NULL REFERENCES users (id),
  purpose text NOT NULL,
  version integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, purpose, version),
  FOREIGN KEY (purpose, version) REFERENCES consent_documents (purpose, version)
);

CREATE TABLE public_config_versions (
  version integer PRIMARY KEY CHECK (version >= 1),
  min_app_version text NOT NULL,
  download_status text NOT NULL CHECK (download_status IN ('not_released', 'released')),
  download_url text,
  actor_id uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_config_url CHECK (
    (download_status = 'not_released' AND download_url IS NULL)
    OR (download_status = 'released' AND download_url IS NOT NULL)
  )
);

INSERT INTO public_config_versions (version, min_app_version, download_status, download_url)
VALUES (1, '1.0.0', 'not_released', NULL);

INSERT INTO consent_documents (id, purpose, version, summary, status, published_at) VALUES
  ('019a1200-0000-7000-8000-000000000101', 'terms', 1, 'شرایط استفاده از سبزینه', 'published', now()),
  ('019a1200-0000-7000-8000-000000000102', 'health_data', 1, 'اجازهٔ نگهداری پاسخ‌های سلامتی برای ساخت برنامه', 'published', now());

INSERT INTO articles (
  id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, position, published_at
) VALUES
  ('019a1200-0000-7000-8000-000000000001', 'weekly-planning', 'published', 1,
   'یک هفته غذای خوب؛ بدون سردرگمی', 'برنامه‌ریزی غذایی', 1, 5,
   'از خرید مواد اولیه تا انتخاب وعده‌ها؛ چطور برای روزهای شلوغ، تصمیم‌های ساده‌تری بگیریم؟',
   '[{"heading":"از برنامهٔ واقعی هفته شروع کن","body":"پیش از انتخاب غذا، به روزهای پیش رو نگاه کن. کدام روز وقت آشپزی داری و کدام وعده بیرون از خانه است؟"},{"heading":"چند انتخاب آشنا داشته باش","body":"غذاهایی را بنویس که دوست داری و با روش تهیهٔ آن‌ها آشنایی داری."}]'::jsonb,
   1, now()),
  ('019a1200-0000-7000-8000-000000000002', 'balanced-plate', 'published', 1,
   'بشقاب متعادل از کجا شروع می‌شود؟', 'تغذیه سالم', 0, 4,
   'نگاهی ساده به تنوع غذاها و ساختن بشقابی که با سلیقه و زندگی روزمره‌ات هماهنگ باشد.',
   '[{"heading":"تنوع را روی میز ببین","body":"به مواد اولیهٔ متفاوت و روش آماده‌سازی آن‌ها توجه کن."},{"heading":"مقدارها را از برنامه بخوان","body":"اگر برنامهٔ شخصی داری، اندازه‌ها را از همان برنامه دنبال کن."}]'::jsonb,
   2, now()),
  ('019a1200-0000-7000-8000-000000000003', 'small-habits', 'published', 1,
   'عادت‌های کوچک برای روزهای پرمشغله', 'سبک زندگی', 2, 6,
   'برای مراقبت از خودت همیشه به تغییرهای بزرگ نیاز نداری؛ از یک قدم کوچک شروع کن.',
   '[{"heading":"یک قدم مشخص انتخاب کن","body":"به جای یک فهرست طولانی، یک کار روشن و قابل انجام انتخاب کن."}]'::jsonb,
   3, now()),
  ('019a1200-0000-7000-8000-000000000004', 'shopping-list', 'published', 1,
   'یک فهرست خرید، چند وعدهٔ متفاوت', 'برنامه‌ریزی غذایی', 3, 4,
   'چطور مواد اولیهٔ مشترک، آشپزی در طول هفته را ساده‌تر می‌کنند؟',
   '[{"heading":"مواد مشترک را کنار هم بگذار","body":"مواد اولیهٔ مشترک فهرست خرید را منظم‌تر می‌کنند."}]'::jsonb,
   4, now()),
  ('019a1200-0000-7000-8000-000000000005', 'food-variety', 'published', 1,
   'رنگ‌های بیشتر، انتخاب‌های متنوع‌تر', 'تغذیه سالم', 1, 3,
   'تنوع در آشپزخانه با آشنا شدن با مواد اولیه و روش‌های آماده‌سازی شروع می‌شود.',
   '[{"heading":"از مواد آشنا شروع کن","body":"تنوع با مواد اولیه و روش‌های آماده‌سازی که می‌شناسی شروع می‌شود."}]'::jsonb,
   5, now()),
  ('019a1200-0000-7000-8000-000000000006', 'mindful-meals', 'published', 1,
   'برای وعدهٔ غذایی‌ات کمی وقت بگذار', 'سبک زندگی', 0, 5,
   'چند پیشنهاد برای اینکه در میان کارهای روزانه، زمان غذا خوردن را فراموش نکنیم.',
   '[{"heading":"زمان غذا را در روز جا بده","body":"در میان کارهای روزانه، زمانی را برای وعده مشخص کن."}]'::jsonb,
   6, now());

INSERT INTO article_versions (article_id, version, status, title, category, image_index, reading_minutes, intro, sections)
SELECT id, version, status, title, category, image_index, reading_minutes, intro, sections FROM articles;

-- Down Migration
DROP TABLE consent_records;
DROP TABLE consent_documents;
DROP TABLE article_versions;
DROP TABLE articles;
DROP TABLE public_config_versions;
