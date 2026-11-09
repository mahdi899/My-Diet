import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { uuidv7 } from '../common/id.js';
import type { Queryable } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import type { CardSpec, CardType, CoachMessage, EntryItem, Json, MacroTotals, MealType, MemoryItem } from './types.js';

export interface ThreadRow {
  id: string;
  userId: string;
  summary: string;
  summaryUptoSeq: number;
  dayBriefDate: string | null;
}

interface MessageRow {
  id: string;
  seq: number;
  role: CoachMessage['role'];
  type: CardType;
  payload: Json;
  fallback_text: string;
  client_message_id: string | null;
  reply_to: string | null;
  created_at: Date;
}

const MESSAGE_COLUMNS = `id, seq::float8 as seq, role, type, payload, fallback_text, client_message_id, reply_to, created_at`;

export const messageView = (row: MessageRow): CoachMessage => ({
  id: row.id,
  seq: Number(row.seq),
  role: row.role,
  type: row.type,
  payload: row.payload,
  fallbackText: row.fallback_text,
  clientMessageId: row.client_message_id,
  replyTo: row.reply_to,
  createdAt: row.created_at.toISOString(),
});

export interface NewMessage {
  threadId: string;
  userId: string;
  role: CoachMessage['role'];
  card: CardSpec;
  clientMessageId?: string | null;
  replyTo?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

export interface FoodEntryRow {
  id: string;
  userId: string;
  threadId: string | null;
  messageId: string | null;
  mediaId: string | null;
  civilDate: string;
  mealType: MealType;
  title: string;
  source: 'photo' | 'suggestion' | 'manual';
  items: EntryItem[];
  totals: MacroTotals;
  confidence: number | null;
  status: 'suggested' | 'logged';
  planMealUid: string | null;
}

interface EntryDb {
  id: string;
  user_id: string;
  thread_id: string | null;
  message_id: string | null;
  media_id: string | null;
  civil_date: string;
  meal_type: MealType;
  title: string;
  source: FoodEntryRow['source'];
  items: EntryItem[];
  totals: MacroTotals;
  confidence: string | null;
  status: FoodEntryRow['status'];
  plan_meal_uid: string | null;
}

const entryView = (row: EntryDb): FoodEntryRow => ({
  id: row.id,
  userId: row.user_id,
  threadId: row.thread_id,
  messageId: row.message_id,
  mediaId: row.media_id,
  civilDate: row.civil_date,
  mealType: row.meal_type,
  title: row.title,
  source: row.source,
  items: row.items,
  totals: row.totals,
  confidence: row.confidence == null ? null : Number(row.confidence),
  status: row.status,
  planMealUid: row.plan_meal_uid,
});

const ENTRY_COLUMNS = `id, user_id, thread_id, message_id, media_id, civil_date::text as civil_date, meal_type, title, source, items, totals,
  confidence::text as confidence, status, plan_meal_uid`;

export interface UsageRow {
  chatTurns: number;
  visionCalls: number;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
}

@Injectable()
export class CoachStore {
  constructor(@Inject(PG_POOL) readonly pool: Pool) {}

  // ----------------------------------------------------------------- threads

  async ensureThread(userId: string, db: Queryable = this.pool): Promise<ThreadRow> {
    await db.query(`insert into coach_threads (id, user_id) values ($1, $2) on conflict (user_id) do nothing`, [uuidv7(), userId]);
    const { rows } = await db.query<{ id: string; user_id: string; summary: string; summary_upto_seq: string; day_brief_date: string | null }>(
      `select id, user_id, summary, summary_upto_seq::text, day_brief_date::text as day_brief_date from coach_threads where user_id = $1`,
      [userId],
    );
    const row = rows[0]!;
    return { id: row.id, userId: row.user_id, summary: row.summary, summaryUptoSeq: Number(row.summary_upto_seq), dayBriefDate: row.day_brief_date };
  }

  /** Takes the single turn slot. False when another turn of this user is still running. */
  async acquireTurn(threadId: string, seconds = 90): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `update coach_threads set turn_lock_until = now() + make_interval(secs => $2)
       where id = $1 and (turn_lock_until is null or turn_lock_until < now())`,
      [threadId, seconds],
    );
    return (rowCount ?? 0) > 0;
  }

  async releaseTurn(threadId: string): Promise<void> {
    await this.pool.query(`update coach_threads set turn_lock_until = null where id = $1`, [threadId]);
  }

  async setDayBriefDate(threadId: string, date: string): Promise<void> {
    await this.pool.query(`update coach_threads set day_brief_date = $2, updated_at = now() where id = $1`, [threadId, date]);
  }

  async setSummary(threadId: string, summary: string, uptoSeq: number): Promise<void> {
    await this.pool.query(
      `update coach_threads set summary = $2, summary_upto_seq = greatest(summary_upto_seq, $3), updated_at = now() where id = $1`,
      [threadId, summary.slice(0, 1200), uptoSeq],
    );
  }

  // ---------------------------------------------------------------- messages

  async insertMessage(input: NewMessage, db: Queryable = this.pool): Promise<CoachMessage> {
    const { rows } = await db.query<MessageRow>(
      `insert into coach_messages (id, thread_id, user_id, role, type, payload, fallback_text, client_message_id, reply_to, model, tokens_in, tokens_out)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
       returning ${MESSAGE_COLUMNS}`,
      [
        uuidv7(), input.threadId, input.userId, input.role, input.card.type, JSON.stringify(input.card.payload),
        input.card.fallbackText.slice(0, 2000), input.clientMessageId ?? null, input.replyTo ?? null, input.model ?? null,
        input.tokensIn ?? null, input.tokensOut ?? null,
      ],
    );
    await db.query(`update coach_threads set last_message_at = now(), updated_at = now() where id = $1`, [input.threadId]);
    return messageView(rows[0]!);
  }

  /** Inserts the user's message once per clientMessageId. `existing` is true on a retry of the same id. */
  async insertUserMessage(input: NewMessage & { clientMessageId: string }): Promise<{ message: CoachMessage; existing: boolean }> {
    const found = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and client_message_id = $2`,
      [input.threadId, input.clientMessageId],
    );
    if (found.rows[0]) return { message: messageView(found.rows[0]), existing: true };
    try {
      return { message: await this.insertMessage(input), existing: false };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        const again = await this.pool.query<MessageRow>(
          `select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and client_message_id = $2`,
          [input.threadId, input.clientMessageId],
        );
        if (again.rows[0]) return { message: messageView(again.rows[0]), existing: true };
      }
      throw error;
    }
  }

  async byClient(threadId: string, clientMessageId: string): Promise<CoachMessage | null> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and client_message_id = $2`,
      [threadId, clientMessageId],
    );
    return rows[0] ? messageView(rows[0]) : null;
  }

  async message(userId: string, id: string): Promise<CoachMessage | null> {
    const { rows } = await this.pool.query<MessageRow>(`select ${MESSAGE_COLUMNS} from coach_messages where id = $1 and user_id = $2`, [id, userId]);
    return rows[0] ? messageView(rows[0]) : null;
  }

  async repliesTo(userId: string, messageId: string): Promise<CoachMessage[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from coach_messages where user_id = $1 and reply_to = $2 order by seq`,
      [userId, messageId],
    );
    return rows.map(messageView);
  }

  async updatePayload(userId: string, id: string, payload: Json, db: Queryable = this.pool): Promise<void> {
    await db.query(`update coach_messages set payload = $3::jsonb where id = $2 and user_id = $1`, [userId, id, JSON.stringify(payload)]);
  }

  /** Newest first by seq; `before` is a seq cursor. */
  async page(threadId: string, before: number | null, limit: number): Promise<{ items: CoachMessage[]; nextCursor: string | null }> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and ($2::bigint is null or seq < $2)
       order by seq desc limit $3`,
      [threadId, before, limit + 1],
    );
    const slice = rows.slice(0, limit);
    return {
      items: slice.map(messageView).reverse(),
      nextCursor: rows.length > limit ? String(slice[slice.length - 1]!.seq) : null,
    };
  }

  /** The last `limit` messages strictly before `seq`, oldest first. */
  async preceding(threadId: string, seq: number, limit: number): Promise<CoachMessage[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from (
         select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and seq < $2 order by seq desc limit $3
       ) t order by seq`,
      [threadId, seq, limit],
    );
    return rows.map(messageView);
  }

  async latestByType(threadId: string, type: CardType, date: string): Promise<CoachMessage | null> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from coach_messages
       where thread_id = $1 and type = $2 and payload->>'date' = $3 order by seq desc limit 1`,
      [threadId, type, date],
    );
    return rows[0] ? messageView(rows[0]) : null;
  }

  async recent(threadId: string, afterSeq: number, limit: number): Promise<CoachMessage[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} from (
         select ${MESSAGE_COLUMNS} from coach_messages where thread_id = $1 and seq > $2 order by seq desc limit $3
       ) t order by seq`,
      [threadId, afterSeq, limit],
    );
    return rows.map(messageView);
  }

  async userMessagesLastMinute(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from coach_messages where user_id = $1 and role = 'user' and type <> 'user_photo' and created_at > now() - interval '1 minute'`,
      [userId],
    );
    return rows[0]!.n;
  }

  async userSpoke(userId: string, afterSeq: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(`select 1 from coach_messages where user_id = $1 and role = 'user' and seq > $2 limit 1`, [userId, afterSeq]);
    return (rowCount ?? 0) > 0;
  }

  async lastUserMessageAt(userId: string): Promise<Date | null> {
    const { rows } = await this.pool.query<{ at: Date | null }>(`select max(created_at) as at from coach_messages where user_id = $1 and role = 'user'`, [userId]);
    return rows[0]?.at ?? null;
  }

  // ------------------------------------------------------------------- usage

  async usage(userId: string, day: string): Promise<UsageRow> {
    const { rows } = await this.pool.query<{ chat_turns: number; vision_calls: number; tokens_in: string; tokens_out: string; cost_micros: string }>(
      `select chat_turns, vision_calls, tokens_in::text, tokens_out::text, cost_micros::text from coach_usage where user_id = $1 and day = $2`,
      [userId, day],
    );
    const row = rows[0];
    return row
      ? { chatTurns: row.chat_turns, visionCalls: row.vision_calls, tokensIn: Number(row.tokens_in), tokensOut: Number(row.tokens_out), costMicros: Number(row.cost_micros) }
      : { chatTurns: 0, visionCalls: 0, tokensIn: 0, tokensOut: 0, costMicros: 0 };
  }

  async addUsage(userId: string, day: string, delta: Partial<UsageRow>): Promise<void> {
    await this.pool.query(
      `insert into coach_usage (user_id, day, chat_turns, vision_calls, tokens_in, tokens_out, cost_micros)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, day) do update set chat_turns = coach_usage.chat_turns + excluded.chat_turns,
         vision_calls = coach_usage.vision_calls + excluded.vision_calls, tokens_in = coach_usage.tokens_in + excluded.tokens_in,
         tokens_out = coach_usage.tokens_out + excluded.tokens_out, cost_micros = coach_usage.cost_micros + excluded.cost_micros, updated_at = now()`,
      [userId, day, delta.chatTurns ?? 0, delta.visionCalls ?? 0, delta.tokensIn ?? 0, delta.tokensOut ?? 0, delta.costMicros ?? 0],
    );
  }

  // ------------------------------------------------------------------ memory

  async memories(userId: string, limit = 20): Promise<MemoryItem[]> {
    const { rows } = await this.pool.query<MemoryItem>(
      `select id, kind, content, importance::int as importance from coach_memory
       where user_id = $1 and archived_at is null order by importance desc, created_at desc limit $2`,
      [userId, limit],
    );
    return rows;
  }

  /** Saves one memory. Returns false when the same text already exists. Keeps at most 40 active rows per user. */
  async saveMemory(userId: string, kind: string, content: string, source: 'tool' | 'extractor' | 'user', importance = 3): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `insert into coach_memory (id, user_id, kind, content, source, importance) values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
      [uuidv7(), userId, kind, content, source, importance],
    );
    if (!rowCount) return false;
    await this.pool.query(
      `update coach_memory set archived_at = now() where id in (
         select id from coach_memory where user_id = $1 and archived_at is null
         order by importance desc, created_at desc offset 40)`,
      [userId],
    );
    return true;
  }

  async touchMemories(ids: string[]): Promise<void> {
    if (ids.length) await this.pool.query(`update coach_memory set last_used_at = now() where id = any($1::uuid[])`, [ids]);
  }

  async archiveMemory(userId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`update coach_memory set archived_at = now() where id = $1 and user_id = $2 and archived_at is null`, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------- engagement

  /** Records an event once per dedupeKey. Returns false when it already existed. */
  async engage(userId: string, kind: string, day: string, detail: Json = {}, dedupeKey: string | null = null, db: Queryable = this.pool): Promise<boolean> {
    const { rowCount } = await db.query(
      `insert into coach_engagement (id, user_id, kind, day, detail, dedupe_key) values ($1, $2, $3, $4, $5::jsonb, $6) on conflict do nothing`,
      [uuidv7(), userId, kind, day, JSON.stringify(detail), dedupeKey],
    );
    return (rowCount ?? 0) > 0;
  }

  async lastEngagement(userId: string, kind: string): Promise<{ at: Date; detail: Json } | null> {
    const { rows } = await this.pool.query<{ at: Date; detail: Json }>(
      `select created_at as at, detail from coach_engagement where user_id = $1 and kind = $2 order by created_at desc limit 1`,
      [userId, kind],
    );
    return rows[0] ?? null;
  }

  async engagementSince(userId: string, kinds: string[], since: Date): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from coach_engagement where user_id = $1 and kind = any($2::text[]) and created_at >= $3`,
      [userId, kinds, since],
    );
    return rows[0]!.n;
  }

  async engagementOn(userId: string, day: string, kinds: string[]): Promise<Array<{ kind: string; detail: Json }>> {
    const { rows } = await this.pool.query<{ kind: string; detail: Json }>(
      `select kind, detail from coach_engagement where user_id = $1 and day = $2 and kind = any($3::text[])`,
      [userId, day, kinds],
    );
    return rows;
  }

  async dedupeKeys(userId: string, kind: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ dedupe_key: string }>(
      `select dedupe_key from coach_engagement where user_id = $1 and kind = $2 and dedupe_key is not null`,
      [userId, kind],
    );
    return rows.map((row) => row.dedupe_key);
  }

  async peekNextStep(userId: string, now: Date): Promise<string | null> {
    const { rows } = await this.pool.query<{ detail: Json }>(
      `select detail from coach_engagement
       where user_id = $1 and kind = 'next_step'
         and coalesce(detail->>'sent', 'false') <> 'true'
         and (detail->>'dueAt')::timestamptz <= $2
       order by created_at limit 1`,
      [userId, now.toISOString()],
    );
    const note = rows[0]?.detail?.note;
    return typeof note === 'string' ? note : rows[0] ? 'پیگیری' : null;
  }

  /** Marks the oldest due follow-up as sent and returns its note. Null when nothing is due. */
  async claimNextStep(userId: string, now: Date): Promise<{ id: string; note: string } | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ id: string; detail: Json }>(
        `select id, detail from coach_engagement
         where user_id = $1 and kind = 'next_step'
           and coalesce(detail->>'sent', 'false') <> 'true'
           and (detail->>'dueAt')::timestamptz <= $2
         order by created_at
         limit 1
         for update skip locked`,
        [userId, now.toISOString()],
      );
      const row = rows[0];
      if (!row) {
        await client.query('commit');
        return null;
      }
      await client.query(`update coach_engagement set detail = detail || '{"sent":true}'::jsonb where id = $1`, [row.id]);
      await client.query('commit');
      const note = typeof row.detail.note === 'string' ? row.detail.note : 'پیگیری';
      return { id: row.id, note };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async proactiveUserIds(after: string | null, limit: number): Promise<string[]> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      `select user_id from nutrition_profiles where ($1::uuid is null or user_id > $1) order by user_id limit $2`,
      [after, limit],
    );
    return rows.map((row) => row.user_id);
  }

  async recentSuggestedSlugs(userId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ items: EntryItem[] }>(
      `select items from coach_food_entries
       where user_id = $1 and source = 'suggestion' and created_at > now() - interval '14 days'
       order by created_at desc limit 15`,
      [userId],
    );
    const slugs: string[] = [];
    for (const row of rows) for (const item of row.items ?? []) if (item.slug) slugs.push(item.slug);
    return [...new Set(slugs)];
  }

  async startingWeightKg(userId: string): Promise<number | null> {
    const { rows } = await this.pool.query<{ weight_kg: string }>(
      `select weight_kg::text from nutrition_profiles where user_id = $1`,
      [userId],
    );
    return rows[0] ? Number(rows[0].weight_kg) : null;
  }

  async countEngagementToday(userId: string, day: string, kinds: string[]): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from coach_engagement where user_id = $1 and day = $2 and kind = any($3::text[])`,
      [userId, day, kinds],
    );
    return rows[0]!.n;
  }

  // ------------------------------------------------------------------- water

  async water(userId: string, day: string): Promise<number> {
    const { rows } = await this.pool.query<{ ml: number }>(`select ml from coach_water where user_id = $1 and civil_date = $2`, [userId, day]);
    return rows[0]?.ml ?? 0;
  }

  async addWater(userId: string, day: string, ml: number): Promise<number> {
    const { rows } = await this.pool.query<{ ml: number }>(
      `insert into coach_water (user_id, civil_date, ml) values ($1, $2, $3)
       on conflict (user_id, civil_date) do update set ml = least(10000, coach_water.ml + excluded.ml), updated_at = now() returning ml`,
      [userId, day, ml],
    );
    return rows[0]!.ml;
  }

  // ------------------------------------------------------------ food entries

  async createEntry(
    input: {
      userId: string;
      threadId: string | null;
      messageId?: string | null;
      mediaId?: string | null;
      civilDate: string;
      mealType: MealType;
      title: string;
      source: FoodEntryRow['source'];
      items: EntryItem[];
      totals: MacroTotals;
      confidence: number | null;
      status: FoodEntryRow['status'];
      planMealUid?: string | null;
    },
    db: Queryable = this.pool,
  ): Promise<FoodEntryRow> {
    const { rows } = await db.query<EntryDb>(
      `insert into coach_food_entries (id, user_id, thread_id, message_id, media_id, civil_date, meal_type, title, source, items, totals, confidence, status, plan_meal_uid, logged_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, case when $13 = 'logged' then now() end)
       returning ${ENTRY_COLUMNS}`,
      [
        uuidv7(), input.userId, input.threadId, input.messageId ?? null, input.mediaId ?? null, input.civilDate, input.mealType, input.title.slice(0, 200),
        input.source, JSON.stringify(input.items), JSON.stringify(input.totals), input.confidence, input.status, input.planMealUid ?? null,
      ],
    );
    return entryView(rows[0]!);
  }

  async attachEntryMessage(entryId: string, messageId: string): Promise<void> {
    await this.pool.query(`update coach_food_entries set message_id = $2 where id = $1`, [entryId, messageId]);
  }

  async entry(userId: string, id: string, db: Queryable = this.pool): Promise<FoodEntryRow | null> {
    const { rows } = await db.query<EntryDb>(`select ${ENTRY_COLUMNS} from coach_food_entries where id = $1 and user_id = $2`, [id, userId]);
    return rows[0] ? entryView(rows[0]) : null;
  }

  async entryByMessage(userId: string, messageId: string): Promise<FoodEntryRow | null> {
    const { rows } = await this.pool.query<EntryDb>(`select ${ENTRY_COLUMNS} from coach_food_entries where message_id = $1 and user_id = $2`, [messageId, userId]);
    return rows[0] ? entryView(rows[0]) : null;
  }

  async loggedEntries(userId: string, from: string, to: string): Promise<FoodEntryRow[]> {
    const { rows } = await this.pool.query<EntryDb>(
      `select ${ENTRY_COLUMNS} from coach_food_entries where user_id = $1 and civil_date between $2 and $3 and status = 'logged' order by logged_at`,
      [userId, from, to],
    );
    return rows.map(entryView);
  }

  async updateEntry(
    userId: string,
    id: string,
    patch: { title: string; mealType: MealType; items: EntryItem[]; totals: MacroTotals; status: FoodEntryRow['status']; planMealUid?: string | null },
    db: Queryable = this.pool,
  ): Promise<FoodEntryRow> {
    const { rows } = await db.query<EntryDb>(
      `update coach_food_entries set title = $3, meal_type = $4, items = $5::jsonb, totals = $6::jsonb, status = $7,
         plan_meal_uid = coalesce($8, plan_meal_uid), logged_at = case when $7 = 'logged' then coalesce(logged_at, now()) else logged_at end, updated_at = now()
       where id = $2 and user_id = $1 returning ${ENTRY_COLUMNS}`,
      [userId, id, patch.title.slice(0, 200), patch.mealType, JSON.stringify(patch.items), JSON.stringify(patch.totals), patch.status, patch.planMealUid ?? null],
    );
    return entryView(rows[0]!);
  }

  // ------------------------------------------------------------------- media

  async saveMedia(userId: string, mime: string, content: Buffer, db: Queryable = this.pool): Promise<string> {
    const id = uuidv7();
    await db.query(`insert into coach_media (id, user_id, mime, byte_size, content) values ($1, $2, $3, $4, $5)`, [id, userId, mime, content.byteLength, content]);
    return id;
  }

  async media(userId: string, id: string): Promise<{ mime: string; content: Buffer } | null> {
    const { rows } = await this.pool.query<{ mime: string; content: Buffer }>(`select mime, content from coach_media where id = $1 and user_id = $2`, [id, userId]);
    return rows[0] ?? null;
  }

  async connect(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
