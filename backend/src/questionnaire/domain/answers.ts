export const AI_SKIP_FLAGS = ['eating_disorder_history', 'high_risk_pregnancy', 'kidney', 'unintentional_weight_loss'] as const;

export interface StoredAnswers {
  name: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  goal: string;
  lifeStage: string;
  pregnancyWeek: number | null;
  prePregnancyWeightKg: number | null;
  babies: string | null;
  nursingAge: string | null;
  targetWeightKg: number | null;
  previousDiet: string;
  health: string[];
  healthDetails: string;
  allergies: string;
  medicines: string;
  activity: string;
  exercise: string;
  sleep: string;
  mealPattern: string;
  water: string;
  preference: string;
  budget: string;
  cooking: string;
  dislikes: string;
}

