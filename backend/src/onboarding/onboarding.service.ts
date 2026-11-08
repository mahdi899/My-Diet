import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../common/errors.js';
import { decryptText, encryptText, openAnswers } from '../common/field-crypto.js';
import { audit, withTransaction } from '../common/sql.js';
import { uuidv7 } from '../common/id.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { QuestionnaireService } from '../questionnaire/questionnaire.service.js';
import { validateSubmission, type StoredAnswers } from '../questionnaire/schema.js';
import { canonicalToSubmission, legacyToCanonical, profilePreferences, type LegacyAnswer } from './mapper.js';
import { deriveProfile, factsOf, trackOfStored, type DerivedProfile } from './profile.js';
import {
  ONBOARDING_SPEC_VERSION,
  SPEC_QUESTIONS,
  SPEC_TRACKS,
  onboardingSpecView,
  missingRequired,
  questionByKey,
  type AnswerValue,
  type CanonicalAnswers,
  type TrackId,
} from './spec.js';

const FREE_TEXT_KEYS = new Set<string>([
  ...SPEC_QUESTIONS.filter((question) => question.kind === 'text').map((question) => question.key),
  ...SPEC_QUESTIONS.flatMap((question) => (question.followUp ? [question.followUp.key] : [])),
]);
const ALLOWED_KEYS = new Set<string>([...SPEC_QUESTIONS.map((question) => question.key), ...FREE_TEXT_KEYS, 'age_approx']);
const TRACKS = new Set<string>(SPEC_TRACKS.map((track) => track.id));

export type OnboardingNextStep = 'start' | 'resume' | 'gaps' | 'consent' | 'enter_app';

interface DraftRow {
  spec_version: number;
  track: TrackId | null;
  answers: CanonicalAnswers;
  step_key: string | null;
  progress: number;
  source: 'app' | 'demo';
  version: number;
  updated_at: Date;
}

interface SubmissionRow {
  id: string;
  answers: unknown;
  risk_flags: string[];
}

interface ProfileRow {
  track: TrackId;
  source: 'app' | 'demo';
  goal: string;
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
  diet_style: string;
  allergens: string[];
  conditions: string[];
  risk_flags: string[];
  safety_tier: 'ai_ok' | 'doctor_only';
  safety_reasons: string[];
  preferences: Record<string, unknown>;
  consented_at: Date | null;
  submission_id: string;
}

function validationError(message: string): ApiError {
  return new ApiError(400, 'validation', message);
}

export function sealCanonical(answers: CanonicalAnswers, secret: string): CanonicalAnswers {
  const out: CanonicalAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    out[key] = typeof value === 'string' && FREE_TEXT_KEYS.has(key) ? encryptText(value, secret) : value;
  }
  return out;
}

export function openCanonical(answers: CanonicalAnswers, secret: string): CanonicalAnswers {
  const out: CanonicalAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    out[key] = typeof value === 'string' && FREE_TEXT_KEYS.has(key) ? decryptText(value, secret) : value;
  }
  return out;
}

/** Validates one patch value against the spec. `null` removes the answer. */
function cleanValue(key: string, value: unknown): AnswerValue | undefined {
  if (value === null) return null;
  const question = questionByKey(key);
  if (FREE_TEXT_KEYS.has(key) || question?.kind === 'text') {
    if (typeof value !== 'string' || value.length > 500) throw validationError('متن واردشده معتبر نیست');
    return value.trim();
  }
  if (!question) {
    if (key === 'age_approx' && value === 'yes') return 'yes';
    throw validationError('پاسخ ناشناخته');
  }
  const codes = new Set((question.options ?? []).map((option) => option.code));
  switch (question.kind) {
    case 'number':
    case 'age': {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw validationError('عدد واردشده معتبر نیست');
      if ((question.min != null && value < question.min) || (question.max != null && value > question.max)) {
        throw validationError(`مقدار «${question.title}» خارج از بازهٔ مجاز است`);
      }
      return Math.round(value * 10) / 10;
    }
    case 'single': {
      if (typeof value !== 'string' || !codes.has(value)) throw validationError('گزینهٔ انتخابی معتبر نیست');
      return value;
    }
    case 'multi':
    case 'dish_picker': {
      if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== 'string' || !codes.has(item))) {
        throw validationError('گزینه‌های انتخابی معتبر نیستند');
      }
      return [...new Set(value as string[])];
    }
    case 'sleep_wake': {
      const record = value as { sleep?: unknown; wake?: unknown } | null;
      if (
        !record ||
        typeof record !== 'object' ||
        !Number.isInteger(record.sleep) ||
        !Number.isInteger(record.wake) ||
        (record.sleep as number) < 0 ||
        (record.sleep as number) > 23 ||
        (record.wake as number) < 0 ||
        (record.wake as number) > 23
      ) {
        throw validationError('ساعت خواب و بیداری معتبر نیست');
      }
      return { sleep: record.sleep as number, wake: record.wake as number };
    }
    default:
      throw validationError('پاسخ معتبر نیست');
  }
}

function summarize(row: ProfileRow) {
  return {
    track: row.track,
    source: row.source,
    bmi: Number(row.bmi),
    weightKg: Number(row.weight_kg),
    targetWeightKg: row.target_weight_kg == null ? null : Number(row.target_weight_kg),
    heightCm: Number(row.height_cm),
    age: row.age,
    bmrKcal: row.bmr_kcal,
    tdeeKcal: row.tdee_kcal,
    targetKcal: row.target_kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    safetyTier: row.safety_tier,
    safetyReasons: row.safety_reasons,
    dietStyle: row.diet_style,
    consented: row.consented_at != null,
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
    private readonly questionnaires: QuestionnaireService,
  ) {}

  spec() {
    return onboardingSpecView();
  }

  // ----------------------------------------------------------------- state

  /**
   * The single entry decision after login:
   * - a stored submission means the user is done (profile derived on demand for older accounts);
   * - otherwise an unclaimed demo lead for the verified phone is imported;
   * - otherwise the saved draft decides between resume and a fresh start.
   */
  async state(userId: string) {
    let claimedFromDemo = false;
    let latest: SubmissionRow | null = await this.latestSubmission(userId);
    if (!latest) {
      // A draft the user already started in the app is never overwritten by an old demo lead.
      claimedFromDemo = (await this.draftRow(userId)) ? false : await this.claimDemoLead(userId);
      latest = claimedFromDemo ? await this.latestSubmission(userId) : null;
    }
    if (latest) {
      let profile = await this.profileRow(userId);
      if (!profile || profile.submission_id !== latest.id) profile = await this.ensureProfile(userId);
      return {
        specVersion: ONBOARDING_SPEC_VERSION,
        status: 'complete' as const,
        nextStep: (profile?.consented_at ? 'enter_app' : 'consent') as OnboardingNextStep,
        claimedFromDemo,
        track: profile?.track ?? null,
        missing: [] as string[],
        draft: null,
        profile: profile ? summarize(profile) : null,
      };
    }
    const draft = await this.draftRow(userId);
    if (!draft) {
      return {
        specVersion: ONBOARDING_SPEC_VERSION,
        status: 'none' as const,
        nextStep: 'start' as OnboardingNextStep,
        claimedFromDemo: false,
        track: null,
        missing: [] as string[],
        draft: null,
        profile: null,
      };
    }
    const answers = openCanonical(draft.answers, this.env.FIELD_KEY);
    const missing = draft.track ? missingRequired(draft.track, answers) : [];
    return {
      specVersion: ONBOARDING_SPEC_VERSION,
      status: draft.source === 'demo' ? ('needs_gaps' as const) : ('in_progress' as const),
      nextStep: (draft.source === 'demo' ? 'gaps' : 'resume') as OnboardingNextStep,
      claimedFromDemo: draft.source === 'demo',
      track: draft.track,
      missing,
      draft: {
        answers,
        stepKey: draft.step_key,
        progress: draft.progress,
        version: draft.version,
        updatedAt: draft.updated_at.toISOString(),
        source: draft.source,
      },
      profile: null,
    };
  }

  // ----------------------------------------------------------------- draft

  async saveDraft(
    userId: string,
    input: { track?: unknown; patch?: unknown; stepKey?: unknown; progress?: unknown; baseVersion?: unknown },
  ) {
    const track = input.track == null ? null : String(input.track);
    if (track != null && !TRACKS.has(track)) throw validationError('هدف انتخابی معتبر نیست');
    const patchRaw = input.patch == null ? {} : input.patch;
    if (typeof patchRaw !== 'object' || Array.isArray(patchRaw)) throw validationError('پاسخ‌ها معتبر نیستند');
    const patch: CanonicalAnswers = {};
    for (const [key, value] of Object.entries(patchRaw as Record<string, unknown>)) {
      if (!ALLOWED_KEYS.has(key)) throw validationError('پاسخ ناشناخته');
      const cleaned = cleanValue(key, value);
      patch[key] = cleaned === undefined ? null : cleaned;
    }
    const stepKey = typeof input.stepKey === 'string' ? input.stepKey.slice(0, 64) : null;
    const progress =
      typeof input.progress === 'number' && Number.isFinite(input.progress)
        ? Math.max(0, Math.min(100, Math.round(input.progress)))
        : null;
    const baseVersion = Number.isInteger(input.baseVersion) ? (input.baseVersion as number) : null;

    return withTransaction(this.pool, async (client) => {
      const current = await client.query<DraftRow>(
        `select spec_version, track, answers, step_key, progress, source, version, updated_at
         from onboarding_drafts where user_id = $1 for update`,
        [userId],
      );
      const row = current.rows[0];
      if (row && baseVersion != null && baseVersion !== row.version) {
        throw new ApiError(409, 'draft_conflict', 'پیش‌نویس روی دستگاه دیگری تغییر کرده است');
      }
      const merged: CanonicalAnswers = { ...(row?.answers ?? {}) };
      for (const [key, value] of Object.entries(sealCanonical(patch, this.env.FIELD_KEY))) {
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      const nextTrack = (track ?? row?.track ?? null) as TrackId | null;
      const saved = await client.query<{ version: number; updated_at: Date }>(
        `insert into onboarding_drafts (user_id, spec_version, track, answers, step_key, progress, source)
         values ($1, $2, $3, $4::jsonb, $5, coalesce($6, 0), 'app')
         on conflict (user_id) do update set
           track = excluded.track,
           answers = excluded.answers,
           step_key = coalesce($5, onboarding_drafts.step_key),
           progress = coalesce($6, onboarding_drafts.progress),
           spec_version = excluded.spec_version,
           version = onboarding_drafts.version + 1,
           updated_at = now()
         returning version, updated_at`,
        [userId, ONBOARDING_SPEC_VERSION, nextTrack, JSON.stringify(merged), stepKey, progress],
      );
      return { version: saved.rows[0]!.version, updatedAt: saved.rows[0]!.updated_at.toISOString() };
    });
  }

  // ---------------------------------------------------------------- submit

  async submit(userId: string, input: { patch?: unknown; consent?: unknown }) {
    if (input.patch != null) {
      await this.saveDraft(userId, { patch: input.patch });
    }
    const draft = await this.draftRow(userId);
    if (!draft || !draft.track) throw validationError('ابتدا پرسش‌نامه را شروع کن');
    const answers = openCanonical(draft.answers, this.env.FIELD_KEY);
    const missing = missingRequired(draft.track, answers);
    if (missing.length > 0) {
      const titles = missing.slice(0, 3).map((key) => questionByKey(key)?.title ?? key);
      throw new ApiError(422, 'onboarding_incomplete', `این پاسخ‌ها هنوز کامل نیست: ${titles.join('، ')}`);
    }
    if (input.consent !== true) {
      throw new ApiError(422, 'consent_required', 'برای ادامه باید با پردازش اطلاعات سلامت موافقت کنی');
    }
    return this.finish(userId, draft.track, answers, draft.source, true);
  }

  async consent(userId: string) {
    const profile = await this.ensureProfile(userId);
    if (!profile) throw new ApiError(409, 'onboarding_incomplete', 'ابتدا پرسش‌نامه را کامل کن');
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `update nutrition_profiles set consented_at = coalesce(consented_at, now()) where user_id = $1`,
        [userId],
      );
      await audit(client, userId, 'onboarding_consent', 'nutrition_profile', userId, {
        specVersion: ONBOARDING_SPEC_VERSION,
      });
    });
    return { ok: true };
  }

  // ----------------------------------------------------------- derivations

  private async finish(
    userId: string,
    track: TrackId,
    answers: CanonicalAnswers,
    source: 'app' | 'demo',
    consented: boolean,
  ) {
    const submission = canonicalToSubmission(track, answers);
    const { answers: stored, riskFlags } = validateSubmission(submission);
    const created = await this.questionnaires.submit(userId, submission);
    const profile = deriveProfile({
      track,
      stored,
      riskFlags,
      preferences: profilePreferences(track, answers),
      canonical: answers,
    });
    await withTransaction(this.pool, async (client) => {
      await this.storeProfile(client, userId, created.id, source, profile, consented);
      for (const fact of factsOf(track, answers)) {
        await client.query(
          `insert into onboarding_answer_facts (submission_id, question_key, value_code, value_num)
           values ($1, $2, $3, $4) on conflict do nothing`,
          [created.id, fact.key, fact.code, fact.num],
        );
      }
      await client.query(`delete from onboarding_drafts where user_id = $1`, [userId]);
      if (consented) {
        await audit(client, userId, 'onboarding_consent', 'nutrition_profile', userId, {
          specVersion: ONBOARDING_SPEC_VERSION,
        });
      }
    });
    return { submissionId: created.id, profile: await this.summaryOf(userId) };
  }

  private async summaryOf(userId: string) {
    const row = await this.profileRow(userId);
    return row ? summarize(row) : null;
  }

  private async storeProfile(
    client: PoolClient,
    userId: string,
    submissionId: string,
    source: 'app' | 'demo',
    p: DerivedProfile,
    consented: boolean,
  ): Promise<void> {
    await client.query(
      `insert into nutrition_profiles
         (user_id, submission_id, spec_version, track, goal, source, sex, age, height_cm, weight_kg,
          target_weight_kg, activity, bmi, bmr_kcal, tdee_kcal, target_kcal, protein_g, carbs_g, fat_g,
          diet_style, meals_per_day, budget, region, allergens, conditions, risk_flags, safety_tier,
          safety_reasons, preferences, consented_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,
               case when $30 then now() else null end)
       on conflict (user_id) do update set
         submission_id = excluded.submission_id, spec_version = excluded.spec_version, track = excluded.track,
         goal = excluded.goal, source = excluded.source, sex = excluded.sex, age = excluded.age,
         height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, target_weight_kg = excluded.target_weight_kg,
         activity = excluded.activity, bmi = excluded.bmi, bmr_kcal = excluded.bmr_kcal, tdee_kcal = excluded.tdee_kcal,
         target_kcal = excluded.target_kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
         fat_g = excluded.fat_g, diet_style = excluded.diet_style, meals_per_day = excluded.meals_per_day,
         budget = excluded.budget, region = excluded.region, allergens = excluded.allergens,
         conditions = excluded.conditions, risk_flags = excluded.risk_flags, safety_tier = excluded.safety_tier,
         safety_reasons = excluded.safety_reasons, preferences = excluded.preferences,
         consented_at = coalesce(nutrition_profiles.consented_at, excluded.consented_at),
         updated_at = now()`,
      [
        userId, submissionId, ONBOARDING_SPEC_VERSION, p.track, p.goal, source, p.sex, p.age, p.heightCm, p.weightKg,
        p.targetWeightKg, p.activity, p.bmi, p.energy.bmrKcal, p.energy.tdeeKcal, p.energy.targetKcal,
        p.energy.proteinG, p.energy.carbsG, p.energy.fatG, p.dietStyle, p.mealsPerDay, p.budget, p.region,
        p.allergens, p.conditions, p.riskFlags, p.safety.tier, p.safety.reasons, JSON.stringify(p.preferences),
        consented,
      ],
    );
    await client.query(
      `insert into nutrition_profile_history (id, user_id, submission_id, weight_kg, target_kcal, snapshot)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        uuidv7(), userId, submissionId, p.weightKg, p.energy.targetKcal,
        JSON.stringify({ track: p.track, bmi: p.bmi, energy: p.energy, safety: p.safety }),
      ],
    );
  }

  /** Accounts created before onboarding v2 only have a submission; derive their profile once. */
  async ensureProfile(userId: string): Promise<ProfileRow | null> {
    const latest = await this.latestSubmission(userId);
    if (!latest) return null;
    const existing = await this.profileRow(userId);
    if (existing && existing.submission_id === latest.id) return existing;
    const stored = openAnswers(latest.answers as StoredAnswers, this.env.FIELD_KEY);
    const track = trackOfStored(stored);
    const profile = deriveProfile({ track, stored, riskFlags: latest.risk_flags });
    await withTransaction(this.pool, async (client) => {
      await this.storeProfile(client, userId, latest.id, 'app', profile, false);
    });
    return this.profileRow(userId);
  }

  /** Imports the newest unclaimed demo lead of this verified phone into a draft, and submits it when complete. */
  private async claimDemoLead(userId: string): Promise<boolean> {
    const user = await this.pool.query<{ phone_e164: string }>(`select phone_e164 from users where id = $1`, [userId]);
    const phone = user.rows[0]?.phone_e164;
    if (!phone) return false;
    const hash = createHmac('sha256', this.env.FIELD_KEY).update(phone).digest('hex');
    const imported = await withTransaction(this.pool, async (client) => {
      const lead = await client.query<{ id: string; goal: TrackId; answers_encrypted: string }>(
        `select id, goal, answers_encrypted from demo_lead_submissions
         where phone_hash = $1 and claimed_user_id is null
         order by created_at desc limit 1 for update skip locked`,
        [hash],
      );
      const row = lead.rows[0];
      if (!row) return null;
      let items: LegacyAnswer[] = [];
      try {
        const parsed: unknown = JSON.parse(decryptText(row.answers_encrypted, this.env.FIELD_KEY));
        if (Array.isArray(parsed)) items = parsed as LegacyAnswer[];
      } catch {
        items = [];
      }
      const { track, answers } = legacyToCanonical(row.goal, items);
      await client.query(
        `insert into onboarding_drafts (user_id, spec_version, track, answers, step_key, progress, source)
         values ($1, $2, $3, $4::jsonb, null, 0, 'demo')
         on conflict (user_id) do update set track = excluded.track, answers = excluded.answers,
           source = 'demo', version = onboarding_drafts.version + 1, updated_at = now()`,
        [userId, ONBOARDING_SPEC_VERSION, track, JSON.stringify(sealCanonical(answers, this.env.FIELD_KEY))],
      );
      await client.query(
        `update demo_lead_submissions set claimed_user_id = $2, claimed_at = now(), phone_verified = true where id = $1`,
        [row.id, userId],
      );
      await audit(client, userId, 'demo_lead_claimed', 'demo_lead', row.id, { track });
      return { track, answers };
    });
    if (!imported) return false;
    if (missingRequired(imported.track, imported.answers).length === 0) {
      try {
        await this.finish(userId, imported.track, imported.answers, 'demo', false);
      } catch {
        // The draft stays so the app can ask only for what does not validate.
      }
    }
    return true;
  }

  // ------------------------------------------------------------------ reads

  private async latestSubmission(userId: string): Promise<SubmissionRow | null> {
    const row = await this.pool.query<SubmissionRow>(
      `select id, answers, risk_flags from questionnaire_submissions
       where user_id = $1 order by submitted_at desc limit 1`,
      [userId],
    );
    return row.rows[0] ?? null;
  }

  private async draftRow(userId: string): Promise<DraftRow | null> {
    const row = await this.pool.query<DraftRow>(
      `select spec_version, track, answers, step_key, progress, source, version, updated_at
       from onboarding_drafts where user_id = $1`,
      [userId],
    );
    return row.rows[0] ?? null;
  }

  async profileRow(userId: string): Promise<ProfileRow | null> {
    const row = await this.pool.query<ProfileRow>(
      `select track, source, goal, sex, age, height_cm::text, weight_kg::text, target_weight_kg::text, bmi::text,
              bmr_kcal, tdee_kcal, target_kcal, protein_g, carbs_g, fat_g, diet_style, allergens, conditions,
              risk_flags, safety_tier, safety_reasons, preferences, consented_at, submission_id
       from nutrition_profiles where user_id = $1`,
      [userId],
    );
    return row.rows[0] ?? null;
  }
}
