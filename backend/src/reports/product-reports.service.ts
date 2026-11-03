import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { PG_REPLICA } from '../database/database.js';
import { withReadOnly } from '../database/read-only.js';
import {
  RETENTION_EVENTS,
  RETENTION_WINDOWS,
  average,
  foodKey,
  rankLabels,
  retentionCell,
  sortBoard,
  ageDays,
  type BoardRow,
  type RetentionEvent,
} from './metrics.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ProductReportsService {
  constructor(@Inject(PG_REPLICA) private readonly replica: Pool) {}

  async retention(from: string, to: string, event: string) {
    if (!DATE.test(from) || !DATE.test(to) || from > to) return { status: 'invalid' as const, rows: [] };
    if (!isEvent(event)) throw new ApiError(400, 'validation', 'رویداد بازگشت نامعتبر است');
    const counts = await withReadOnly(this.replica, (client) => client.query<{
      started_on: string; size: number; week1: number; week2: number; week4: number;
    }>(retentionSql(event), [from, to]));
    const rows = counts.rows.map((row) => {
      const startedOn = row.started_on.slice(0, 10);
      const age = ageDays(startedOn, to);
      const size = Number(row.size);
      const measured = { week1: Number(row.week1), week2: Number(row.week2), week4: Number(row.week4) };
      return {
        id: startedOn,
        label: startedOn,
        size,
        ageDays: age,
        cells: Object.fromEntries(RETENTION_WINDOWS.map((window) => [
          window.key,
          retentionCell(age, window.days, measured[window.key], size),
        ])),
      };
    });
    return {
      status: rows.length ? 'ready' as const : 'empty' as const,
      from,
      to,
      asOf: to,
      event,
      definition: RETENTION_EVENTS[event],
      anchor: 'first_paid_new_plan',
      rows,
    };
  }

  async foods(from: string, to: string, kind: string) {
    if (!DATE.test(from) || !DATE.test(to) || from > to) return { status: 'invalid' as const, rows: [] };
    if (!['selected', 'alternative', 'disliked', 'reason'].includes(kind)) {
      throw new ApiError(400, 'validation', 'نوع رتبه‌بندی شناخته نشد');
    }
    const events = await withReadOnly(this.replica, async (client) => {
      if (kind === 'reason') {
        const reasons = await client.query<{ reason_id: string; reason_label: string }>(
          `select reason_id, reason_label from meal_selections
           where civil_date between $1::date and $2::date and reason_id is not null`,
          [from, to],
        );
        return reasons.rows.map((row) => ({ id: row.reason_id, label: row.reason_label }));
      }
      if (kind === 'disliked') {
        const items = await client.query<{ item: string; title: string | null }>(
          `select item.value as item, o.document->>'title' as title
           from weekly_feedback f
           cross join lateral jsonb_array_elements_text(f.dislikes) as item(value)
           left join plan_meal_options o on o.option_uid::text = item.value
           where f.week_start between $1::date and $2::date`,
          [from, to],
        );
        return items.rows.map((row) => ({ id: row.title ?? row.item, label: row.title ?? row.item }));
      }
      const selected = await client.query<{ title: string; kind: string }>(
        `select o.document->>'title' as title, o.kind
         from meal_selections s
         join plan_meal_options o on o.meal_id = s.meal_id and o.option_uid = s.option_uid
         where s.civil_date between $1::date and $2::date
           and ($3::text = 'selected' or o.kind <> 'primary')`,
        [from, to, kind],
      );
      return selected.rows.filter((row) => row.title).map((row) => ({ id: row.title, label: row.title }));
    });
    const rows = rankLabels(events).map((row) => ({ ...row, uncertain: foodKey(row.label).uncertain }));
    return {
      status: rows.length ? 'ready' as const : 'empty' as const,
      kind,
      matching: 'exact_normalized_label',
      rows,
    };
  }

  async feedback(from: string, to: string) {
    if (!DATE.test(from) || !DATE.test(to) || from > to) return { status: 'invalid' as const };
    const stats = await withReadOnly(this.replica, (client) => client.query<{ eligible: number; submitted: number; continued: number }>(
      `with eligible as (
         select distinct r.user_id
         from plan_requests r
         where r.status = 'published' and r.week_start between $1::date and $2::date
       ),
       first_orders as (
         select distinct on (user_id) user_id, created_at
         from orders where status = 'paid'
         order by user_id, created_at, id
       )
       select
         (select count(*)::int from eligible) as eligible,
         (select count(distinct f.user_id)::int from weekly_feedback f
            join eligible e on e.user_id = f.user_id
            where f.week_start between $1::date and $2::date) as submitted,
         (select count(distinct e.user_id)::int from eligible e
            join first_orders first on first.user_id = e.user_id
            join orders later on later.user_id = e.user_id and later.status = 'paid' and later.created_at > first.created_at
            where (later.created_at + interval '3 hours 30 minutes')::date between $1::date and $2::date) as continued`,
      [from, to],
    ));
    const row = stats.rows[0];
    const eligible = Number(row?.eligible ?? 0);
    if (eligible === 0) return { status: 'empty' as const };
    const submitted = Number(row?.submitted ?? 0);
    const continued = Number(row?.continued ?? 0);
    return {
      status: 'ready' as const,
      participation: { count: submitted, denominator: eligible, percent: Math.round((100 * submitted) / eligible) },
      continuation: { count: continued, denominator: eligible, percent: Math.round((100 * continued) / eligible) },
      continuationSeparateFromFeedback: true,
    };
  }

  async specialists(sort: string) {
    if (sort !== 'rating' && sort !== 'response' && sort !== 'workload') {
      throw new ApiError(400, 'validation', 'ترتیب رتبه‌بندی نامعتبر است');
    }
    const rows = await withReadOnly(this.replica, async (client) => {
      const people = await client.query<{ user_id: string; display_name: string }>(
        `select user_id, display_name from specialist_profiles order by display_name`,
      );
      const ratings = await client.query<{ specialist_id: string; rating: number }>(
        `select r.assigned_specialist_id as specialist_id, pr.rating
         from program_reviews pr
         join plan_requests r on r.id = pr.request_id
         where r.assigned_specialist_id is not null`,
      );
      const messages = await client.query<{ specialist_id: string; asked_at: Date; replied_at: Date | null }>(
        `with first_customer as (
           select c.id as conversation_id, r.assigned_specialist_id as specialist_id, min(m.created_at) as asked_at
           from conversations c
           join plan_requests r on r.id = c.request_id
           join messages m on m.conversation_id = c.id and m.author_id = r.user_id and m.kind <> 'system'
           where c.kind = 'care' and r.assigned_specialist_id is not null
           group by c.id, r.assigned_specialist_id
         )
         select fc.specialist_id, fc.asked_at, min(reply.created_at) as replied_at
         from first_customer fc
         left join messages reply on reply.conversation_id = fc.conversation_id
           and reply.author_id = fc.specialist_id and reply.kind <> 'system' and reply.created_at > fc.asked_at
         group by fc.specialist_id, fc.conversation_id, fc.asked_at`,
      );
      const changes = await client.query<{
        specialist_id: string; status: string; created_at: Date; first_responded_at: Date | null; updated_at: Date;
      }>(
        `select r.assigned_specialist_id as specialist_id, c.status, c.created_at, c.first_responded_at, c.updated_at
         from plan_change_requests c
         join plan_requests r on r.id = c.plan_request_id
         where r.assigned_specialist_id is not null`,
      );
      return people.rows.map((person) => {
        const stars = ratings.rows.filter((row) => row.specialist_id === person.user_id).map((row) => row.rating);
        const replies = messages.rows.filter((row) => row.specialist_id === person.user_id);
        const answered = replies.filter((row) => row.replied_at).map((row) => minutesBetween(row.asked_at, row.replied_at!));
        const ownChanges = changes.rows.filter((row) => row.specialist_id === person.user_id);
        const firstResponses = ownChanges
          .filter((row) => row.first_responded_at)
          .map((row) => minutesBetween(row.created_at, row.first_responded_at!));
        const resolutions = ownChanges
          .filter((row) => row.status === 'approved' || row.status === 'rejected')
          .map((row) => minutesBetween(row.created_at, row.updated_at));
        const pendingMessages = replies.filter((row) => !row.replied_at).length;
        const pendingChanges = ownChanges.filter((row) => row.status === 'awaiting_review' || row.status === 'under_review').length;
        const board: BoardRow = {
          id: person.user_id,
          name: person.display_name,
          ratingCount: stars.length,
          ratingAverage: average(stars),
          smallSample: stars.length > 0 && stars.length < 5,
          distribution: [1, 2, 3, 4, 5].map((star) => ({ star, count: stars.filter((value) => value === star).length })),
          messageResponse: average(answered),
          messageSamples: answered.length,
          changeResponse: average(firstResponses),
          changeResponseSamples: firstResponses.length,
          reviewTime: average(resolutions),
          reviewSamples: resolutions.length,
          pendingMessages,
          pendingChanges,
          pending: pendingMessages + pendingChanges,
        };
        return board;
      });
    });
    return {
      sort,
      timing: 'elapsed_minutes',
      businessHours: false,
      unanswered: 'excluded_from_average',
      automaticMessages: 'excluded',
      moderation: 'ratings_kept',
      rows: sortBoard(rows, sort),
    };
  }
}

function isEvent(value: string): value is RetentionEvent {
  return value === 'activity' || value === 'tracking' || value === 'purchase';
}

function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

function retentionSql(event: RetentionEvent): string {
  const within = (days: number) => {
    if (event === 'activity') {
      return `exists (
        select 1 from sessions s where s.user_id = f.user_id and (
          ((s.created_at + interval '3 hours 30 minutes')::date > f.started_on
            and (s.created_at + interval '3 hours 30 minutes')::date <= f.started_on + ${days})
          or (s.last_seen_at is not null
            and (s.last_seen_at + interval '3 hours 30 minutes')::date > f.started_on
            and (s.last_seen_at + interval '3 hours 30 minutes')::date <= f.started_on + ${days})
        ))`;
    }
    if (event === 'tracking') {
      return `exists (
        select 1 from meal_logs m where m.user_id = f.user_id
          and m.scheduled_date > f.started_on and m.scheduled_date <= f.started_on + ${days}
          and (m.eaten or coalesce(m.details->>'state','') in ('as_planned','less','more','different')))`;
    }
    return `exists (
      select 1 from orders later where later.user_id = f.user_id and later.status = 'paid' and later.id <> f.order_id
        and (later.created_at + interval '3 hours 30 minutes')::date > f.started_on
        and (later.created_at + interval '3 hours 30 minutes')::date <= f.started_on + ${days})`;
  };
  return `with first_orders as (
    select distinct on (user_id) user_id, id as order_id, (created_at + interval '3 hours 30 minutes')::date as started_on
    from orders where status = 'paid' and service_code = 'new_plan'
    order by user_id, created_at, id
  )
  select started_on::text, count(*)::int as size,
    count(*) filter (where ${within(7)})::int as week1,
    count(*) filter (where ${within(14)})::int as week2,
    count(*) filter (where ${within(28)})::int as week4
  from first_orders f
  where started_on between $1::date and $2::date
  group by started_on
  order by started_on`;
}
