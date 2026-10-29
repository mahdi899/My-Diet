import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { ApiError } from '../common/errors.js';
import { sealAnswers, sealClinicalRecord, openClinicalRecord } from '../common/field-crypto.js';
import { uuidv7 } from '../common/id.js';
import { audit, toman, withTransaction } from '../common/sql.js';
import { tehranToday } from '../common/time.js';
import { customAnswers, decideAcquisition, questionsOf } from './acquisition.js';
import { compatibilityErrors, type SchemaQuestion } from './compatibility.js';
import { questionnaireView, validateSubmission } from './schema.js';

@Injectable()
export class QuestionnaireService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async schema() {
    const row = await this.pool.query<{ version: number; document: { questions?: unknown } }>(
      `select version, document from questionnaire_schemas where status = 'published'`,
    );
    const published = row.rows[0];
    if (!published) throw new ApiError(500, 'internal', 'نسخهٔ پرسشنامه در دسترس نیست');
    const questions = published.document.questions;
    if (!Array.isArray(questions) || typeof questions[0] === 'string') return questionnaireView();
    return { version: published.version, questions };
  }

  async draft(userId: string) {
    const row = await this.pool.query<{ answers: unknown; updated_at: Date }>(
      `select answers, updated_at from questionnaire_drafts where user_id = $1`,
      [userId],
    );
    if (!row.rows[0]) return { schemaVersion: 1, answers: {}, updatedAt: null };
    return {
      schemaVersion: 1,
      answers: openClinicalRecord(row.rows[0].answers, this.env.FIELD_KEY),
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
      [userId, JSON.stringify(sealClinicalRecord(answers, this.env.FIELD_KEY))],
    );
    return { ok: true };
  }

  async submit(userId: string, input: unknown) {
    const { answers, riskFlags, bmi } = validateSubmission(input);
    const id = uuidv7();
    const pregnancyAsOf = answers.lifeStage === 'pregnant' ? tehranToday() : null;
    const published = await this.pool.query<{ version: number; document: unknown }>(
      `select version, document from questionnaire_schemas where status = 'published'`,
    );
    const schema = published.rows[0];
    if (!schema) throw new ApiError(500, 'internal', 'نسخهٔ پرسشنامه در دسترس نیست');
    const questions = questionsOf(schema.document);
    const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    let extras: Record<string, string | number | unknown[]>;
    try {
      extras = customAnswers(questions, source);
    } catch {
      throw new ApiError(400, 'validation', 'یکی از پاسخ‌ها بیش از حد طولانی است');
    }
    const answeredCustom = new Set(Object.keys(extras));
    const missingCustom = questions.some(
      (question) => question.required && question.id.startsWith('custom_') && !answeredCustom.has(question.id),
    );
    if (missingCustom) throw new ApiError(400, 'validation', 'پرسشنامه کامل نیست');
    await this.pool.query(
      `insert into questionnaire_submissions
         (id, user_id, schema_version, answers, risk_flags, bmi, pregnancy_as_of)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [
        id,
        userId,
        schema.version,
        JSON.stringify({ ...sealAnswers(answers, this.env.FIELD_KEY), ...extras }),
        riskFlags,
        bmi,
        pregnancyAsOf,
      ],
    );
    await this.pool.query(
      `update users set display_name = $2 where id = $1 and (display_name is null or display_name = '')`,
      [userId, answers.name],
    );
    return { id, schemaVersion: schema.version };
  }

  async acquisitionState(userId: string) {
    const published = await this.pool.query<{ version: number; document: unknown }>(
      `select version, document from questionnaire_schemas where status = 'published'`,
    );
    const schema = published.rows[0];
    if (!schema) throw new ApiError(500, 'internal', 'نسخهٔ پرسشنامه در دسترس نیست');
    const latest = await this.pool.query<{
      schema_version: number;
      answers: unknown;
      pregnancy_as_of: string | null;
    }>(
      `select schema_version, answers, pregnancy_as_of::text as pregnancy_as_of
       from questionnaire_submissions
       where user_id = $1
       order by submitted_at desc
       limit 1`,
      [userId],
    );
    const submission = latest.rows[0];
    const opened = submission
      ? (openClinicalRecord(submission.answers, this.env.FIELD_KEY) as Record<string, unknown>)
      : null;
    const open = await this.pool.query<{ id: string; status: string }>(
      `select id, status from plan_requests
       where user_id = $1
         and status in ('queued', 'generating', 'in_review', 'awaiting_user', 'response_received')
       order by created_at desc
       limit 1`,
      [userId],
    );
    const wallet = await this.pool.query<{ cash_toman: string; promo_toman: string }>(
      `select cash_toman, promo_toman from wallets where user_id = $1`,
      [userId],
    );
    if (!wallet.rows[0]) throw new ApiError(404, 'not_found', 'کیف پول پیدا نشد');
    const decision = decideAcquisition({
      hasSubmission: Boolean(submission),
      submittedSchemaVersion: submission?.schema_version ?? null,
      publishedSchemaVersion: schema.version,
      questions: questionsOf(schema.document),
      answers: opened,
      pregnancyAsOf: submission?.pregnancy_as_of ? submission.pregnancy_as_of.slice(0, 10) : null,
      today: tehranToday(),
      openRequest: open.rows[0] ?? null,
    });
    return {
      ...decision,
      wallet: {
        cashToman: toman(wallet.rows[0].cash_toman),
        promoToman: toman(wallet.rows[0].promo_toman),
      },
    };
  }

  async listSchemas() {
    const rows = await this.pool.query<{ version: number; status: string; document: unknown }>(
      `select version, status, document from questionnaire_schemas order by version`,
    );
    return rows.rows.map((row) => ({ version: row.version, status: row.status, document: row.document }));
  }

  check(input: unknown) {
    return { errors: compatibilityErrors(this.questionsFrom(input), questionnaireView().questions) };
  }

  async saveDraftSchema(actorId: string, input: unknown) {
    const questions = this.questionsFrom(input);
    const errors = compatibilityErrors(questions, questionnaireView().questions);
    if (errors.length > 0) throw new ApiError(422, 'incompatible_schema', 'نسخهٔ پرسشنامه با سؤال‌های ثابت سازگار نیست');
    const next = await this.pool.query<{ version: number }>(
      `select coalesce(max(version), 0) + 1 as version from questionnaire_schemas`,
    );
    const version = next.rows[0]!.version;
    await this.pool.query(
      `insert into questionnaire_schemas (version, document, status) values ($1, $2::jsonb, 'draft')`,
      [version, JSON.stringify({ version, questions })],
    );
    await audit(this.pool, actorId, 'questionnaire_draft', 'questionnaire_schema', null, { version });
    return { version, status: 'draft' as const, errors };
  }

  async publishSchema(actorId: string, version: number) {
    return withTransaction(this.pool, async (client) => {
      const row = await client.query<{ document: { questions?: SchemaQuestion[] }; status: string }>(
        `select document, status from questionnaire_schemas where version = $1 for update`,
        [version],
      );
      const schema = row.rows[0];
      if (!schema) throw new ApiError(404, 'not_found', 'نسخهٔ پرسشنامه پیدا نشد');
      if (schema.status !== 'published') {
        const errors = compatibilityErrors(schema.document.questions ?? [], questionnaireView().questions);
        if (errors.length > 0) {
          throw new ApiError(422, 'incompatible_schema', 'نسخهٔ پرسشنامه با سؤال‌های ثابت سازگار نیست');
        }
        await client.query(
          `update questionnaire_schemas set status = 'retired' where status = 'published' and version <> $1`,
          [version],
        );
        await client.query(
          `update questionnaire_schemas set status = 'published', published_at = now() where version = $1`,
          [version],
        );
        await audit(client, actorId, 'questionnaire_publish', 'questionnaire_schema', null, { version });
      }
      return { version, status: 'published' as const };
    });
  }

  private questionsFrom(input: unknown): SchemaQuestion[] {
    const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
    const questions = record?.questions ?? input;
    if (!Array.isArray(questions)) throw new ApiError(400, 'validation', 'ساختار پرسشنامه درست نیست');
    return questions as SchemaQuestion[];
  }
}
