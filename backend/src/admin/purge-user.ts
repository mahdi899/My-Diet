import { createHmac } from 'node:crypto';
import { ApiError } from '../common/errors.js';
import type { Queryable } from '../common/sql.js';

type ForeignKey = {
  child: string;
  parent: string;
  childCols: string[];
  parentCols: string[];
  nullable: boolean;
};

function ident(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('unsafe identifier');
  return `"${name}"`;
}

function pgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [];
}

/** Columns that mention a user on someone else's row. Those are cleared, not used to delete the other row. */
const attributionColumns = new Set([
  'actor_id',
  'created_by',
  'approved_by',
  'assigned_specialist_id',
  'author_id',
  'specialist_id',
  'linked_user_id',
]);

/** Strip dependent rows that the generic FK walk often misses or walks too slowly. */
async function purgeUserPreclean(client: Queryable, userId: string, phoneE164: string | null, fieldKey: string | null) {
  await client.query(
    `delete from refresh_tokens where session_id in (select id from sessions where user_id = $1)`,
    [userId],
  );
  await client.query(`delete from sessions where user_id = $1`, [userId]);
  await client.query(`delete from wallet_ledger where user_id = $1`, [userId]);
  await client.query(`delete from wallets where user_id = $1`, [userId]);
  await client.query(`delete from user_service_access where user_id = $1`, [userId]);
  if (phoneE164 && fieldKey) {
    const hash = createHmac('sha256', fieldKey).update(phoneE164).digest('hex');
    await client.query(`delete from demo_lead_submissions where phone_hash = $1 or claimed_user_id = $2`, [
      hash,
      userId,
    ]);
  } else {
    await client.query(`delete from demo_lead_submissions where claimed_user_id = $1`, [userId]);
  }
  await client.query(`delete from conversation_participants where user_id = $1`, [userId]);
  await client.query(
    `delete from messages where conversation_id in (select id from conversations where user_id = $1)`,
    [userId],
  );
  await client.query(`delete from conversations where user_id = $1`, [userId]);
  await client.query(`delete from onboarding_drafts where user_id = $1`, [userId]);
  await client.query(`delete from audit_logs where actor_id = $1`, [userId]);
  await client.query(
    `delete from onboarding_answer_facts
     where submission_id in (select id from questionnaire_submissions where user_id = $1)`,
    [userId],
  );
  await client.query(`delete from nutrition_profile_history where user_id = $1`, [userId]);
  await client.query(`delete from nutrition_profiles where user_id = $1`, [userId]);
  await client.query(`delete from questionnaire_submissions where user_id = $1`, [userId]);
  await client.query(`delete from devices where user_id = $1`, [userId]);
  await client.query(`delete from notifications where user_id = $1`, [userId]);
  await client.query(
    `delete from health_access_logs where request_id in (select id from plan_requests where user_id = $1)`,
    [userId],
  );

  await client.query(`delete from coach_food_entries where user_id = $1`, [userId]);
  await client.query(
    `update coach_messages set reply_to = null
     where thread_id in (select id from coach_threads where user_id = $1)`,
    [userId],
  );
  await client.query(
    `delete from coach_messages
     where user_id = $1
        or thread_id in (select id from coach_threads where user_id = $1)`,
    [userId],
  );
  await client.query(`delete from coach_threads where user_id = $1`, [userId]);
  await client.query(`delete from coach_media where user_id = $1`, [userId]);
  await client.query(`delete from coach_memory where user_id = $1`, [userId]);
  await client.query(`delete from coach_water where user_id = $1`, [userId]);
  await client.query(`delete from coach_engagement where user_id = $1`, [userId]);
  await client.query(`delete from coach_usage where user_id = $1`, [userId]);

  if (phoneE164) {
    await client.query(`delete from otp_challenges where phone_e164 = $1`, [phoneE164]);
  }
}

export async function purgeUser(client: Queryable, userId: string, fieldKey: string | null = null) {
  const profile = await client.query<{ phone_e164: string }>(
    `select phone_e164 from users where id = $1 for update`,
    [userId],
  );
  if (!profile.rows[0]) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');

  const keys = await client.query<{
    child: string;
    parent: string;
    child_cols: string[];
    parent_cols: string[];
    nullable: boolean;
  }>(
    `select child.relname as child, parent.relname as parent,
            array_agg(att.attname order by ck.ord) as child_cols,
            array_agg(patt.attname order by ck.ord) as parent_cols,
            bool_and(not att.attnotnull) as nullable
     from pg_constraint c
     join pg_class child on child.oid = c.conrelid
     join pg_class parent on parent.oid = c.confrelid
     join pg_namespace n on n.oid = child.relnamespace
     join lateral unnest(c.conkey) with ordinality as ck(attnum, ord) on true
     join pg_attribute att on att.attrelid = child.oid and att.attnum = ck.attnum
     join lateral unnest(c.confkey) with ordinality as pk(attnum, ord) on pk.ord = ck.ord
     join pg_attribute patt on patt.attrelid = parent.oid and patt.attnum = pk.attnum
     where c.contype = 'f' and n.nspname = 'public' and parent.relnamespace = n.oid
     group by c.oid, child.relname, parent.relname`,
  );
  const foreignKeys: ForeignKey[] = keys.rows.map((row) => ({
    child: row.child,
    parent: row.parent,
    childCols: pgTextArray(row.child_cols),
    parentCols: pgTextArray(row.parent_cols),
    nullable: row.nullable === true || String(row.nullable) === 't',
  }));
  const triggers = await client.query<{ name: string }>(
    `select distinct c.relname as name
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and c.relkind = 'r'`,
  );
  for (const table of triggers.rows) {
    await client.query(`alter table public.${ident(table.name)} disable trigger user`);
  }
  const stack: string[] = [];
  const clearReference = (key: ForeignKey) =>
    key.child === 'journey_installs' && key.childCols.includes('linked_user_id')
      ? 'linked_user_id = null, linked_at = null'
      : key.childCols.map((column) => `${ident(column)} = null`).join(', ');
  const remove = async (table: string, whereSql: string) => {
    if (stack.length > 64) {
      throw new Error(`purge dependency depth exceeded at ${table}`);
    }
    if (stack.includes(table)) return;
    stack.push(table);
    try {
      for (const key of foreignKeys.filter((item) => item.parent === table)) {
        if (!key.childCols.length || !key.parentCols.length) continue;
        const match = `(${key.childCols.map(ident).join(', ')}) in (select ${key.parentCols.map(ident).join(', ')} from ${ident(table)} where ${whereSql})`;
        const attribution = key.childCols.every((column) => attributionColumns.has(column));
        if ((key.child === table || stack.includes(key.child)) && key.nullable) {
          await client.query(`update ${ident(key.child)} set ${clearReference(key)} where ${match}`, [userId]);
          continue;
        }
        if (table === 'users' && attribution && key.nullable) {
          await client.query(`update ${ident(key.child)} set ${clearReference(key)} where ${match}`, [userId]);
          continue;
        }
        await remove(key.child, match);
      }
      await client.query(`delete from ${ident(table)} where ${whereSql}`, [userId]);
    } finally {
      stack.pop();
    }
  };
  try {
    const key = fieldKey || process.env.FIELD_KEY || null;
    await purgeUserPreclean(client, userId, profile.rows[0].phone_e164, key);
    await remove('users', 'id = $1');
    for (const table of triggers.rows) {
      await client.query(`alter table public.${ident(table.name)} enable trigger user`);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    console.error('user purge failed', error);
    console.error('purge detail', detail);
    throw new ApiError(409, 'delete_blocked', 'حذف این کاربر به‌خاطر وابستگی داده‌ها انجام نشد');
  }
}
