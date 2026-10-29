import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { notify } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';

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
       where p.user_id = $1
       order by c.created_at desc`,
      [userId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      requestId: row.request_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const rows = await this.pool.query<{ id: string; author_id: string; body: string; created_at: Date }>(
      `select id, author_id, body, created_at from messages
       where conversation_id = $1 order by created_at`,
      [conversationId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** Chat never answers an information question and never changes a plan status. */
  async post(userId: string, conversationId: string, body: string) {
    await this.assertParticipant(userId, conversationId);
    const id = uuidv7();
    const conversation = await this.pool.query<{ user_id: string }>(
      `select user_id from conversations where id = $1`,
      [conversationId],
    );
    await this.pool.query(
      `insert into messages (id, conversation_id, author_id, body) values ($1, $2, $3, $4)`,
      [id, conversationId, userId, body],
    );
    const owner = conversation.rows[0]?.user_id;
    if (owner && owner !== userId) await notify(this.pool, owner, 'message', { conversationId });
    return { id };
  }

  async markRead(userId: string, conversationId: string) {
    const result = await this.pool.query(
      `update conversation_participants set last_read_at = now()
       where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'گفتگو پیدا نشد');
    return { ok: true };
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

  private async assertParticipant(userId: string, conversationId: string): Promise<void> {
    const row = await this.pool.query(
      `select user_id from conversation_participants where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
    if (row.rowCount === 0) throw new ApiError(404, 'not_found', 'گفتگو پیدا نشد');
  }
}
