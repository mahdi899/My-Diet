import pg from 'pg';
import { normalizeIranianMobile } from '../common/phone.js';
import { purgeUser } from '../admin/purge-user.js';
import '../database/pg-types.js';

const phone = process.env.PHONE;
const databaseUrl = process.env.DATABASE_URL;
if (!phone || !databaseUrl) {
  console.error('PHONE and DATABASE_URL are required');
  process.exit(1);
}

const e164 = normalizeIranianMobile(phone);
const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const found = await pool.query<{ id: string; role: string; phone_e164: string }>(
    `select id, role, phone_e164 from users where phone_e164 = $1`,
    [e164],
  );
  const row = found.rows[0];
  if (!row) {
    console.error(`No user for ${e164}`);
    process.exit(1);
  }
  if (row.role === 'admin') {
    console.error('Refusing to purge an admin account from this script');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    await purgeUser(client, row.id, process.env.FIELD_KEY ?? null);
    await client.query('commit');
    console.log(`Purged user ${row.id} (${row.phone_e164})`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'purge failed');
  process.exit(1);
} finally {
  await pool.end();
}
