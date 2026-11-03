import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { withTransaction } from '../common/sql.js';
import { addCivilDays, fridayOfWeek, weekStartSaturday } from '../common/time.js';
import { parseCivilDate } from '../plans/views.js';
import { compilePatientReport, compilePreferences, type PreferenceSources, type ReportFacts } from './facts.js';

export interface FeedbackInput {
  weekStart: string;
  favorites: string[];
  dislikes: string[];
  preparationDifficulty: string;
  ingredientAvailability: string;
  affordability: string;
  portionSatisfaction: string;
  serviceRating: number | null;
  comment: string;
  publishPermission: boolean;
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function requireWeek(weekStart: string): string {
  if (!parseCivilDate(weekStart) || weekStartSaturday(weekStart) !== weekStart) {
    throw new ApiError(400, 'validation', 'شروع هفته باید شنبه باشد');
  }
  return weekStart;
}

@Injectable()
export class WeeklyFeedbackService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  save(userId: string, input: FeedbackInput) {
    const weekStart = requireWeek(input.weekStart);
    if (input.favorites.some((id) => input.dislikes.includes(id))) {
      throw new ApiError(400, 'validation', 'یک گزینه نمی‌تواند هم محبوب و هم نامطلوب باشد');
    }
    return withTransaction(this.pool, async (client) => {
      await client.query('select id from users where id=$1 for update', [userId]);
      const saved = await client.query<{ revision: number }>(
        `insert into weekly_feedback (user_id, week_start, favorites, dislikes, preparation_difficulty,
           ingredient_availability, affordability, portion_satisfaction, service_rating, comment, publish_permission)
         values ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)
         on conflict (user_id, week_start) do update set
           favorites=excluded.favorites, dislikes=excluded.dislikes,
           preparation_difficulty=excluded.preparation_difficulty,
           ingredient_availability=excluded.ingredient_availability,
           affordability=excluded.affordability, portion_satisfaction=excluded.portion_satisfaction,
           service_rating=excluded.service_rating, comment=excluded.comment,
           publish_permission=excluded.publish_permission, updated_at=now(),
           revision=weekly_feedback.revision + case when weekly_feedback.favorites=excluded.favorites
             and weekly_feedback.dislikes=excluded.dislikes
             and weekly_feedback.preparation_difficulty=excluded.preparation_difficulty
             and weekly_feedback.ingredient_availability=excluded.ingredient_availability
             and weekly_feedback.affordability=excluded.affordability
             and weekly_feedback.portion_satisfaction=excluded.portion_satisfaction
             and weekly_feedback.service_rating is not distinct from excluded.service_rating
             and weekly_feedback.comment=excluded.comment
             and weekly_feedback.publish_permission=excluded.publish_permission then 0 else 1 end
         returning revision`,
        [
          userId, weekStart, JSON.stringify(input.favorites), JSON.stringify(input.dislikes),
          input.preparationDifficulty, input.ingredientAvailability, input.affordability,
          input.portionSatisfaction, input.serviceRating, input.comment, input.publishPermission,
        ],
      );
      return { ...(await this.readFeedback(client, userId, weekStart)), revision: saved.rows[0]!.revision };
    });
  }

  async get(userId: string, weekStart: string) {
    requireWeek(weekStart);
    const row = await this.readFeedback(this.pool, userId, weekStart);
    if (!row) throw new ApiError(404, 'not_found', 'بازخورد این هفته ثبت نشده است');
    return row;
  }

  publish(userId: string, weekStart: string) {
    requireWeek(weekStart);
    return withTransaction(this.pool, async (client) => {
      await client.query('select id from users where id=$1 for update', [userId]);
      const feedback = await this.readFeedback(client, userId, weekStart);
      if (!feedback) throw new ApiError(404, 'not_found', 'بازخورد این هفته ثبت نشده است');
      if (!feedback.publishPermission) throw new ApiError(409, 'permission_required', 'انتشار نظر نیاز به اجازهٔ صریح دارد');
      if (feedback.serviceRating == null) throw new ApiError(409, 'rating_required', 'امتیاز خدمت برای نظر عمومی لازم است');
      const request = await client.query<{ id: string }>(
        `select id from plan_requests
         where user_id=$1 and status <> 'cancelled' and (week_start=$2 or week_start is null)
         order by case when week_start=$2 then 0 else 1 end, created_at desc limit 1`,
        [userId, weekStart],
      );
      const requestId = request.rows[0]?.id;
      if (!requestId) throw new ApiError(409, 'no_plan', 'برنامهٔ این هفته برای نظر عمومی پیدا نشد');
      const existing = await client.query<{ id: string; status: string }>(
        `select id, status from program_reviews where user_id=$1 and request_id=$2 and week_start=$3`,
        [userId, requestId, weekStart],
      );
      let reviewId = existing.rows[0]?.id;
      let status = existing.rows[0]?.status;
      if (!reviewId) {
        reviewId = uuidv7();
        status = 'pending';
        await client.query(
          `insert into program_reviews (id, user_id, request_id, week_start, rating, body, status)
           values ($1,$2,$3,$4,$5,$6,'pending')`,
          [reviewId, userId, requestId, weekStart, feedback.serviceRating, feedback.comment],
        );
      } else if (status !== 'approved') {
        status = 'pending';
        await client.query(
          `update program_reviews set rating=$2, body=$3, status='pending' where id=$1`,
          [reviewId, feedback.serviceRating, feedback.comment],
        );
      }
      await client.query(
        `insert into feedback_publications (user_id, week_start, review_id) values ($1,$2,$3)
         on conflict (user_id, week_start) do update set review_id=excluded.review_id`,
        [userId, weekStart, reviewId],
      );
      return { reviewId, status, privatePreserved: true, approvesNewPlan: false };
    });
  }

  async preferences(userId: string) {
    const sources = await this.preferenceSources(this.pool, userId);
    const stored = await this.pool.query<{ revision: number }>(
      'select revision from preference_confirmations where user_id=$1',
      [userId],
    );
    return { ...compilePreferences(sources), revision: stored.rows[0]?.revision ?? 0 };
  }

  confirm(userId: string, expectedRevision: number, favoriteOptions: string[], dislikedOptions: string[], note: string) {
    return withTransaction(this.pool, async (client) => {
      await client.query('select id from users where id=$1 for update', [userId]);
      const current = await client.query<{ revision: number }>(
        'select revision from preference_confirmations where user_id=$1',
        [userId],
      );
      const revision = current.rows[0]?.revision ?? 0;
      if (revision !== expectedRevision) throw new ApiError(409, 'lock_conflict', 'پیشنهاد ترجیح تغییر کرده است');
      const next = revision + 1;
      await client.query(
        `insert into preference_confirmations (user_id, revision, favorite_options, disliked_options, note)
         values ($1,$2,$3::jsonb,$4::jsonb,$5)
         on conflict (user_id) do update set revision=excluded.revision, favorite_options=excluded.favorite_options,
           disliked_options=excluded.disliked_options, note=excluded.note, updated_at=now()`,
        [userId, next, JSON.stringify(favoriteOptions), JSON.stringify(dislikedOptions), note],
      );
      const sources = await this.preferenceSources(client, userId);
      return { ...compilePreferences(sources), revision: next };
    });
  }

  generate(userId: string, weekStart: string, commandId: string) {
    requireWeek(weekStart);
    return withTransaction(this.pool, async (client) => {
      await client.query('select id from users where id=$1 for update', [userId]);
      const prior = await client.query<{ version: number; document: unknown }>(
        `select version, document from patient_week_reports where user_id=$1 and command_id=$2`,
        [userId, commandId],
      );
      if (prior.rows[0]) return { version: prior.rows[0].version, document: prior.rows[0].document, retried: true };
      const built = await this.buildFacts(client, userId, weekStart);
      const sourceHash = hash(built.facts);
      const same = await client.query<{ version: number; document: unknown }>(
        `select version, document from patient_week_reports
         where user_id=$1 and week_start=$2 and source_hash=$3 order by version desc limit 1`,
        [userId, weekStart, sourceHash],
      );
      if (same.rows[0]) return { version: same.rows[0].version, document: same.rows[0].document, retried: false };
      const latest = await client.query<{ version: number }>(
        `select version from patient_week_reports where user_id=$1 and week_start=$2 order by version desc limit 1`,
        [userId, weekStart],
      );
      const version = (latest.rows[0]?.version ?? 0) + 1;
      const document = compilePatientReport(built.facts);
      await client.query(
        `insert into patient_week_reports
          (user_id, week_start, version, command_id, source_hash, cutoff_at, document, generator, prompt_version, source_refs)
         values ($1,$2,$3,$4,$5,now(),$6::jsonb,'deterministic-facts','phase6-facts-v1',$7::jsonb)`,
        [userId, weekStart, version, commandId, sourceHash, JSON.stringify(document), JSON.stringify(built.facts.sourceRefs)],
      );
      const planStatus = await client.query<{ status: string }>(
        `select status from plan_requests where user_id=$1 and status <> 'cancelled' order by created_at desc limit 1`,
        [userId],
      );
      return { version, document, retried: false, planStatusUnchanged: planStatus.rows[0]?.status ?? null };
    });
  }

  async latest(userId: string, weekStart: string) {
    requireWeek(weekStart);
    const row = await this.pool.query(
      `select version, document, generator, prompt_version, cutoff_at
       from patient_week_reports where user_id=$1 and week_start=$2 order by version desc limit 1`,
      [userId, weekStart],
    );
    if (!row.rows[0]) throw new ApiError(404, 'not_found', 'گزارش این هفته هنوز ساخته نشده است');
    return row.rows[0];
  }

  async forSpecialist(specialistId: string, patientId: string, weekStart: string) {
    const assigned = await this.pool.query(
      `select 1 from plan_requests where user_id=$1 and assigned_specialist_id=$2 and status <> 'cancelled' limit 1`,
      [patientId, specialistId],
    );
    if ((assigned.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'بیمار پیدا نشد');
    return this.latest(patientId, weekStart);
  }

  async metrics() {
    const row = await this.pool.query<{
      private_count: number;
      private_average: string | null;
      public_approved_count: number;
      public_average: string | null;
    }>(
      `select
         (select count(*)::int from weekly_feedback where service_rating is not null) as private_count,
         (select round(avg(service_rating)::numeric, 2) from weekly_feedback where service_rating is not null) as private_average,
         (select count(*)::int from program_reviews where status='approved') as public_approved_count,
         (select round(avg(rating)::numeric, 2) from program_reviews where status='approved') as public_average`,
    );
    const metrics = row.rows[0]!;
    return {
      privateFeedback: { count: metrics.private_count, average: metrics.private_average == null ? null : Number(metrics.private_average) },
      publicApprovedReviews: {
        count: metrics.public_approved_count,
        average: metrics.public_average == null ? null : Number(metrics.public_average),
      },
    };
  }

  private async readFeedback(db: Pool | PoolClient, userId: string, weekStart: string) {
    const row = await db.query<{
      revision: number;
      favorites: string[];
      dislikes: string[];
      preparation_difficulty: string;
      ingredient_availability: string;
      affordability: string;
      portion_satisfaction: string;
      service_rating: number | null;
      comment: string;
      publish_permission: boolean;
    }>(
      `select revision, favorites, dislikes, preparation_difficulty, ingredient_availability, affordability,
              portion_satisfaction, service_rating, comment, publish_permission
       from weekly_feedback where user_id=$1 and week_start=$2`,
      [userId, weekStart],
    );
    const found = row.rows[0];
    if (!found) return null;
    return {
      weekStart,
      revision: found.revision,
      favorites: found.favorites,
      dislikes: found.dislikes,
      preparationDifficulty: found.preparation_difficulty,
      ingredientAvailability: found.ingredient_availability,
      affordability: found.affordability,
      portionSatisfaction: found.portion_satisfaction,
      serviceRating: found.service_rating,
      comment: found.comment,
      publishPermission: found.publish_permission,
    };
  }

  private async preferenceSources(db: Pool | PoolClient, userId: string): Promise<PreferenceSources> {
    const answers = await db.query<{ answers: { preference?: string; dislikes?: string } }>(
      `select answers from questionnaire_submissions where user_id=$1 order by submitted_at desc limit 1`,
      [userId],
    );
    const feedback = await db.query<{ favorites: string[]; dislikes: string[] }>(
      `select favorites, dislikes from weekly_feedback where user_id=$1 order by week_start desc limit 1`,
      [userId],
    );
    const reasons = await db.query<{ reason_label: string | null }>(
      `select reason_label from meal_selections where user_id=$1 and reason_label is not null order by updated_at desc limit 20`,
      [userId],
    );
    const confirmed = await db.query<{ favorite_options: string[]; disliked_options: string[]; note: string }>(
      'select favorite_options, disliked_options, note from preference_confirmations where user_id=$1',
      [userId],
    );
    const answer = answers.rows[0]?.answers ?? {};
    const latest = feedback.rows[0];
    const confirmation = confirmed.rows[0];
    return {
      questionnairePreference: typeof answer.preference === 'string' ? answer.preference : null,
      questionnaireDislikes: typeof answer.dislikes === 'string' ? answer.dislikes : null,
      substitutionReasons: reasons.rows.map((row) => row.reason_label ?? '').filter(Boolean),
      favoriteOptions: latest?.favorites ?? [],
      dislikedOptions: latest?.dislikes ?? [],
      confirmed: confirmation
        ? { favoriteOptions: confirmation.favorite_options, dislikedOptions: confirmation.disliked_options, note: confirmation.note }
        : null,
    };
  }

  private async buildFacts(client: PoolClient, userId: string, weekStart: string): Promise<{ facts: ReportFacts }> {
    const weekEnd = fridayOfWeek(weekStart);
    const previousStart = addCivilDays(weekStart, -7);
    const chosen = await client.query<{ meal_uid: string; version_id: string }>(
      `with chosen as (
         select distinct on (d.civil_date, m.meal_uid) m.meal_uid, v.id as version_id
         from plan_days d
         join plan_versions v on v.id=d.plan_version_id
         join plan_requests r on r.id=v.request_id
         join plan_meals m on m.plan_day_id=d.id
         where r.user_id=$1 and d.civil_date between $2 and $3 and v.status in ('published','superseded')
         order by d.civil_date, m.meal_uid, v.published_at desc)
       select meal_uid::text, version_id::text from chosen`,
      [userId, weekStart, weekEnd],
    );
    const logs = await client.query<{ state: string | null; id: string }>(
      `select id::text, details->>'state' as state from meal_logs
       where user_id=$1 and scheduled_date between $2 and $3`,
      [userId, weekStart, weekEnd],
    );
    const previous = await client.query<{ planned: number; followed: number }>(
      `select
         (select count(*)::int from plan_days d
           join plan_versions v on v.id=d.plan_version_id
           join plan_requests r on r.id=v.request_id
           join plan_meals m on m.plan_day_id=d.id
           where r.user_id=$1 and d.civil_date between $2 and $3 and v.status in ('published','superseded')) as planned,
         (select count(*)::int from meal_logs where user_id=$1 and scheduled_date between $2 and $3
           and details->>'state'='as_planned') as followed`,
      [userId, previousStart, addCivilDays(previousStart, 6)],
    );
    const feedback = await this.readFeedback(client, userId, weekStart);
    const weights = await client.query<{ civil_date: string; kilograms: string }>(
      `select civil_date::text, kilograms from weight_entries where user_id=$1 and civil_date between $2 and $3 order by civil_date`,
      [userId, weekStart, weekEnd],
    );
    const changed = await client.query(
      `select 1 from questionnaire_submissions
       where user_id=$1 and (submitted_at at time zone 'Asia/Tehran')::date between $2::date and $3::date
         and exists (select 1 from questionnaire_submissions older
           where older.user_id=$1 and (older.submitted_at at time zone 'Asia/Tehran')::date < $2::date)
       limit 1`,
      [userId, weekStart, weekEnd],
    );
    const selections = await client.query<{ meal_uid: string }>(
      `select meal_uid::text from meal_selections where user_id=$1 and civil_date between $2 and $3 and reason_id is not null`,
      [userId, weekStart, weekEnd],
    );
    const known = (value: string | undefined) => (value && value !== 'unknown' ? value : null);
    const previousPlanned = previous.rows[0]?.planned ?? 0;
    const facts: ReportFacts = {
      weekStart,
      weekEnd,
      plannedMeals: chosen.rowCount ?? 0,
      recordedMeals: logs.rowCount ?? 0,
      accordingToPlan: logs.rows.filter((row) => row.state === 'as_planned').length,
      skipped: logs.rows.filter((row) => row.state === 'skipped').length,
      substitutions: selections.rowCount ?? 0,
      favoriteOptions: feedback?.favorites ?? [],
      dislikedOptions: feedback?.dislikes ?? [],
      preparationDifficulty: known(feedback?.preparationDifficulty),
      ingredientAvailability: known(feedback?.ingredientAvailability),
      affordability: known(feedback?.affordability),
      portionSatisfaction: known(feedback?.portionSatisfaction),
      weights: weights.rows.map((row) => ({ date: row.civil_date.slice(0, 10), kilograms: Number(row.kilograms) })),
      questionnaireChanged: (changed.rowCount ?? 0) > 0,
      previousAdherence: previousPlanned === 0 ? null : Math.round((previous.rows[0]!.followed / previousPlanned) * 1000) / 1000,
      sourceRefs: [
        ...chosen.rows.map((row) => ({ kind: 'meal_slot', ref: row.meal_uid })),
        ...logs.rows.map((row) => ({ kind: 'meal_log', ref: row.id })),
        ...weights.rows.map((row) => ({ kind: 'weight', ref: row.civil_date.slice(0, 10) })),
        ...(feedback ? [{ kind: 'weekly_feedback', ref: weekStart }] : []),
      ],
    };
    return { facts };
  }
}
