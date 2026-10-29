import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Pool } from 'pg';
import { audit, insertOutbox, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';

export interface MaintenanceSummary {
  expiredPayments: number;
  inquiredPayments: number;
  requeuedDrafts: number;
  resumedDrafts: number;
  purgedOtpChallenges: number;
  purgedTotpChallenges: number;
  clearedAiOutputs: number;
  ledgerMismatches: number;
  ledgerMismatchUserIds: string[];
}

@Injectable()
export class MaintenanceService implements OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** The worker calls this. The API does not, so tests do not start the timer. */
  start(intervalMs = 60_000): void {
    if (this.timer) return;
    void this.run(null).catch((error: unknown) => this.log(error));
    this.timer = setInterval(() => {
      void this.run(null).catch((error: unknown) => this.log(error));
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async run(actorId: string | null): Promise<MaintenanceSummary> {
    const summary = await this.once();
    if (actorId) {
      await audit(this.pool, actorId, 'maintenance_ran', 'maintenance', null, summary);
    }
    return summary;
  }

  private async once(): Promise<MaintenanceSummary> {
    if (this.running) {
      return {
        expiredPayments: 0,
        inquiredPayments: 0,
        requeuedDrafts: 0,
        resumedDrafts: 0,
        purgedOtpChallenges: 0,
        purgedTotpChallenges: 0,
        clearedAiOutputs: 0,
        ledgerMismatches: 0,
        ledgerMismatchUserIds: [],
      };
    }
    this.running = true;
    try {
      return await withTransaction(this.pool, async (client) => {
        const inquired = await client.query<{ inquired: number }>(
          `select count(*)::int as inquired
           from payments
           where status = 'pending'
             and created_at <= now() - interval '15 minutes'
             and created_at > now() - interval '30 minutes'`,
        );
        const expired = await client.query(
          `update payments set status = 'failed'
           where status = 'pending' and created_at <= now() - interval '30 minutes'`,
        );
        const resumed = await client.query(
          `update plan_requests r
           set status = 'in_review', updated_at = now()
           where r.status = 'generating'
             and r.updated_at <= now() - interval '15 minutes'
             and exists (select 1 from plan_versions v where v.request_id = r.id)`,
        );
        const requeued = await client.query<{ id: string }>(
          `update plan_requests r
           set status = 'queued', updated_at = now()
           where r.status = 'generating'
             and r.updated_at <= now() - interval '15 minutes'
             and not exists (select 1 from plan_versions v where v.request_id = r.id)
           returning r.id`,
        );
        for (const row of requeued.rows) {
          const pending = await client.query(
            `select id from outbox_events
             where topic = 'plan.generate' and aggregate_id = $1 and dispatched_at is null
             limit 1`,
            [row.id],
          );
          if ((pending.rowCount ?? 0) === 0) {
            await insertOutbox(client, 'plan.generate', row.id, { requestId: row.id });
          }
        }
        const otp = await client.query(
          `delete from otp_challenges where created_at <= now() - interval '7 days'`,
        );
        const totp = await client.query(
          `delete from totp_challenges where created_at <= now() - interval '7 days'`,
        );
        const ai = await client.query(
          `update ai_generations set raw_output = null
           where raw_output is not null and created_at <= now() - interval '30 days'`,
        );
        const ledger = await client.query<{ user_id: string }>(
          `select w.user_id
           from wallets w
           left join (
             select user_id,
                    coalesce(sum(amount_toman) filter (where bucket = 'cash'), 0) as cash_toman,
                    coalesce(sum(amount_toman) filter (where bucket = 'promo'), 0) as promo_toman
             from wallet_ledger
             group by user_id
           ) l on l.user_id = w.user_id
           where w.cash_toman <> coalesce(l.cash_toman, 0)
              or w.promo_toman <> coalesce(l.promo_toman, 0)
           order by w.user_id
           limit 50`,
        );
        return {
          expiredPayments: expired.rowCount ?? 0,
          inquiredPayments: inquired.rows[0]?.inquired ?? 0,
          requeuedDrafts: requeued.rowCount ?? 0,
          resumedDrafts: resumed.rowCount ?? 0,
          purgedOtpChallenges: otp.rowCount ?? 0,
          purgedTotpChallenges: totp.rowCount ?? 0,
          clearedAiOutputs: ai.rowCount ?? 0,
          ledgerMismatches: ledger.rowCount ?? 0,
          ledgerMismatchUserIds: ledger.rows.map((row) => row.user_id),
        };
      });
    } finally {
      this.running = false;
    }
  }

  private log(error: unknown): void {
    this.logger.error(error instanceof Error ? error.message : 'maintenance failed');
  }
}
