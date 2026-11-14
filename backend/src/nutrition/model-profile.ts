import type { MealSlot } from './engine.js';

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

