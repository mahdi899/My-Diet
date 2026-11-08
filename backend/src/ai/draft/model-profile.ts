import type { Pool } from 'pg';
import { mealSlots, type MealSlot } from '../../nutrition/engine.js';

/**
 * Everything the model may know about the person, as codes and numbers only.
 * No name, phone, user id or free text; free text travels separately as untrusted blocks.
 */
export interface ModelProfile {
  track: 'weight_loss' | 'weight_gain' | 'pregnancy' | 'detox';
  sex: 'female' | 'male';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  bmi: number;
  energy: {
    targetKcal: number;
    bmrKcal: number;
    tdeeKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  slots: MealSlot[];
  dietStyle: 'omnivore' | 'vegetarian' | 'vegan';
  allergens: string[];
  conditions: string[];
  budget: string;
  region: string | null;
  safetyTier: 'ai_ok' | 'doctor_only';
  preferences: Record<string, unknown>;
}

interface Row {
  track: ModelProfile['track'];
  sex: string;
  age: number;
  height_cm: string;
  weight_kg: string;
  target_weight_kg: string | null;
  bmi: string;
  bmr_kcal: number;
  tdee_kcal: number;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  diet_style: ModelProfile['dietStyle'];
  meals_per_day: number | null;
  budget: string;
  region: string | null;
  allergens: string[];
  conditions: string[];
  safety_tier: 'ai_ok' | 'doctor_only';
  preferences: Record<string, unknown>;
}

/** The typed profile written at onboarding. Null when the user never completed onboarding. */
export async function loadModelProfile(pool: Pool, userId: string): Promise<ModelProfile | null> {
  const { rows } = await pool.query<Row>(
    `select track, sex, age, height_cm::text, weight_kg::text, target_weight_kg::text, bmi::text, bmr_kcal, tdee_kcal,
            target_kcal, protein_g, carbs_g, fat_g, diet_style, meals_per_day, budget, region, allergens, conditions,
            safety_tier, preferences
     from nutrition_profiles where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  const sleep = row.preferences.sleep_wake as { wake?: number } | undefined;
  return {
    track: row.track,
    sex: row.sex === 'male' ? 'male' : 'female',
    age: row.age,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    targetWeightKg: row.target_weight_kg == null ? null : Number(row.target_weight_kg),
    bmi: Number(row.bmi),
    energy: {
      targetKcal: row.target_kcal,
      bmrKcal: row.bmr_kcal,
      tdeeKcal: row.tdee_kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    slots: mealSlots(row.target_kcal, row.meals_per_day, sleep?.wake ?? null),
    dietStyle: row.diet_style,
    allergens: row.allergens,
    conditions: row.conditions,
    budget: row.budget,
    region: row.region,
    safetyTier: row.safety_tier,
    preferences: row.preferences,
  };
}
