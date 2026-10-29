import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { uuidv7 } from './id.js';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // The connection may already be unusable.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function toman(value: string | number | bigint): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new Error('toman amount is outside the safe integer range');
  }
  return amount;
}

export async function insertOutbox(
  client: Queryable,
  topic: string,
  aggregateId: string,
  payload: object,
): Promise<void> {
  await client.query(
    `insert into outbox_events (id, topic, aggregate_id, payload)
     values ($1, $2, $3, $4::jsonb)`,
    [uuidv7(), topic, aggregateId, JSON.stringify(payload)],
  );
}

export async function audit(
  client: Queryable,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: object = {},
): Promise<void> {
  await client.query(
    `insert into audit_logs (id, actor_id, action, target_type, target_id, detail)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [uuidv7(), actorId, action, targetType, targetId, JSON.stringify(detail)],
  );
}

export async function notify(
  client: Queryable,
  userId: string,
  kind: string,
  payload: object,
): Promise<void> {
  const id = uuidv7();
  await client.query(
    `insert into notifications (id, user_id, kind, payload) values ($1, $2, $3, $4::jsonb)`,
    [id, userId, kind, JSON.stringify(payload)],
  );
  await client.query(
    `insert into outbox_events (id, topic, aggregate_id, payload)
     select $1, 'push.send', $2, $3::jsonb
     where exists (
       select 1 from devices where user_id = $4 and revoked_at is null
     )`,
    [uuidv7(), id, JSON.stringify({ notificationId: id, userId, kind }), userId],
  );
}
