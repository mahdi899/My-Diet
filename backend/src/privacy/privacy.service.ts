import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { openAnswers, openClinicalRecord } from '../common/field-crypto.js';
import { audit, withTransaction } from '../common/sql.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import type { StoredAnswers } from '../questionnaire/schema.js';

@Injectable()
export class PrivacyService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async exportAccount(userId: string) {
    const user = await this.pool.query(
      `select id, phone_e164, role, display_name, status, created_at from users where id = $1`,
      [userId],
    );
    const submissions = await this.pool.query<{ answers: StoredAnswers; risk_flags: string[]; submitted_at: Date }>(
      `select answers, risk_flags, submitted_at from questionnaire_submissions where user_id = $1 order by submitted_at`,
      [userId],
    );
    const draft = await this.pool.query(`select answers, updated_at from questionnaire_drafts where user_id = $1`, [userId]);
    const wallet = await this.pool.query(`select cash_toman, promo_toman from wallets where user_id = $1`, [userId]);
    const ledger = await this.pool.query(
      `select bucket, amount_toman, kind, created_at from wallet_ledger where user_id = $1 order by created_at`,
      [userId],
    );
    const messages = await this.pool.query(
      `select m.id, m.conversation_id, m.body, m.created_at
       from messages m
       join conversation_participants p on p.conversation_id = m.conversation_id
       where p.user_id = $1
       order by m.created_at`,
      [userId],
    );
    return {
      profile: user.rows[0] ?? null,
      questionnaire: submissions.rows.map((row) => ({
        submittedAt: row.submitted_at,
        riskFlags: row.risk_flags,
        answers: openAnswers(row.answers, this.env.FIELD_KEY),
      })),
      draft: draft.rows[0]
        ? { ...draft.rows[0], answers: openClinicalRecord(draft.rows[0].answers, this.env.FIELD_KEY) }
        : null,
      wallet: wallet.rows[0] ?? null,
      ledger: ledger.rows,
      messages: messages.rows,
    };
  }

  async deleteAccount(userId: string, actorId = userId) {
    await withTransaction(this.pool, async (client) => {
      const user = await client.query<{ status: string; role: string }>(
        `select status, role from users where id = $1 for update`,
        [userId],
      );
      if (!user.rows[0] || user.rows[0].status === 'deleted') {
        throw new ApiError(409, 'account_deleted', 'این حساب حذف شده است');
      }
      if (user.rows[0].role === 'admin') {
        throw new ApiError(403, 'forbidden', 'حساب مدیریت از اینجا حذف نمی‌شود');
      }
      await client.query(`select set_config('sabzine.anonymize', 'on', true)`);
      await client.query(
        `update questionnaire_submissions
         set answers = '{"redacted":true}'::jsonb, risk_flags = '{}'
         where user_id = $1`,
        [userId],
      );
      await client.query(`delete from questionnaire_drafts where user_id = $1`, [userId]);
      await client.query(
        `update info_answers set body = ''
         where question_id in (
           select q.id from info_questions q
           join plan_requests r on r.id = q.request_id
           where r.user_id = $1
         )`,
        [userId],
      );
      await client.query(
        `update info_questions set prompt = ''
         where request_id in (select id from plan_requests where user_id = $1)`,
        [userId],
      );
      await client.query(
        `update messages set body = ''
         where conversation_id in (
           select conversation_id from conversation_participants where user_id = $1
         )`,
        [userId],
      );
      await client.query(`update program_reviews set body = '' where user_id = $1`, [userId]);
      await client.query(`delete from weight_entries where user_id = $1`, [userId]);
      await client.query(
        `update users
         set status = 'deleted', display_name = null, phone_e164 = $2, deleted_at = now()
         where id = $1`,
        [userId, `deleted:${userId}`],
      );
      await client.query(
        `update sessions set revoked_at = now(), revoke_reason = 'account_deleted'
         where user_id = $1 and revoked_at is null`,
        [userId],
      );
      await client.query(`update devices set revoked_at = now() where user_id = $1 and revoked_at is null`, [userId]);
      await audit(client, actorId, 'account_delete', 'user', userId, { ledgerRetained: true });
    });
    return { deleted: true, ledgerRetained: true };
  }
}
