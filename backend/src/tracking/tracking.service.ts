import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { notify, toman, withTransaction } from '../common/sql.js';
import { addCivilDays, streakLength, tehranToday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import { MoneyService } from '../money/money.service.js';
import { PlanDraftService } from '../plans/plans.service.js';

@Injectable()
export class TrackingService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly plans: PlanDraftService,
    private readonly money: MoneyService,
  ) {}

  async dashboard(userId: string) {
    const [plan, wallet, streak, unread] = await Promise.all([
      this.plans.publishedPlan(userId),
      this.money.wallet(userId),
      this.streak(userId),
      this.pool.query<{ n: number }>(
        `select count(*)::int as n from notifications where user_id = $1 and read_at is null`,
        [userId],
      ),
    ]);
    const questions = plan
      ? await this.pool.query(
          `select id, prompt, required, status from info_questions where request_id = $1 and status <> 'acknowledged' order by created_at`,
          [plan.requestId],
        )
      : { rows: [] };
    return {
      wallet,
      streak,
      unreadNotifications: unread.rows[0]?.n ?? 0,
      plan,
      infoQuestions: questions.rows,
    };
  }

  async setMeal(userId: string, mealUid: string, eaten: boolean) {
    const today = tehranToday();
    return withTransaction(this.pool, async (client) => {
      const found = await client.query<{
        request_id: string;
        civil_date: string;
        week_start: string;
        effective_from: string;
      }>(
        `select r.id as request_id, d.civil_date, r.week_start, r.effective_from
         from plan_meals m
         join plan_days d on d.id = m.plan_day_id
         join plan_versions v on v.id = d.plan_version_id and v.status = 'published'
         join plan_requests r on r.id = v.request_id
         where m.meal_uid = $1 and r.user_id = $2
         order by v.published_at desc
         limit 1`,
        [mealUid, userId],
      );
      const meal = found.rows[0];
      if (!meal?.civil_date || !meal.week_start || !meal.effective_from) {
        throw new ApiError(404, 'not_found', 'این وعده در برنامهٔ تأییدشده نیست');
      }
      const friday = addCivilDays(meal.week_start, 6);
      if (meal.civil_date !== today || today > friday || meal.civil_date < meal.effective_from) {
        throw new ApiError(409, 'not_today', 'ثبت وعده فقط برای امروز ممکن است');
      }
      await client.query(
        `insert into meal_logs (id, user_id, request_id, scheduled_date, meal_uid, eaten)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id, scheduled_date, meal_uid)
         do update set eaten = excluded.eaten, updated_at = now()`,
        [uuidv7(), userId, meal.request_id, meal.civil_date, mealUid, eaten],
      );
      const reward = eaten ? await this.rewardIfComplete(client, userId, meal.request_id, meal.week_start, meal.effective_from, friday) : null;
      return { eaten, reward };
    });
  }

  async setWeight(userId: string, kilograms: number) {
    if (!Number.isFinite(kilograms) || kilograms < 25 || kilograms > 300) {
      throw new ApiError(400, 'validation', 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد');
    }
    const today = tehranToday();
    await this.pool.query(
      `insert into weight_entries (user_id, civil_date, kilograms) values ($1, $2, $3)
       on conflict (user_id, civil_date) do update set kilograms = excluded.kilograms`,
      [userId, today, kilograms],
    );
    return { date: today, kilograms };
  }

  async weights(userId: string) {
    const rows = await this.pool.query<{ civil_date: string; kilograms: string }>(
      `select civil_date, kilograms from weight_entries where user_id = $1 order by civil_date`,
      [userId],
    );
    return rows.rows.map((row) => ({ date: row.civil_date, kilograms: Number(row.kilograms) }));
  }

  async review(userId: string, requestId: string, weekStart: string, rating: number, body: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'validation', 'امتیاز باید بین ۱ و ۵ باشد');
    }
    const rewarded = await this.pool.query(
      `select id from weekly_rewards where user_id = $1 and request_id = $2 and week_start = $3`,
      [userId, requestId, weekStart],
    );
    if ((rewarded.rowCount ?? 0) === 0) {
      throw new ApiError(409, 'week_not_complete', 'امتیاز بعد از تمام شدن هفتهٔ پاداش‌گرفته ممکن است');
    }
    const id = uuidv7();
    const inserted = await this.pool.query(
      `insert into program_reviews (id, user_id, request_id, week_start, rating, body)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, request_id, week_start) do nothing
       returning id`,
      [id, userId, requestId, weekStart, rating, body],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      throw new ApiError(409, 'already_reviewed', 'برای این هفته امتیاز ثبت شده است');
    }
    return { id, status: 'pending' as const };
  }

  async streak(userId: string): Promise<number> {
    const rows = await this.pool.query<{ week_start: string }>(
      `select week_start from weekly_rewards where user_id = $1`,
      [userId],
    );
    return streakLength(rows.rows.map((row) => row.week_start), tehranToday());
  }

  private async rewardIfComplete(
    client: import('pg').PoolClient,
    userId: string,
    requestId: string,
    weekStart: string,
    effectiveFrom: string,
    friday: string,
  ): Promise<{ amountToman: number } | null> {
    const today = tehranToday();
    if (today < friday) return null;
    const meals = await client.query<{ meal_uid: string }>(
      `select m.meal_uid
       from plan_meals m
       join plan_days d on d.id = m.plan_day_id
       join plan_versions v on v.id = d.plan_version_id and v.status = 'published'
       where v.request_id = $1 and d.civil_date >= $2 and d.civil_date <= $3`,
      [requestId, effectiveFrom, friday],
    );
    if ((meals.rowCount ?? 0) === 0) return null;
    const eaten = await client.query<{ meal_uid: string }>(
      `select meal_uid from meal_logs
       where user_id = $1 and request_id = $2 and eaten = true
         and scheduled_date >= $3 and scheduled_date <= $4`,
      [userId, requestId, effectiveFrom, friday],
    );
    const done = new Set(eaten.rows.map((row) => row.meal_uid));
    if (meals.rows.some((meal) => !done.has(meal.meal_uid))) return null;
    const policy = await client.query<{ amount_toman: string }>(
      `select amount_toman from reward_policies where kind = 'weekly_completion' and active = true`,
    );
    const amount = toman(policy.rows[0]?.amount_toman ?? 0);
    if (amount <= 0) return null;
    const rewardId = uuidv7();
    const inserted = await client.query(
      `insert into weekly_rewards (id, user_id, request_id, week_start, amount_toman)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, week_start) do nothing
       returning id`,
      [rewardId, userId, requestId, weekStart, amount],
    );
    if ((inserted.rowCount ?? 0) === 0) return null;
    await client.query(
      `update wallets set promo_toman = promo_toman + $2, version = version + 1 where user_id = $1`,
      [userId, amount],
    );
    await client.query(
      `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
       values ($1, $2, 'promo', $3, 'weekly_reward', $4)`,
      [uuidv7(), userId, amount, rewardId],
    );
    await notify(client, userId, 'weekly_reward', { requestId, weekStart, amountToman: amount });
    return { amountToman: amount };
  }
}
