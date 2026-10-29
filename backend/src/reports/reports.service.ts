import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_REPLICA } from '../database/database.js';
import { withReadOnly } from '../database/read-only.js';

const RESPONSE_KINDS = ['draft_edited', 'info_question', 'published'];

interface SlaRow {
  specialist_id: string;
  display_name: string;
  requests: number;
  published: number;
  overdue: number;
  median_minutes: string | null;
}

export interface SpecialistSla {
  specialistId: string;
  displayName: string;
  requests: number;
  published: number;
  overdue: number;
  medianResponseMinutes: number | null;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PG_REPLICA) private readonly replica: Pool) {}

  async specialist(specialistId: string): Promise<SpecialistSla> {
    const board = await this.board(specialistId);
    return (
      board[0] ?? {
        specialistId,
        displayName: '',
        requests: 0,
        published: 0,
        overdue: 0,
        medianResponseMinutes: null,
      }
    );
  }

  async admin() {
    const [specialists, statuses, payments] = await withReadOnly(this.replica, async (client) => {
      const specialistRows = await client.query<SlaRow>(SLA_SQL, [null, RESPONSE_KINDS]);
      const statusRows = await client.query<{ status: string; requests: number }>(
        `select status, count(*)::int as requests from plan_requests group by status order by status`,
      );
      const paymentRows = await client.query<{ gateway: string; payments: number; amount_toman: string }>(
        `select gateway, count(*)::int as payments, coalesce(sum(amount_toman), 0)::text as amount_toman
         from payments
         where status = 'credited'
         group by gateway
         order by gateway`,
      );
      return [specialistRows.rows, statusRows.rows, paymentRows.rows] as const;
    });
    return {
      slaHours: 24,
      specialists: specialists.map(present),
      requestsByStatus: statuses.map((row) => ({ status: row.status, requests: Number(row.requests) })),
      creditedPaymentsByGateway: payments.map((row) => ({
        gateway: row.gateway,
        payments: Number(row.payments),
        amountToman: Number(row.amount_toman),
      })),
    };
  }

  private async board(specialistId: string | null): Promise<SpecialistSla[]> {
    return withReadOnly(this.replica, async (client) => {
      const rows = await client.query<SlaRow>(SLA_SQL, [specialistId, RESPONSE_KINDS]);
      return rows.rows.map(present);
    });
  }
}

function present(row: SlaRow): SpecialistSla {
  return {
    specialistId: row.specialist_id,
    displayName: row.display_name,
    requests: Number(row.requests),
    published: Number(row.published),
    overdue: Number(row.overdue),
    medianResponseMinutes: row.median_minutes == null ? null : Math.round(Number(row.median_minutes)),
  };
}

const SLA_SQL = `
  select p.user_id as specialist_id,
         p.display_name,
         count(r.id)::int as requests,
         count(r.id) filter (where r.status = 'published')::int as published,
         count(r.id) filter (
           where r.status not in ('published', 'cancelled')
             and r.created_at < now() - interval '24 hours'
             and response.first_at is null
         )::int as overdue,
         percentile_cont(0.5) within group (
           order by extract(epoch from (response.first_at - r.created_at)) / 60
         ) as median_minutes
  from specialist_profiles p
  left join plan_requests r on r.assigned_specialist_id = p.user_id
  left join lateral (
    select min(e.created_at) as first_at
    from request_events e
    where e.request_id = r.id and e.kind = any ($2::text[])
  ) response on true
  where $1::uuid is null or p.user_id = $1
  group by p.user_id, p.display_name
  order by p.display_name
`;
