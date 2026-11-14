-- Up Migration
-- Iranian food catalogue. Calories and ingredients per one stated household serving.
-- Plan drafts are composed from these rows, so calories never come from model guesses.
CREATE TABLE food_catalog (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name_fa text NOT NULL,
  category text NOT NULL CHECK (category IN
    ('breakfast', 'main', 'side', 'soup', 'salad', 'protein', 'carb', 'dairy', 'fruit', 'snack', 'drink', 'dessert')),
  meal_types text[] NOT NULL,
  serving_label text NOT NULL,
  serving_g integer,
  kcal integer NOT NULL CHECK (kcal >= 0 AND kcal <= 3000),
  protein_g numeric(5, 1) NOT NULL DEFAULT 0,
  carbs_g numeric(5, 1) NOT NULL DEFAULT 0,
  fat_g numeric(5, 1) NOT NULL DEFAULT 0,
  fiber_g numeric(4, 1) NOT NULL DEFAULT 0,
  allergens text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  seasons text[] NOT NULL DEFAULT '{}',
  cost_tier smallint NOT NULL DEFAULT 2 CHECK (cost_tier BETWEEN 1 AND 3),
  prep_minutes smallint NOT NULL DEFAULT 20 CHECK (prep_minutes >= 0),
  ingredients jsonb NOT NULL,
  image text,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Persian word search without extensions: 'simple' tokenizer + prefix queries.
CREATE INDEX food_catalog_search ON food_catalog USING gin (to_tsvector('simple', name_fa));
CREATE INDEX food_catalog_tags ON food_catalog USING gin (tags);
CREATE INDEX food_catalog_allergens ON food_catalog USING gin (allergens);
CREATE INDEX food_catalog_meals ON food_catalog USING gin (meal_types);
CREATE INDEX food_catalog_category ON food_catalog (category, kcal) WHERE active;

-- Down Migration
DROP TABLE food_catalog;
