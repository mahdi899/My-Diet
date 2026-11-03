import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { notify, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import { inspectMedia, type MediaPurpose } from './media.js';

@Injectable()
export class MessagingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(userId: string) {
    const rows = await this.pool.query<{
      id: string;
      kind: string;
      request_id: string | null;
      created_at: Date;
    }>(
      `select c.id, c.kind, c.request_id, c.created_at
       from conversations c
       join conversation_participants p on p.conversation_id = c.id
       join users viewer on viewer.id=p.user_id
       left join plan_requests r on r.id=c.request_id
       where p.user_id = $1
         and (c.kind<>'care' or viewer.role<>'specialist' or r.assigned_specialist_id=$1)
       order by c.created_at desc`,
      [userId],
    );
    if (rows.rows.length === 0) return [];
    const unread = await this.pool.query<{ id: string; n: number }>(
      `select c.id, count(m.id)::int as n
       from conversations c
       join conversation_participants p on p.conversation_id=c.id and p.user_id=$1
       left join messages m on m.conversation_id=c.id and m.author_id<>$1
         and m.created_at > coalesce(p.last_read_at, '-infinity')
       where c.id = any($2::uuid[])
       group by c.id`,
      [userId, rows.rows.map((row) => row.id)],
    );
    const counts = new Map(unread.rows.map((row) => [row.id, row.n]));
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      requestId: row.request_id,
      createdAt: row.created_at.toISOString(),
      unreadCount: counts.get(row.id) ?? 0,
    }));
  }

  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const rows = await this.pool.query<{
      id: string; author_id: string; body: string; created_at: Date; kind: string; position: string; media_id: string | null;
    }>(
      `select id, author_id, body, created_at, kind, position, media_id from messages
       where conversation_id = $1 order by position`,
      [conversationId],
    );
    return rows.rows.map((row) => this.messageView(row));
  }

  async timeline(userId: string, conversationId: string, after: number | null, limit: number) {
    await this.assertParticipant(userId, conversationId);
    const rows = await this.pool.query<{
      id: string; author_id: string; body: string; created_at: Date; kind: string; position: string; media_id: string | null;
    }>(
      `select id, author_id, body, created_at, kind, position, media_id from messages
       where conversation_id = $1 and ($2::bigint is null or position > $2)
       order by position limit $3`,
      [conversationId, after, limit + 1],
    );
    const page = rows.rows.slice(0, limit).map((row) => this.messageView(row));
    const next = rows.rows.length > limit ? page[page.length - 1]?.position ?? null : null;
    return { messages: page, nextCursor: next };
  }

  /** Chat never answers an information question and never changes a plan status. */
  async post(userId: string, conversationId: string, body: string) {
    return this.postRich(userId, conversationId, { body });
  }

  async postRich(userId: string, conversationId: string, input: { body?: string; clientRequestId?: string; mediaId?: string }) {
    const text = input.body?.trim() ?? '';
    if (!text && !input.mediaId) throw new ApiError(400, 'validation', 'متن یا رسانه لازم است');
    return withTransaction(this.pool, async (client) => {
      await this.assertParticipant(userId, conversationId, client);
      if (input.clientRequestId) {
        const prior = await client.query<{ id: string }>(
          `select id from messages where conversation_id=$1 and author_id=$2 and client_request_id=$3`,
          [conversationId, userId, input.clientRequestId],
        );
        if (prior.rows[0]) return { id: prior.rows[0].id, duplicate: true };
      }
      let kind: 'text' | 'image' | 'voice' = 'text';
      if (input.mediaId) {
        const media = await client.query<{ purpose: 'image' | 'voice'; status: string }>(
          `select purpose, status from media_objects where id=$1 and owner_id=$2 and conversation_id=$3`,
          [input.mediaId, userId, conversationId],
        );
        const row = media.rows[0];
        if (!row || row.status !== 'ready') throw new ApiError(404, 'not_found', 'رسانه آماده نیست');
        kind = row.purpose;
      }
      const id = uuidv7();
      await client.query(
        `insert into messages (id, conversation_id, author_id, body, kind, client_request_id, media_id)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, conversationId, userId, text, kind, input.clientRequestId ?? null, input.mediaId ?? null],
      );
      await client.query(
        `insert into message_receipts (message_id, user_id)
         select $1, user_id from conversation_participants where conversation_id=$2 and user_id<>$3`,
        [id, conversationId, userId],
      );
      const others = await client.query<{ user_id: string }>(
        `select user_id from conversation_participants where conversation_id=$1 and user_id<>$2`,
        [conversationId, userId],
      );
      for (const person of others.rows) await notify(client, person.user_id, 'message', { conversationId });
      return { id, duplicate: false, persisted: true };
    });
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const result = await this.pool.query(
      `update conversation_participants set last_read_at = now()
       where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'گفتگو پیدا نشد');
    return { ok: true };
  }

  async openSupport(userId: string) {
    const existing = await this.pool.query<{ id: string }>(
      `select id from conversations where user_id = $1 and kind = 'support' order by created_at limit 1`,
      [userId],
    );
    if (existing.rows[0]) return { id: existing.rows[0].id };
    const id = uuidv7();
    await this.pool.query(`insert into conversations (id, kind, user_id) values ($1, 'support', $2)`, [id, userId]);
    await this.pool.query(
      `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
      [id, userId],
    );
    return { id };
  }

  async openCare(userId: string) {
    const request = await this.pool.query<{ id: string; assigned_specialist_id: string }>(
      `select id, assigned_specialist_id from plan_requests
       where user_id=$1 and assigned_specialist_id is not null and status <> 'cancelled'
       order by created_at desc limit 1`,
      [userId],
    );
    const assigned = request.rows[0];
    if (!assigned) throw new ApiError(409, 'no_specialist', 'متخصص فعالی برای گفتگو تعیین نشده است');
    return withTransaction(this.pool, async (client) => {
      const existing = await client.query<{ id: string }>(
        `select id from conversations where request_id=$1 and kind='care' limit 1`,
        [assigned.id],
      );
      let id = existing.rows[0]?.id;
      if (!id) {
        id = uuidv7();
        await client.query(
          `insert into conversations (id, kind, user_id, request_id) values ($1,'care',$2,$3)`,
          [id, userId, assigned.id],
        );
      }
      await client.query(
        `insert into conversation_participants (conversation_id, user_id) values ($1,$2),($1,$3) on conflict do nothing`,
        [id, userId, assigned.assigned_specialist_id],
      );
      const system = await client.query(
        `select 1 from messages where conversation_id=$1 and kind='system' limit 1`,
        [id],
      );
      if ((system.rowCount ?? 0) === 0) {
        await client.query(
          `insert into messages (id, conversation_id, author_id, body, kind) values ($1,$2,$3,$4,'system')`,
          [uuidv7(), id, userId, 'گفتگوی مراقبت باز شد'],
        );
      }
      return { id, specialistId: assigned.assigned_specialist_id };
    });
  }

  async beginMedia(userId: string, conversationId: string, purpose: MediaPurpose, declaredType: string, voiceDurationMs: number | null) {
    await this.assertParticipant(userId, conversationId);
    if (purpose === 'voice' && (voiceDurationMs == null || voiceDurationMs < 1 || voiceDurationMs > 300_000)) {
      throw new ApiError(400, 'validation', 'مدت صوت معتبر نیست');
    }
    const id = uuidv7();
    await this.pool.query(
      `insert into media_objects (id, owner_id, conversation_id, purpose, status, declared_type, storage_key, voice_duration_ms, expires_at)
       values ($1,$2,$3,$4,'pending',$5,$6,$7, now() + interval '15 minutes')`,
      [id, userId, conversationId, purpose, declaredType, `media/${id}`, voiceDurationMs],
    );
    return { id, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
  }

  async finishMedia(userId: string, mediaId: string, bytes: Buffer, declaredType: string) {
    let failure: 'expired' | 'invalid' | null = null;
    const saved = await withTransaction(this.pool, async (client) => {
      const row = await client.query<{ conversation_id: string; purpose: MediaPurpose; status: string; expires_at: Date; declared_type: string }>(
        `select conversation_id, purpose, status, expires_at, declared_type from media_objects where id=$1 and owner_id=$2 for update`,
        [mediaId, userId],
      );
      const media = row.rows[0];
      if (!media) throw new ApiError(404, 'not_found', 'رسانه پیدا نشد');
      await this.assertParticipant(userId, media.conversation_id, client);
      if (media.status !== 'pending' || media.expires_at.getTime() <= Date.now()) {
        await client.query(`update media_objects set status='expired' where id=$1 and status='pending'`, [mediaId]);
        failure = 'expired';
        return null;
      }
      if (declaredType !== media.declared_type) throw new ApiError(400, 'validation', 'نوع رسانه با شروع بارگذاری یکی نیست');
      let detected: ReturnType<typeof inspectMedia>;
      try {
        detected = inspectMedia(media.purpose, declaredType, bytes);
      } catch {
        await client.query(`update media_objects set status='quarantined' where id=$1`, [mediaId]);
        failure = 'invalid';
        return null;
      }
      await client.query(`insert into media_bytes (media_id, content) values ($1,$2)`, [mediaId, bytes]);
      await client.query(
        `update media_objects set status='ready', detected_type=$2, byte_size=$3 where id=$1`,
        [mediaId, detected, bytes.length],
      );
      return { id: mediaId, status: 'ready' as const, detectedType: detected };
    });
    if (failure === 'expired') throw new ApiError(409, 'upload_expired', 'مهلت بارگذاری تمام شده است');
    if (failure === 'invalid') throw new ApiError(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
    return saved!;
  }

  async grantMedia(userId: string, mediaId: string) {
    const media = await this.pool.query<{ conversation_id: string; status: string }>(
      `select conversation_id, status from media_objects where id=$1`,
      [mediaId],
    );
    const row = media.rows[0];
    if (!row || row.status !== 'ready') throw new ApiError(404, 'not_found', 'رسانه پیدا نشد');
    await this.assertParticipant(userId, row.conversation_id);
    const token = randomBytes(32).toString('base64url');
    await this.pool.query(
      `insert into media_access_grants (id, media_id, user_id, token_hash, expires_at)
       values ($1,$2,$3,$4, now() + interval '60 seconds')`,
      [uuidv7(), mediaId, userId, createHash('sha256').update(token).digest('hex')],
    );
    return { grant: token, expiresInSeconds: 60 };
  }

  async readMedia(userId: string, mediaId: string, grant: string) {
    const hash = createHash('sha256').update(grant).digest('hex');
    const row = await this.pool.query<{ content: Buffer; detected_type: string; conversation_id: string }>(
      `select b.content, o.detected_type, o.conversation_id
       from media_access_grants g
       join media_objects o on o.id=g.media_id
       join media_bytes b on b.media_id=o.id
       where g.media_id=$1 and g.user_id=$2 and g.token_hash=$3 and g.expires_at > now() and o.status='ready'`,
      [mediaId, userId, hash],
    );
    const media = row.rows[0];
    if (!media) throw new ApiError(404, 'not_found', 'دسترسی رسانه معتبر نیست');
    await this.assertParticipant(userId, media.conversation_id);
    return { detectedType: media.detected_type, contentBase64: Buffer.from(media.content).toString('base64') };
  }

  async receipt(userId: string, conversationId: string, messageId: string, state: 'delivered' | 'read') {
    await this.assertParticipant(userId, conversationId);
    const message = await this.pool.query<{ author_id: string }>(
      `select author_id from messages where id=$1 and conversation_id=$2`,
      [messageId, conversationId],
    );
    if (!message.rows[0]) throw new ApiError(404, 'not_found', 'پیام پیدا نشد');
    if (message.rows[0].author_id === userId) throw new ApiError(409, 'not_recipient', 'فرستنده رسید خودش را ثبت نمی‌کند');
    const column = state === 'delivered' ? 'delivered_at' : 'read_at';
    const updated = await this.pool.query(
      `update message_receipts set ${column}=coalesce(${column}, now()) where message_id=$1 and user_id=$2`,
      [messageId, userId],
    );
    if ((updated.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'رسید پیدا نشد');
    if (state === 'read') {
      await this.pool.query(
        `update conversation_participants set last_read_at=now() where conversation_id=$1 and user_id=$2`,
        [conversationId, userId],
      );
    }
    return { messageId, state, persisted: true };
  }

  async expireMedia(now = new Date()) {
    const result = await this.pool.query(
      `update media_objects set status='expired'
       where status='pending' and expires_at <= $1`,
      [now],
    );
    return { expired: result.rowCount ?? 0 };
  }

  private messageView(row: {
    id: string; author_id: string; body: string; created_at: Date; kind: string; position: string; media_id: string | null;
  }) {
    return {
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      kind: row.kind,
      mediaId: row.media_id,
      position: Number(row.position),
      createdAt: row.created_at.toISOString(),
    };
  }

  async sync(userId: string, since: Date | null) {
    const notes = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from notifications
       where user_id = $1 and read_at is null and ($2::timestamptz is null or created_at > $2)`,
      [userId, since],
    );
    const questions = await this.pool.query<{ n: number }>(
      `select count(*)::int as n
       from info_questions q
       join plan_requests r on r.id = q.request_id
       where r.user_id = $1 and q.status in ('open', 'answered')`,
      [userId],
    );
    const rewards = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from weekly_rewards where user_id = $1 and acknowledged_at is null`,
      [userId],
    );
    const request = await this.pool.query<{ id: string; status: string }>(
      `select id, status from plan_requests where user_id = $1 order by created_at desc limit 1`,
      [userId],
    );
    return {
      unreadNotifications: Number(notes.rows[0]?.n ?? 0),
      openQuestions: Number(questions.rows[0]?.n ?? 0),
      pendingRewards: Number(rewards.rows[0]?.n ?? 0),
      request: request.rows[0] ?? null,
    };
  }

  async notifications(userId: string) {
    const rows = await this.pool.query<{
      id: string;
      kind: string;
      payload: unknown;
      read_at: Date | null;
      created_at: Date;
    }>(
      `select id, kind, payload, read_at, created_at from notifications
       where user_id = $1 order by created_at desc limit 50`,
      [userId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      payload: row.payload,
      readAt: row.read_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const result = await this.pool.query(
      `update notifications set read_at = now() where id = $1 and user_id = $2 and read_at is null`,
      [notificationId, userId],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'اعلان پیدا نشد');
    return { ok: true };
  }

  private async assertParticipant(userId: string, conversationId: string, db: Pool | PoolClient = this.pool): Promise<void> {
    const row = await db.query(
      `select p.user_id from conversation_participants p
       join conversations c on c.id=p.conversation_id
       join users viewer on viewer.id=p.user_id
       left join plan_requests r on r.id=c.request_id
       where p.conversation_id = $1 and p.user_id = $2
         and (c.kind<>'care' or viewer.role<>'specialist' or r.assigned_specialist_id=$2)`,
      [conversationId, userId],
    );
    if (row.rowCount === 0) throw new ApiError(404, 'not_found', 'گفتگو پیدا نشد');
  }
}
