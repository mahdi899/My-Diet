import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { audit, withTransaction } from '../common/sql.js';
import { addCivilDays, tehranDayStartUtc, tehranToday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import { BudgetBlockedError, type BudgetGate } from './pool/router.js';

export interface BudgetControls {
  killSwitch: boolean;
  dailyCapMicros: number | null;
  monthlyCapMicros: number | null;
  perRequestCapMicros: number | null;
  perUserDailyDrafts: number;
}

export type PreflightReason = 'kill_switch' | 'cost_cap' | 'monthly_cap' | 'user_quota';

/** Share of a cap at which the admin is warned once per day. */
export const WARN_AT = 0.8;
const THIRTY_DAYS = 30;

const optionalMicros = (value: unknown, label: string): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new ApiError(400, 'validation', `مقدار «${label}» معتبر نیست`);
  }
  return value;
};

/**
 * Money is micro-USD. "Spent" is what finished generations recorded plus the ledger rows of generations
 * still running, so a long plan cannot slip past a cap between its first and last call.
 */
@Injectable()
export class BudgetService implements BudgetGate {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async controls(): Promise<BudgetControls> {
    const { rows } = await this.pool.query<{
      kill_switch: boolean;
      daily: string | null;
      monthly: string | null;
      per_request: string | null;
      per_user: number;
    }>(
      `select kill_switch, daily_cost_cap_micros::text as daily, monthly_cost_cap_micros::text as monthly,
              per_request_cap_micros::text as per_request, per_user_daily_drafts as per_user
       from ai_controls where id = true`,
    );
    const row = rows[0];
    if (!row) throw new ApiError(500, 'ai_controls_missing', 'تنظیم مدل پیدا نشد');
    const n = (value: string | null) => (value == null ? null : Number(value));
    return {
      killSwitch: row.kill_switch,
      dailyCapMicros: n(row.daily),
      monthlyCapMicros: n(row.monthly),
      perRequestCapMicros: n(row.per_request),
      perUserDailyDrafts: row.per_user,
    };
  }

  async updateControls(actorId: string, input: Record<string, unknown>): Promise<BudgetControls> {
    const allowed = ['killSwitch', 'dailyCapMicros', 'monthlyCapMicros', 'perRequestCapMicros', 'perUserDailyDrafts'];
    if (Object.keys(input).some((key) => !allowed.includes(key))) throw new ApiError(400, 'validation', 'فیلد ناشناخته');
    const current = await this.controls();
    const next: BudgetControls = { ...current };
    if (input.killSwitch !== undefined) {
      if (typeof input.killSwitch !== 'boolean') throw new ApiError(400, 'validation', 'کلید توقف معتبر نیست');
      next.killSwitch = input.killSwitch;
    }
    const daily = optionalMicros(input.dailyCapMicros, 'سقف روزانه');
    const monthly = optionalMicros(input.monthlyCapMicros, 'سقف ماهانه');
    const perRequest = optionalMicros(input.perRequestCapMicros, 'سقف هر درخواست');
    if (daily !== undefined) next.dailyCapMicros = daily;
    if (monthly !== undefined) next.monthlyCapMicros = monthly;
    if (perRequest !== undefined) next.perRequestCapMicros = perRequest;
    if (input.perUserDailyDrafts !== undefined) {
      const value = input.perUserDailyDrafts;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
        throw new ApiError(400, 'validation', 'سهمیهٔ روزانهٔ کاربر معتبر نیست');
      }
      next.perUserDailyDrafts = value;
    }
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `update ai_controls set kill_switch=$1, daily_cost_cap_micros=$2, monthly_cost_cap_micros=$3,
           per_request_cap_micros=$4, per_user_daily_drafts=$5, updated_at=now() where id = true`,
        [next.killSwitch, next.dailyCapMicros, next.monthlyCapMicros, next.perRequestCapMicros, next.perUserDailyDrafts],
      );
      await audit(client, actorId, 'ai_controls_updated', 'ai_controls', null, { ...next });
    });
    return next;
  }

  /** Cost of generations finished since `since`, plus calls of generations still running. */
  async spentSince(since: Date): Promise<number> {
    const { rows } = await this.pool.query<{ spent: string }>(
      `select (
         (select coalesce(sum(cost_micros), 0) from ai_generations where created_at >= $1)
         + (select coalesce(sum(l.cost_micros), 0) from ai_usage_ledger l
            where l.created_at >= $1
              and (l.request_id is null
                   or l.created_at > coalesce((select max(g.created_at) from ai_generations g where g.request_id = l.request_id), '-infinity')))
       )::text as spent`,
      [since],
    );
    return Number(rows[0]?.spent ?? 0);
  }

  async spentByRequest(requestId: string): Promise<number> {
    const { rows } = await this.pool.query<{ spent: string }>(
      `select coalesce(sum(l.cost_micros), 0)::text as spent from ai_usage_ledger l
       where l.request_id = $1
         and l.created_at > coalesce((select max(g.created_at) from ai_generations g where g.request_id = $1), '-infinity')`,
      [requestId],
    );
    return Number(rows[0]?.spent ?? 0);
  }

  private monthStart(): Date {
    return tehranDayStartUtc(new Date(`${addCivilDays(tehranToday(), -(THIRTY_DAYS - 1))}T12:00:00Z`));
  }

  /** Gate used before every provider call. */
  async check(requestId: string | null, plannedMicros: number): Promise<void> {
    const controls = await this.controls();
    if (controls.killSwitch) throw new BudgetBlockedError('kill_switch');
    if (controls.dailyCapMicros != null) {
      const spent = await this.spentSince(tehranDayStartUtc());
      if (spent + plannedMicros > controls.dailyCapMicros) throw new BudgetBlockedError('daily_cap');
    }
    if (controls.monthlyCapMicros != null) {
      const spent = await this.spentSince(this.monthStart());
      if (spent + plannedMicros > controls.monthlyCapMicros) throw new BudgetBlockedError('monthly_cap');
    }
    if (controls.perRequestCapMicros != null && requestId) {
      const spent = await this.spentByRequest(requestId);
      if (spent + plannedMicros > controls.perRequestCapMicros) throw new BudgetBlockedError('request_cap');
    }
  }

  /** Before a plan is drafted at all: the cheap checks that decide between AI and a blank week for the doctor. */
  async preflight(userId: string): Promise<{ reason: PreflightReason; spentMicros: number; capMicros: number } | null> {
    const controls = await this.controls();
    if (controls.killSwitch) return { reason: 'kill_switch', spentMicros: 0, capMicros: 0 };
    const today = await this.spentSince(tehranDayStartUtc());
    if (controls.dailyCapMicros != null) {
      if (today >= controls.dailyCapMicros) return { reason: 'cost_cap', spentMicros: today, capMicros: controls.dailyCapMicros };
      await this.warnOnce('daily', today, controls.dailyCapMicros);
    }
    if (controls.monthlyCapMicros != null) {
      const month = await this.spentSince(this.monthStart());
      if (month >= controls.monthlyCapMicros) return { reason: 'monthly_cap', spentMicros: month, capMicros: controls.monthlyCapMicros };
      await this.warnOnce('monthly', month, controls.monthlyCapMicros);
    }
    const drafts = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from ai_generations g join plan_requests r on r.id = g.request_id
       where r.user_id = $1 and g.created_at >= $2 and g.status in ('drafted', 'failed')`,
      [userId, tehranDayStartUtc()],
    );
    if ((drafts.rows[0]?.n ?? 0) >= controls.perUserDailyDrafts) {
      return { reason: 'user_quota', spentMicros: drafts.rows[0]?.n ?? 0, capMicros: controls.perUserDailyDrafts };
    }
    return null;
  }

  private async warnOnce(scope: 'daily' | 'monthly', spent: number, cap: number): Promise<void> {
    if (cap <= 0 || spent < cap * WARN_AT) return;
    const action = `ai_budget_warning_${scope}`;
    const since = scope === 'daily' ? tehranDayStartUtc() : this.monthStart();
    const prior = await this.pool.query(`select 1 from audit_logs where action = $1 and created_at >= $2 limit 1`, [action, since]);
    if (prior.rowCount) return;
    await audit(this.pool, null, action, 'ai_controls', null, { spentMicros: spent, capMicros: cap });
  }

  /** Numbers for the admin cost screen. */
  async status() {
    const controls = await this.controls();
    const startOfDay = tehranDayStartUtc();
    const [today, month] = await Promise.all([this.spentSince(startOfDay), this.spentSince(this.monthStart())]);
    const byModel = await this.pool.query<{ model: string; calls: number; ok: number; tokens: string; cost: string }>(
      `select model, count(*)::int as calls, count(*) filter (where outcome = 'ok')::int as ok,
              coalesce(sum(tokens_in + tokens_out), 0)::text as tokens, coalesce(sum(cost_micros), 0)::text as cost
       from ai_usage_ledger where created_at >= $1 group by model order by sum(cost_micros) desc limit 20`,
      [this.monthStart()],
    );
    const days = await this.pool.query<{ day: string; cost: string; calls: number }>(
      `select to_char((created_at at time zone 'Asia/Tehran')::date, 'YYYY-MM-DD') as day,
              coalesce(sum(cost_micros), 0)::text as cost, count(*)::int as calls
       from ai_usage_ledger where created_at >= $1 group by 1 order by 1`,
      [this.monthStart()],
    );
    const share = (spent: number, cap: number | null) => (cap && cap > 0 ? spent / cap : null);
    const dailyShare = share(today, controls.dailyCapMicros);
    const monthlyShare = share(month, controls.monthlyCapMicros);
    const worst = Math.max(dailyShare ?? 0, monthlyShare ?? 0);
    return {
      day: tehranToday(),
      controls,
      todayMicros: today,
      monthMicros: month,
      dailyShare,
      monthlyShare,
      alert: controls.killSwitch ? 'killed' : worst >= 1 ? 'blocked' : worst >= WARN_AT ? 'warning' : 'ok',
      byModel: byModel.rows.map((row) => ({
        model: row.model,
        calls: row.calls,
        ok: row.ok,
        tokens: Number(row.tokens),
        costMicros: Number(row.cost),
      })),
      daily: days.rows.map((row) => ({ day: row.day, costMicros: Number(row.cost), calls: row.calls })),
    };
  }
}
