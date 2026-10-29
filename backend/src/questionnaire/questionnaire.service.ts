import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { tehranToday } from '../common/time.js';
import { questionnaireView, validateSubmission } from './schema.js';

@Injectable()
export class QuestionnaireService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async schema() {
    const row = await this.pool.query(`select version from questionnaire_schemas where version = 1`);
    if (row.rowCount === 0) {
      throw new ApiError(500, 'internal', 'نسخهٔ پرسشنامه در دسترس نیست');
    }
    return questionnaireView();
  }

  async draft(userId: string) {
    const row = await this.pool.query<{ answers: unknown; updated_at: Date }>(
      `select answers, updated_at from questionnaire_drafts where user_id = $1`,
      [userId],
    );
    if (!row.rows[0]) return { schemaVersion: 1, answers: {}, updatedAt: null };
    return {
      schemaVersion: 1,
      answers: row.rows[0].answers,
      updatedAt: row.rows[0].updated_at.toISOString(),
    };
  }

  async saveDraft(userId: string, answers: unknown): Promise<{ ok: true }> {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new ApiError(400, 'validation', 'پرسشنامه کامل نیست');
    }
    if (JSON.stringify(answers).length > 50_000) {
      throw new ApiError(400, 'validation', 'پرسشنامه بیش از حد طولانی است');
    }
    await this.pool.query(
      `insert into questionnaire_drafts (user_id, schema_version, answers)
       values ($1, 1, $2::jsonb)
       on conflict (user_id) do update set answers = excluded.answers, updated_at = now()`,
      [userId, JSON.stringify(answers)],
    );
    return { ok: true };
  }

  async submit(userId: string, input: unknown) {
    const { answers, riskFlags, bmi } = validateSubmission(input);
    const id = uuidv7();
    const pregnancyAsOf = answers.lifeStage === 'pregnant' ? tehranToday() : null;
    await this.pool.query(
      `insert into questionnaire_submissions
         (id, user_id, schema_version, answers, risk_flags, bmi, pregnancy_as_of)
       values ($1, $2, 1, $3::jsonb, $4, $5, $6)`,
      [id, userId, JSON.stringify(answers), riskFlags, bmi, pregnancyAsOf],
    );
    await this.pool.query(
      `update users set display_name = $2 where id = $1 and (display_name is null or display_name = '')`,
      [userId, answers.name],
    );
    return { id, schemaVersion: 1 };
  }
}
