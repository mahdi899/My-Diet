import pg from 'pg';
import { uuidv7 } from '../common/id.js';
import { normalizeIranianMobile } from '../common/phone.js';
import '../database/pg-types.js';

const phone = process.env.PHONE;
const databaseUrl = process.env.DATABASE_URL;
if (!phone || !databaseUrl) {
  console.error('PHONE and DATABASE_URL are required');
  process.exit(1);
}

const e164 = normalizeIranianMobile(phone);
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const existing = await client.query<{ id: string; role: string }>(
    'select id, role from users where phone_e164 = $1',
    [e164],
  );
  const row = existing.rows[0];
  if (row) {
    if (row.role !== 'admin') {
      console.error('That phone already belongs to a non-admin account');
      process.exit(1);
    }
    console.log('Admin already exists');
  } else {
    const id = uuidv7();
    await client.query('begin');
    await client.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, $2, 'admin', 'مدیر')`,
      [id, e164],
    );
    await client.query(`insert into wallets (user_id) values ($1)`, [id]);
    await client.query('commit');
    console.log('Admin created');
  }
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // No transaction was open.
  }
  console.error(error instanceof Error ? error.message : 'admin creation failed');
  process.exit(1);
} finally {
  await client.end();
}
