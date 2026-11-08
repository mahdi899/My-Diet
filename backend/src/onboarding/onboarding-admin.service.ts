import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { decryptText, openAnswers } from '../common/field-crypto.js';
import { audit, withTransaction } from '../common/sql.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import type { StoredAnswers } from '../questionnaire/schema.js';

export interface ProfileFilter {
  track?: string;
  tier?: string;
  source?: string;
  flag?: string;
  allergen?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

const TRACKS = ['weight_loss', 'weight_gain', 'pregnancy', 'detox'];

function maskPhone(phone: string): string {
  return phone.length < 8 ? phone : `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}

function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    if (!at || !id || Number.isNaN(Date.parse(at))) return null;
    return { at, id };
  } catch {
    return null;
  }
}

@Injectable()
export class OnboardingAdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Keyset-paginated profile list; every filter is backed by an index on nutrition_profiles. */
  async profiles(filter: ProfileFilter) {
    const where: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace('?', `$${values.length}`));
    };
    if (filter.track) {
      if (!TRACKS.includes(filter.track)) throw new ApiError(400, 'validation', 'هدف نامعتبر است');
      add('p.track = ?', filter.track);
    }
    if (filter.tier === 'doctor_only' || filter.tier === 'ai_ok') add('p.safety_tier = ?', filter.tier);
    if (filter.source === 'app' || filter.source === 'demo') add('p.source = ?', filter.source);
    if (filter.flag) add('? = any(p.risk_flags)', filter.flag);
    if (filter.allergen) add('? = any(p.allergens)', filter.allergen);
    if (filter.q) add(`u.display_name ilike ? escape '\\'`, `%${filter.q.replace(/[\\%_]/g, '\\$&')}%`);
    const cursor = decodeCursor(filter.cursor);
    if (cursor) {
      values.push(cursor.at, cursor.id);
      where.push(`(p.updated_at, p.user_id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
    }
    const limit = Math.min(Math.max(filter.limit ?? 30, 1), 100);
    values.push(limit + 1);
    const { rows } = await this.pool.query(
      `select p.user_id, p.track, p.goal, p.source, p.sex, p.age, p.bmi::float8 as bmi, p.target_kcal,
              p.safety_tier, p.risk_flags, p.allergens, p.consented_at, p.updated_at,
              u.display_name, u.phone_e164
       from nutrition_profiles p join users u on u.id = p.user_id
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by p.updated_at desc, p.user_id desc
       limit $${values.length}`,
      values,
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        userId: row.user_id,
        name: row.display_name,
        phone: maskPhone(row.phone_e164),
        track: row.track,
        goal: row.goal,
        source: row.source,
        sex: row.sex,
        age: row.age,
        bmi: row.bmi,
        targetKcal: row.target_kcal,
        safetyTier: row.safety_tier,
        riskFlags: row.risk_flags,
        allergens: row.allergens,
        consented: row.consented_at != null,
        updatedAt: row.updated_at.toISOString(),
      })),
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(`${last.updated_at.toISOString()}|${last.user_id}`).toString('base64url')
          : null,
    };
  }

  /** Full detail. Reading clinical text is audited. */
  async profile(adminId: string, userId: string) {
    const profile = await this.pool.query(
      `select p.*, u.display_name, u.phone_e164 from nutrition_profiles p join users u on u.id = p.user_id
       where p.user_id = $1`,
      [userId],
    );
    const row = profile.rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'پروفایل پیدا نشد');
    const submission = await this.pool.query<{ id: string; answers: StoredAnswers; submitted_at: Date }>(
      `select id, answers, submitted_at from questionnaire_submissions where id = $1`,
      [row.submission_id],
    );
    const history = await this.pool.query(
      `select id, weight_kg::float8 as weight_kg, target_kcal, created_at from nutrition_profile_history
       where user_id = $1 order by created_at desc limit 20`,
      [userId],
    );
    const requests = await this.pool.query(
      `select id, kind, status, created_at from plan_requests where user_id = $1 order by created_at desc limit 10`,
      [userId],
    );
    const facts = await this.pool.query<{ question_key: string; value_code: string; value_num: string | null }>(
      `select question_key, value_code, value_num::text from onboarding_answer_facts
       where submission_id = $1 order by question_key, value_code`,
      [row.submission_id],
    );
    await withTransaction(this.pool, (client) =>
      audit(client, adminId, 'onboarding_profile_viewed', 'nutrition_profile', userId, {}),
    );
    const stored = submission.rows[0];
    return {
      userId,
      name: row.display_name,
      phone: row.phone_e164,
      profile: {
        track: row.track,
        goal: row.goal,
        source: row.source,
        sex: row.sex,
        age: row.age,
        heightCm: Number(row.height_cm),
        weightKg: Number(row.weight_kg),
        targetWeightKg: row.target_weight_kg == null ? null : Number(row.target_weight_kg),
        activity: row.activity,
        bmi: Number(row.bmi),
        bmrKcal: row.bmr_kcal,
        tdeeKcal: row.tdee_kcal,
        targetKcal: row.target_kcal,
        proteinG: row.protein_g,
        carbsG: row.carbs_g,
        fatG: row.fat_g,
        dietStyle: row.diet_style,
        mealsPerDay: row.meals_per_day,
        budget: row.budget,
        region: row.region,
        allergens: row.allergens,
        conditions: row.conditions,
        riskFlags: row.risk_flags,
        safetyTier: row.safety_tier,
        safetyReasons: row.safety_reasons,
        preferences: row.preferences,
        consentedAt: row.consented_at?.toISOString() ?? null,
        specVersion: row.spec_version,
      },
      submission: stored
        ? {
            id: stored.id,
            submittedAt: stored.submitted_at.toISOString(),
            answers: openAnswers(stored.answers, this.env.FIELD_KEY),
          }
        : null,
      facts: facts.rows.map((fact) => ({
        key: fact.question_key,
        code: fact.value_code,
        num: fact.value_num == null ? null : Number(fact.value_num),
      })),
      history: history.rows,
      planRequests: requests.rows,
    };
  }

  /** Funnel from demo lead to a published plan, plus the daily materialised series. */
  async funnel() {
    const one = async (sql: string) => Number((await this.pool.query<{ n: string }>(sql)).rows[0]?.n ?? 0);
    const [demoLeads, demoVerified, demoClaimed, drafts, profiles, consented, doctorOnly, requests, published] =
      await Promise.all([
        one(`select count(*) n from demo_lead_submissions`),
        one(`select count(*) n from demo_lead_submissions where phone_verified`),
        one(`select count(*) n from demo_lead_submissions where claimed_user_id is not null`),
        one(`select count(*) n from onboarding_drafts`),
        one(`select count(*) n from nutrition_profiles`),
        one(`select count(*) n from nutrition_profiles where consented_at is not null`),
        one(`select count(*) n from nutrition_profiles where safety_tier <> 'ai_ok'`),
        one(`select count(distinct user_id) n from plan_requests`),
        one(`select count(distinct user_id) n from plan_requests where status = 'published'`),
      ]);
    const daily = await this.pool.query(
      `select day::text, track, source, profiles, avg_bmi::float8 as avg_bmi, doctor_only
       from mv_onboarding_daily order by day desc, track limit 120`,
    );
    return {
      stages: { demoLeads, demoVerified, demoClaimed, drafts, profiles, consented, doctorOnly, requests, published },
      daily: daily.rows,
    };
  }

  async refreshFunnel() {
    await this.pool.query('refresh materialized view concurrently mv_onboarding_daily');
    return { ok: true };
  }

  async demoLeads(cursor?: string, limit = 30) {
    const parsed = decodeCursor(cursor);
    const values: unknown[] = [];
    let where = '';
    if (parsed) {
      values.push(parsed.at, parsed.id);
      where = `where (created_at, id) < ($1::timestamptz, $2::uuid)`;
    }
    const size = Math.min(Math.max(limit, 1), 100);
    values.push(size + 1);
    const { rows } = await this.pool.query<{
      id: string;
      goal: string;
      phone_encrypted: string;
      phone_verified: boolean;
      claimed_user_id: string | null;
      claimed_at: Date | null;
      created_at: Date;
    }>(
      `select id, goal, phone_encrypted, phone_verified, claimed_user_id, claimed_at, created_at
       from demo_lead_submissions ${where} order by created_at desc, id desc limit $${values.length}`,
      values,
    );
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        goal: row.goal,
        phone: maskPhone(decodeSafe(row.phone_encrypted, this.env.FIELD_KEY)),
        phoneVerified: row.phone_verified,
        claimedUserId: row.claimed_user_id,
        claimedAt: row.claimed_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor:
        rows.length > size && last ? Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64url') : null,
    };
  }
}

function decodeSafe(value: string, secret: string): string {
  try {
    return decryptText(value, secret);
  } catch {
    return '';
  }
}
