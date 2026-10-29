import type { Pool, PoolClient } from 'pg';

/** Report queries run here so a replica, or the primary used as one, cannot change rows. */
export async function withReadOnly<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin read only');
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
