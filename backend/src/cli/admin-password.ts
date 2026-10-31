import pg from 'pg';
import { hashPassword } from '../common/password.js';

const { DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, PHONE } = process.env;
if (!DATABASE_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD || !PHONE) throw new Error('DATABASE_URL, PHONE, ADMIN_USERNAME and ADMIN_PASSWORD are required');
if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(ADMIN_USERNAME)) throw new Error('Username must contain 3–80 Latin letters, digits, dots, underscores or hyphens');
const client = new pg.Client({connectionString:DATABASE_URL});
await client.connect();
try {
  const { normalizeIranianMobile } = await import('../common/phone.js');
  const result = await client.query(`insert into admin_credentials(user_id,username,password_hash)
    select id,$1,$2 from users where phone_e164=$3 and role='admin' and status='active'
    on conflict(user_id) do update set username=excluded.username,password_hash=excluded.password_hash,failed_attempts=0,locked_until=null`,
    [ADMIN_USERNAME.toLowerCase(),hashPassword(ADMIN_PASSWORD),normalizeIranianMobile(PHONE)]);
  if (!result.rowCount) throw new Error('Create the admin account with admin:create first');
  console.log('Admin credentials updated');
} finally { await client.end(); }
