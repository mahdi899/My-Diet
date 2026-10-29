import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PUSH_PROVIDER, type PushProvider } from '../adapters/push.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { PG_POOL } from '../database/database.js';

const PLATFORMS = new Set(['android', 'ios', 'web']);
const PROVIDERS = new Set(['console', 'fcm']);

export interface StreamEvent {
  at: string;
  type: 'notification' | 'message' | 'request';
  data: object;
}

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  async register(userId: string, sessionId: string, platform: string, pushToken: string, provider: string) {
    if (!PLATFORMS.has(platform) || !PROVIDERS.has(provider) || pushToken.length < 8 || pushToken.length > 4096) {
      throw new ApiError(400, 'validation', 'دستگاه درست معرفی نشده است');
    }
    const row = await this.pool.query<{ id: string }>(
      `insert into devices (id, user_id, session_id, platform, push_token, provider)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (push_token) do update
         set user_id = excluded.user_id,
             session_id = excluded.session_id,
             platform = excluded.platform,
             provider = excluded.provider,
             revoked_at = null,
             last_seen_at = now()
       returning id`,
      [uuidv7(), userId, sessionId, platform, pushToken, provider],
    );
    return { id: row.rows[0]!.id };
  }

  async remove(userId: string, deviceId: string) {
    const result = await this.pool.query(
      `update devices set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null`,
      [deviceId, userId],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'دستگاه پیدا نشد');
    return { ok: true };
  }

  async deliver(userId: string, kind: string): Promise<number> {
    const devices = await this.pool.query<{ id: string; push_token: string }>(
      `select id, push_token from devices where user_id = $1 and revoked_at is null`,
      [userId],
    );
    for (const device of devices.rows) {
      await this.push.send({ token: device.push_token, kind });
      await this.pool.query(
        `insert into push_deliveries (id, device_id, kind) values ($1, $2, $3)`,
        [uuidv7(), device.id, kind],
      );
    }
    return devices.rowCount ?? 0;
  }

  async since(userId: string, since: string): Promise<StreamEvent[]> {
    const notifications = await this.pool.query<{ id: string; kind: string; created_at: Date }>(
      `select id, kind, created_at from notifications
       where user_id = $1 and created_at > $2
       order by created_at`,
      [userId, since],
    );
    const messages = await this.pool.query<{ id: string; conversation_id: string; created_at: Date }>(
      `select m.id, m.conversation_id, m.created_at
       from messages m
       join conversation_participants p on p.conversation_id = m.conversation_id
       where p.user_id = $1 and m.author_id <> $1 and m.created_at > $2
       order by m.created_at`,
      [userId, since],
    );
    const requests = await this.pool.query<{ id: string; status: string; updated_at: Date }>(
      `select id, status, updated_at from plan_requests
       where updated_at > $2 and (user_id = $1 or assigned_specialist_id = $1)
       order by updated_at`,
      [userId, since],
    );
    const events: StreamEvent[] = [
      ...notifications.rows.map((row) => ({
        at: row.created_at.toISOString(),
        type: 'notification' as const,
        data: { id: row.id, kind: row.kind },
      })),
      ...messages.rows.map((row) => ({
        at: row.created_at.toISOString(),
        type: 'message' as const,
        data: { messageId: row.id, conversationId: row.conversation_id },
      })),
      ...requests.rows.map((row) => ({
        at: row.updated_at.toISOString(),
        type: 'request' as const,
        data: { requestId: row.id, status: row.status },
      })),
    ];
    events.sort((left, right) => left.at.localeCompare(right.at));
    return events;
  }
}
