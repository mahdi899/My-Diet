import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { notify, toman, withTransaction } from '../common/sql.js';
import { addCivilDays, tehranToday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import {
  cycleStartFor,
  projectCycle,
  recordedMeal,
  STREAK_RESET_RULE,
  STREAK_TODAY_RULE,
  type CampaignRules,
  type Milestone,
} from './streak-rules.js';

interface StoredCampaign extends CampaignRules { id: string }

export interface StreakSnapshot {
  version: number;
  days: Array<{ date: string; state: string }>;
  consecutive: number;
  requiredDays: number;
  todayRequirements: string;
  resetRule: string;
  milestones: Milestone[];
  claimState: 'idle' | 'confirmed' | 'duplicate' | 'held';
  grants: Array<{ id: string; day: number; amountToman: number; cycleStart: string }>;
  wallet: number;
  retried?: boolean;
}

@Injectable()
export class StreakService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  snapshot(userId: string) {
    return withTransaction(this.pool, (client) => this.evaluate(client, userId, null));
  }

  claim(userId: string, commandId: string) {
    return withTransaction(this.pool, async (client) => {
      await client.query(`select user_id from wallets where user_id=$1 for update`, [userId]);
      const prior = await client.query<{ response: StreakSnapshot }>(
        `select response from streak_claims where user_id=$1 and command_id=$2`,
        [userId, commandId],
      );
      if (prior.rows[0]) return { ...prior.rows[0].response, retried: true };
      const result = await this.evaluate(client, userId, commandId);
      await client.query(
        `insert into streak_claims (user_id, command_id, response) values ($1,$2,$3::jsonb)`,
        [userId, commandId, JSON.stringify(result)],
      );
      return result;
    });
  }

  async list() {
    const rows = await this.pool.query<{ id: string; version: number; consecutive_days: number; starts_on: string; ends_on: string | null; effective_on: string; repeat: 'cycle' | 'none' }>(
      `select id, version, consecutive_days, starts_on::text, ends_on::text, effective_on::text, repeat
       from streak_campaigns order by version`,
    );
    return Promise.all(rows.rows.map(async (row) => ({ ...(await this.rules(this.pool, row.id)), id: row.id })));
  }

  publish(input: {
    consecutiveDays: number;
    milestones: Milestone[];
    startsOn: string;
    endsOn: string | null;
    effectiveOn: string;
    repeat: 'cycle' | 'none';
  }) {
    const milestones = [...input.milestones].sort((left, right) => left.day - right.day);
    if (!Number.isInteger(input.consecutiveDays) || input.consecutiveDays < 1 || input.consecutiveDays > 30) {
      throw new ApiError(400, 'validation', 'تعداد روزهای پیاپی باید بین ۱ و ۳۰ باشد');
    }
    if (milestones.length === 0 || milestones.some((item) => !Number.isInteger(item.day) || item.day < 1 || item.day > input.consecutiveDays || !Number.isInteger(item.amountToman) || item.amountToman < 0)) {
      throw new ApiError(400, 'validation', 'مایل‌ستون‌های کمپین را بررسی کن');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn)) {
      throw new ApiError(400, 'validation', 'تاریخ شروع نامعتبر است');
    }
    if (input.endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) throw new ApiError(400, 'validation', 'تاریخ پایان نامعتبر است');
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ version: number }>(`select version from streak_campaigns order by version desc limit 1 for update`);
      const version = (current.rows[0]?.version ?? 0) + 1;
      const id = uuidv7();
      await client.query(
        `insert into streak_campaigns (id, version, consecutive_days, qualifying_rule, starts_on, ends_on, effective_on, repeat, participant_policy)
         values ($1,$2,$3,'recorded_meals',$4,$5,$6,$7,'finish_current_version')`,
        [id, version, input.consecutiveDays, input.startsOn, input.endsOn, input.effectiveOn, input.repeat],
      );
      for (const milestone of milestones) {
        await client.query(`insert into streak_milestones (campaign_id, day_index, amount_toman) values ($1,$2,$3)`, [id, milestone.day, milestone.amountToman]);
      }
      return { ...(await this.rules(client, id)) };
    });
  }

  private async evaluate(client: PoolClient, userId: string, commandId: string | null): Promise<StreakSnapshot> {
    const today = tehranToday();
    const wallet = await this.promo(client, userId);
    const locked = await client.query<{ id: string; campaign_id: string; cycle_start: string }>(
      `select p.id, p.campaign_id, p.cycle_start::text
       from streak_participations p
       join streak_campaigns c on c.id=p.campaign_id
       where p.user_id=$1 and p.cycle_start <= $2::date and p.cycle_start + c.consecutive_days > $2::date
       order by p.created_at desc limit 1`,
      [userId, today],
    );
    let campaign = locked.rows[0] ? await this.rules(client, locked.rows[0].campaign_id) : await this.latest(client);
    if (!campaign) return this.empty(wallet);
    const cycleStart = locked.rows[0]?.cycle_start.slice(0, 10) ?? cycleStartFor(campaign.startsOn, campaign.consecutiveDays, today);
    if (!cycleStart) return this.empty(wallet, campaign);
    const activity = await this.activity(client, userId, cycleStart, campaign.consecutiveDays);
    let participation = locked.rows[0]?.id ?? '';
    if (!locked.rows[0] && (commandId || activity.qualified.size > 0 || activity.partial.size > 0)) {
      const createdId = uuidv7();
      const inserted = await client.query<{ id: string }>(
        `insert into streak_participations (id, user_id, campaign_id, cycle_start) values ($1,$2,$3,$4)
         on conflict (user_id, cycle_start) do nothing returning id`,
        [createdId, userId, campaign.id, cycleStart],
      );
      if (inserted.rows[0]) participation = inserted.rows[0].id;
      else {
        const existing = await client.query<{ id: string; campaign_id: string }>(
          `select id, campaign_id from streak_participations where user_id=$1 and cycle_start=$2::date`,
          [userId, cycleStart],
        );
        participation = existing.rows[0]?.id ?? '';
        if (existing.rows[0]) campaign = await this.rules(client, existing.rows[0].campaign_id);
      }
    }
    if (campaign.repeat === 'none' && cycleStart !== campaign.startsOn) return this.empty(wallet, campaign);
    const granted = participation ? await this.grantedDays(client, participation) : new Set<number>();
    const projected = projectCycle({ rules: campaign, cycleStart, today, qualified: activity.qualified, partial: activity.partial, grantedDays: granted });
    if (commandId && participation) await this.reverseShortfall(client, userId, participation, projected.consecutive, today);
    const grants = commandId && participation
      ? await this.issue(client, userId, participation, cycleStart, campaign, projected.consecutive, activity.anomaly)
      : [];
    const freshGranted = participation ? await this.grantedDays(client, participation) : granted;
    const shown = projectCycle({ rules: campaign, cycleStart, today, qualified: activity.qualified, partial: activity.partial, grantedDays: freshGranted });
    const held = participation
      ? (await client.query(`select 1 from streak_grants where participation_id=$1 and status='held' limit 1`, [participation])).rowCount
      : 0;
    const claimState = grants.some((grant) => grant.issued)
      ? 'confirmed'
      : grants.some((grant) => !grant.issued) || held
        ? 'held'
        : granted.size > 0 && grants.length === 0
          ? 'duplicate'
          : 'idle';
    return {
      version: campaign.version,
      days: shown.days,
      consecutive: shown.consecutive,
      requiredDays: campaign.consecutiveDays,
      todayRequirements: STREAK_TODAY_RULE,
      resetRule: STREAK_RESET_RULE,
      milestones: campaign.milestones,
      claimState,
      grants: grants.filter((grant) => grant.issued).map((grant) => ({ id: grant.id, day: grant.day, amountToman: grant.amountToman, cycleStart })),
      wallet: await this.promo(client, userId),
    };
  }

  private async issue(
    client: PoolClient,
    userId: string,
    participationId: string,
    cycleStart: string,
    campaign: StoredCampaign,
    consecutive: number,
    anomaly: boolean,
  ) {
    const created: Array<{ id: string; day: number; amountToman: number; issued: boolean }> = [];
    for (const milestone of campaign.milestones) {
      if (consecutive < milestone.day || milestone.amountToman <= 0) continue;
      const id = uuidv7();
      const status = anomaly ? 'held' : 'issued';
      const inserted = await client.query<{ id: string }>(
        `insert into streak_grants (id, user_id, participation_id, milestone_day, amount_toman, status)
         values ($1,$2,$3,$4,$5,$6) on conflict (participation_id, milestone_day) do nothing returning id`,
        [id, userId, participationId, milestone.day, milestone.amountToman, status],
      );
      if (!inserted.rows[0]) continue;
      if (anomaly) {
        await client.query(
          `insert into streak_signals (id, user_id, civil_date, kind) values ($1,$2,$3,'late_bulk_hold')
           on conflict (user_id, civil_date, kind) do nothing`,
          [uuidv7(), userId, cycleStart],
        );
        created.push({ id, day: milestone.day, amountToman: milestone.amountToman, issued: false });
        continue;
      }
      await client.query(`update wallets set promo_toman = promo_toman + $2, version = version + 1 where user_id=$1`, [userId, milestone.amountToman]);
      await client.query(
        `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
         values ($1,$2,'promo',$3,'campaign_reward',$4)`,
        [uuidv7(), userId, milestone.amountToman, id],
      );
      await notify(client, userId, 'campaign_reward', { grantId: id, amountToman: milestone.amountToman });
      created.push({ id, day: milestone.day, amountToman: milestone.amountToman, issued: true });
    }
    return created;
  }

  private async reverseShortfall(client: PoolClient, userId: string, participationId: string, consecutive: number, today: string) {
    const grants = await client.query<{ id: string; milestone_day: number; amount_toman: string }>(
      `select id, milestone_day, amount_toman from streak_grants
       where participation_id=$1 and status='issued' and milestone_day > $2 for update`,
      [participationId, consecutive],
    );
    for (const grant of grants.rows) {
      const amount = toman(grant.amount_toman);
      const balance = await this.promo(client, userId);
      if (balance < amount) {
        await client.query(
          `insert into streak_signals (id, user_id, civil_date, kind) values ($1,$2,$3::date,'reversal_uncollected')
           on conflict (user_id, civil_date, kind) do nothing`,
          [uuidv7(), userId, today],
        );
        continue;
      }
      await client.query(`update wallets set promo_toman = promo_toman - $2, version = version + 1 where user_id=$1`, [userId, amount]);
      await client.query(
        `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
         values ($1,$2,'promo',$3,'campaign_reversal',$4)`,
        [uuidv7(), userId, -amount, grant.id],
      );
      await client.query(`update streak_grants set status='reversed' where id=$1`, [grant.id]);
    }
  }

  private async activity(client: PoolClient, userId: string, cycleStart: string, length: number) {
    const qualified = new Set<string>();
    const partial = new Set<string>();
    for (let index = 0; index < length; index += 1) {
      const date = addCivilDays(cycleStart, index);
      const planned = await client.query<{ meal_uid: string }>(
        `select m.meal_uid from active_plan_versions a
         join plan_versions v on v.id=a.version_id and v.status='published'
         join plan_requests r on r.id=v.request_id and r.status <> 'cancelled'
         join orders o on o.id=r.order_id and o.status='paid'
         join plan_days d on d.plan_version_id=v.id and d.civil_date=$2::date
         join plan_meals m on m.plan_day_id=d.id
         where a.user_id=$1`,
        [userId, date],
      );
      if ((planned.rowCount ?? 0) === 0) continue;
      const logs = await client.query<{ meal_uid: string; eaten: boolean; details: { state?: string } }>(
        `select meal_uid, eaten, details from meal_logs where user_id=$1 and scheduled_date=$2::date`,
        [userId, date],
      );
      const done = new Set(logs.rows.filter((log) => recordedMeal({ eaten: log.eaten, state: log.details?.state ?? null })).map((log) => log.meal_uid));
      const recorded = planned.rows.filter((meal) => done.has(meal.meal_uid)).length;
      if (recorded === planned.rowCount) qualified.add(date);
      else if (recorded > 0) partial.add(date);
    }
    const anomaly = await client.query(
      `select 1 from meal_log_anomalies where user_id=$1 and scheduled_date >= $2::date and scheduled_date < $3::date limit 1`,
      [userId, cycleStart, addCivilDays(cycleStart, length)],
    );
    return { qualified, partial, anomaly: (anomaly.rowCount ?? 0) > 0 };
  }

  private async grantedDays(client: PoolClient, participationId: string) {
    const rows = await client.query<{ milestone_day: number }>(
      `select milestone_day from streak_grants where participation_id=$1 and status='issued'`,
      [participationId],
    );
    return new Set(rows.rows.filter((row) => row.milestone_day).map((row) => row.milestone_day));
  }

  private async rules(db: Pool | PoolClient, id: string): Promise<StoredCampaign> {
    const row = await db.query<{ version: number; consecutive_days: number; starts_on: string; ends_on: string | null; effective_on: string; repeat: 'cycle' | 'none' }>(
      `select version, consecutive_days, starts_on::text, ends_on::text, effective_on::text, repeat from streak_campaigns where id=$1`,
      [id],
    );
    const campaign = row.rows[0];
    if (!campaign) throw new ApiError(404, 'not_found', 'کمپین پیدا نشد');
    const milestones = await db.query<{ day_index: number; amount_toman: string }>(
      `select day_index, amount_toman from streak_milestones where campaign_id=$1 order by day_index`,
      [id],
    );
    return {
      id,
      version: campaign.version,
      consecutiveDays: campaign.consecutive_days,
      milestones: milestones.rows.map((item) => ({ day: item.day_index, amountToman: toman(item.amount_toman) })),
      startsOn: campaign.starts_on.slice(0, 10),
      endsOn: campaign.ends_on?.slice(0, 10) ?? null,
      effectiveOn: campaign.effective_on.slice(0, 10),
      repeat: campaign.repeat,
    };
  }

  private async latest(client: PoolClient): Promise<StoredCampaign | null> {
    const row = await client.query<{ id: string }>(`select id from streak_campaigns order by version desc limit 1`);
    const id = row.rows[0]?.id;
    return id ? this.rules(client, id) : null;
  }

  private async promo(client: PoolClient, userId: string) {
    const row = await client.query<{ promo_toman: string }>(`select promo_toman from wallets where user_id=$1`, [userId]);
    return toman(row.rows[0]?.promo_toman ?? 0);
  }

  private empty(wallet: number, campaign?: StoredCampaign): StreakSnapshot {
    return {
      version: campaign?.version ?? 0,
      days: [],
      consecutive: 0,
      requiredDays: campaign?.consecutiveDays ?? 0,
      todayRequirements: STREAK_TODAY_RULE,
      resetRule: STREAK_RESET_RULE,
      milestones: campaign?.milestones ?? [],
      claimState: 'idle',
      grants: [],
      wallet,
    };
  }
}
