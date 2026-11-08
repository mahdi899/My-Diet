import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { encryptText } from '../common/field-crypto.js';
import { uuidv7 } from '../common/id.js';
import { requiredUuid } from '../common/parse.js';
import { audit, withTransaction } from '../common/sql.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { BudgetService } from './budget.service.js';
import { OPENROUTER_BASE_URL, chatCompletion } from './pool/client.js';
import { assertPublicEndpoint } from './pool/endpoint.js';
import { openApiKey } from './pool/pool-store.js';
import { PoolRouter, PoolExhaustedError } from './pool/router.js';
import { ProviderCallError, type ProviderConfig } from './pool/types.js';
import { PromptStore } from './draft/prompts.js';

const KINDS = ['openrouter', 'openai_compatible'] as const;
const STRATEGIES = ['priority', 'cost_first', 'weighted'] as const;
const MODEL_CACHE_MS = 10 * 60 * 1000;

/** Models worth trying first for Persian meal planning; shown as hints, never applied automatically. */
export const SUGGESTED_MODELS = [
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'deepseek/deepseek-chat',
  'qwen/qwen-2.5-72b-instruct',
];

export interface CatalogModel {
  id: string;
  name: string;
  contextLength: number | null;
  /** Micro-USD per million tokens. */
  priceInMicrosPerM: number;
  priceOutMicrosPerM: number;
  free: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  kind: (typeof KINDS)[number];
  base_url: string;
  api_key_encrypted: string | null;
  http_referer: string | null;
  app_title: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const text = (value: unknown, label: string, max: number, required = true): string | undefined => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiError(400, 'validation', `«${label}» لازم است`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new ApiError(400, 'validation', `«${label}» معتبر نیست`);
  }
  return value.trim();
};

const micros = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new ApiError(400, 'validation', `«${label}» معتبر نیست`);
  }
  return value;
};

const hint = (secret: string | null, key: string): string | null => {
  if (!secret) return null;
  try {
    const plain = openApiKey(secret, key);
    return plain.length >= 8 ? `…${plain.slice(-4)}` : '…';
  } catch {
    return null;
  }
};

@Injectable()
export class AiAdminService {
  private modelCache = new Map<string, { at: number; models: CatalogModel[] }>();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
    @Inject(BudgetService) private readonly budget: BudgetService,
    @Inject(PoolRouter) private readonly router: PoolRouter,
    @Inject(PromptStore) private readonly prompts: PromptStore,
  ) {}

  // ------------------------------------------------------------ providers

  private providerView(row: ProviderRow) {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      baseUrl: row.base_url,
      httpReferer: row.http_referer,
      appTitle: row.app_title,
      active: row.active,
      hasKey: row.api_key_encrypted != null,
      keyHint: hint(row.api_key_encrypted, this.env.FIELD_KEY),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async providers() {
    const { rows } = await this.pool.query<ProviderRow>(`select * from ai_providers order by created_at`);
    return { items: rows.map((row) => this.providerView(row)) };
  }

  private async checkEndpoint(baseUrl: string): Promise<string> {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new ApiError(400, 'validation', 'نشانی سرویس معتبر نیست');
    }
    const secure = url.protocol === 'https:' || (this.env.AI_ALLOW_PRIVATE_ENDPOINTS && url.protocol === 'http:');
    if (!secure || url.username || url.password) throw new ApiError(400, 'validation', 'نشانی سرویس باید https باشد');
    return url.toString().replace(/\/+$/, '');
  }

  private sealKey(key: unknown): string {
    if (typeof key !== 'string' || key.trim().length < 8 || key.length > 400 || /\s/.test(key.trim())) {
      throw new ApiError(400, 'validation', 'کلید API معتبر نیست');
    }
    return encryptText(key.trim(), this.env.FIELD_KEY);
  }

  async createProvider(adminId: string, body: Record<string, unknown>) {
    const kind = body.kind;
    if (!KINDS.includes(kind as (typeof KINDS)[number])) throw new ApiError(400, 'validation', 'نوع سرویس معتبر نیست');
    const name = text(body.name, 'نام', 60)!;
    const baseUrl = await this.checkEndpoint(
      kind === 'openrouter' ? (text(body.baseUrl, 'نشانی', 300, false) ?? OPENROUTER_BASE_URL) : text(body.baseUrl, 'نشانی', 300)!,
    );
    const id = uuidv7();
    try {
      await withTransaction(this.pool, async (client) => {
        await client.query(
          `insert into ai_providers (id, name, kind, base_url, api_key_encrypted, http_referer, app_title)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [
            id,
            name,
            kind,
            baseUrl,
            body.apiKey == null || body.apiKey === '' ? null : this.sealKey(body.apiKey),
            text(body.httpReferer, 'Referer', 200, false) ?? null,
            text(body.appTitle, 'عنوان برنامه', 80, false) ?? null,
          ],
        );
        await audit(client, adminId, 'ai_provider_created', 'ai_provider', id, { name, kind });
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'conflict', 'سرویسی با این نام وجود دارد');
      throw error;
    }
    return this.provider(id);
  }

  async provider(id: string) {
    const { rows } = await this.pool.query<ProviderRow>(`select * from ai_providers where id = $1`, [id]);
    if (!rows[0]) throw new ApiError(404, 'not_found', 'سرویس پیدا نشد');
    return this.providerView(rows[0]);
  }

  async updateProvider(adminId: string, id: string, body: Record<string, unknown>) {
    const current = await this.pool.query<ProviderRow>(`select * from ai_providers where id = $1`, [id]);
    const row = current.rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'سرویس پیدا نشد');
    const name = body.name === undefined ? row.name : text(body.name, 'نام', 60)!;
    const baseUrl = body.baseUrl === undefined ? row.base_url : await this.checkEndpoint(text(body.baseUrl, 'نشانی', 300)!);
    let key = row.api_key_encrypted;
    if (body.apiKey === null) key = null;
    else if (body.apiKey !== undefined) key = this.sealKey(body.apiKey);
    const referer = body.httpReferer === undefined ? row.http_referer : (text(body.httpReferer, 'Referer', 200, false) ?? null);
    const title = body.appTitle === undefined ? row.app_title : (text(body.appTitle, 'عنوان برنامه', 80, false) ?? null);
    const active = body.active === undefined ? row.active : body.active === true;
    if (body.active !== undefined && typeof body.active !== 'boolean') throw new ApiError(400, 'validation', 'وضعیت معتبر نیست');
    try {
      await withTransaction(this.pool, async (client) => {
        await client.query(
          `update ai_providers set name=$2, base_url=$3, api_key_encrypted=$4, http_referer=$5, app_title=$6, active=$7, updated_at=now()
           where id = $1`,
          [id, name, baseUrl, key, referer, title, active],
        );
        await audit(client, adminId, 'ai_provider_updated', 'ai_provider', id, {
          keyChanged: body.apiKey !== undefined,
          fields: Object.keys(body).filter((field) => field !== 'apiKey'),
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'conflict', 'سرویسی با این نام وجود دارد');
      throw error;
    }
    return this.provider(id);
  }

  async deleteProvider(adminId: string, id: string) {
    const used = await this.pool.query(`select 1 from ai_pool_members where provider_id = $1 limit 1`, [id]);
    if (used.rowCount) throw new ApiError(409, 'conflict', 'این سرویس در یک استخر استفاده می‌شود');
    await withTransaction(this.pool, async (client) => {
      const removed = await client.query(`delete from ai_providers where id = $1`, [id]);
      if (!removed.rowCount) throw new ApiError(404, 'not_found', 'سرویس پیدا نشد');
      await audit(client, adminId, 'ai_provider_deleted', 'ai_provider', id, {});
    });
    return { ok: true };
  }

  private async configOf(id: string): Promise<ProviderConfig> {
    const { rows } = await this.pool.query<ProviderRow>(`select * from ai_providers where id = $1`, [id]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'سرویس پیدا نشد');
    if (!row.api_key_encrypted) throw new ApiError(409, 'key_missing', 'برای این سرویس کلید ثبت نشده است');
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      baseUrl: row.base_url,
      apiKey: openApiKey(row.api_key_encrypted, this.env.FIELD_KEY),
      httpReferer: row.http_referer,
      appTitle: row.app_title,
    };
  }

  /** A one-line call that proves the key, the address and the model work, and what a call costs. */
  async testProvider(adminId: string, id: string, modelInput: unknown) {
    const config = await this.configOf(id);
    const model = typeof modelInput === 'string' && modelInput.trim() ? modelInput.trim().slice(0, 200) : SUGGESTED_MODELS[1]!;
    const result = {
      ok: false,
      model,
      answeredBy: null as string | null,
      latencyMs: 0,
      costMicros: 0,
      tokens: 0,
      outcome: 'ok' as string,
      errorCode: null as string | null,
    };
    try {
      const completion = await chatCompletion(
        config,
        model,
        {
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          temperature: 0,
          maxTokens: 16,
          timeoutMs: 30_000,
          json: false,
        },
        { allowPrivate: this.env.AI_ALLOW_PRIVATE_ENDPOINTS },
      );
      result.ok = true;
      result.answeredBy = completion.model;
      result.latencyMs = completion.latencyMs;
      result.tokens = completion.tokensIn + completion.tokensOut;
      result.costMicros = completion.costMicros ?? 0;
    } catch (error) {
      if (error instanceof ProviderCallError) {
        result.outcome = error.outcome;
        result.errorCode = error.code;
        result.latencyMs = error.latencyMs;
      } else {
        result.outcome = 'rejected';
        result.errorCode = 'unexpected';
      }
    }
    await this.pool.query(
      `insert into ai_usage_ledger (id, request_id, task, pool_code, member_id, provider_name, model, attempt_no, outcome,
         tokens_in, tokens_out, cost_micros, cost_source, latency_ms, error_code)
       values ($1, null, 'provider_test', 'test', null, $2, $3, 1, $4, 0, $5, $6, 'provider', $7, $8)`,
      [uuidv7(), config.name, model, result.ok ? 'ok' : result.outcome, result.tokens, result.costMicros, result.latencyMs, result.errorCode],
    );
    await audit(this.pool, adminId, 'ai_provider_tested', 'ai_provider', id, { model, ok: result.ok, outcome: result.outcome });
    return result;
  }

  // ------------------------------------------------------------ model catalogue

  /** Live model list of a provider, with prices converted to micro-USD per million tokens. */
  async models(providerId: string, query: string, limit: number) {
    const { rows } = await this.pool.query<ProviderRow>(`select * from ai_providers where id = $1`, [providerId]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'سرویس پیدا نشد');
    let cached = this.modelCache.get(row.id);
    let fetchedAt = cached?.at ?? 0;
    if (!cached || Date.now() - cached.at > MODEL_CACHE_MS) {
      const models = await this.fetchModels(row);
      cached = { at: Date.now(), models };
      fetchedAt = cached.at;
      this.modelCache.set(row.id, cached);
    }
    const needle = query.trim().toLowerCase();
    const filtered = needle ? cached.models.filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(needle)) : cached.models;
    return {
      fetchedAt: new Date(fetchedAt).toISOString(),
      total: filtered.length,
      suggested: SUGGESTED_MODELS,
      items: filtered.slice(0, limit),
    };
  }

  private async fetchModels(row: ProviderRow): Promise<CatalogModel[]> {
    let base: URL;
    try {
      base = await assertPublicEndpoint(row.base_url, this.env.AI_ALLOW_PRIVATE_ENDPOINTS);
    } catch {
      throw new ApiError(400, 'endpoint_invalid', 'نشانی سرویس مجاز نیست');
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (row.api_key_encrypted) headers.Authorization = `Bearer ${openApiKey(row.api_key_encrypted, this.env.FIELD_KEY)}`;
    let response: Response;
    try {
      response = await fetch(`${base.toString().replace(/\/+$/, '')}/models`, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ApiError(502, 'provider_unreachable', 'اتصال به سرویس برقرار نشد');
    }
    if (!response.ok) throw new ApiError(502, 'provider_error', `سرویس پاسخ ${response.status} داد`);
    const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
    const list = Array.isArray(body?.data) ? (body!.data as Array<Record<string, unknown>>) : [];
    const perM = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e12) : 0;
    };
    return list
      .filter((item) => typeof item.id === 'string')
      .map((item) => {
        const pricing = (item.pricing ?? {}) as Record<string, unknown>;
        const priceIn = perM(pricing.prompt);
        const priceOut = perM(pricing.completion);
        return {
          id: String(item.id).slice(0, 200),
          name: typeof item.name === 'string' ? item.name.slice(0, 200) : String(item.id),
          contextLength: typeof item.context_length === 'number' ? item.context_length : null,
          priceInMicrosPerM: priceIn,
          priceOutMicrosPerM: priceOut,
          free: priceIn === 0 && priceOut === 0,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  // ------------------------------------------------------------ pools

  async pools() {
    const pools = await this.pool.query(
      `select id, code, title, strategy, temperature::float as temperature, max_tokens as "maxTokens",
              timeout_ms as "timeoutMs", max_attempts as "maxAttempts", enabled
       from ai_pools order by code`,
    );
    const members = await this.pool.query(
      `select m.id, m.pool_id as "poolId", m.provider_id as "providerId", p.name as "providerName", m.model, m.position, m.weight,
              m.enabled, m.price_in_micros_per_m::float as "priceInMicrosPerM", m.price_out_micros_per_m::float as "priceOutMicrosPerM",
              h.consecutive_failures as "consecutiveFailures", h.cooldown_until as "cooldownUntil", h.last_error_code as "lastErrorCode",
              h.last_ok_at as "lastOkAt", h.last_fail_at as "lastFailAt", coalesce(h.total_ok, 0)::int as "totalOk", coalesce(h.total_fail, 0)::int as "totalFail"
       from ai_pool_members m join ai_providers p on p.id = m.provider_id
       left join ai_pool_health h on h.member_id = m.id
       order by m.position`,
    );
    return {
      items: pools.rows.map((pool) => ({
        ...pool,
        members: members.rows.filter((member) => member.poolId === pool.id).map(({ poolId: _poolId, ...rest }) => rest),
      })),
    };
  }

  async updatePool(adminId: string, code: string, body: Record<string, unknown>) {
    const { rows } = await this.pool.query(`select * from ai_pools where code = $1`, [code]);
    const current = rows[0];
    if (!current) throw new ApiError(404, 'not_found', 'استخر پیدا نشد');
    const bounded = (value: unknown, label: string, min: number, max: number, fallback: number) => {
      if (value === undefined) return fallback;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        throw new ApiError(400, 'validation', `«${label}» معتبر نیست`);
      }
      return value;
    };
    const strategy = body.strategy === undefined ? current.strategy : body.strategy;
    if (!STRATEGIES.includes(strategy)) throw new ApiError(400, 'validation', 'راهبرد معتبر نیست');
    let temperature = Number(current.temperature);
    if (body.temperature !== undefined) {
      if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
        throw new ApiError(400, 'validation', 'دمای مدل معتبر نیست');
      }
      temperature = body.temperature;
    }
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new ApiError(400, 'validation', 'وضعیت معتبر نیست');
    const title = body.title === undefined ? current.title : text(body.title, 'عنوان', 100)!;
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `update ai_pools set title=$2, strategy=$3, temperature=$4, max_tokens=$5, timeout_ms=$6, max_attempts=$7, enabled=$8, updated_at=now()
         where code = $1`,
        [
          code,
          title,
          strategy,
          temperature,
          bounded(body.maxTokens, 'سقف توکن', 200, 32_000, current.max_tokens),
          bounded(body.timeoutMs, 'مهلت', 5_000, 300_000, current.timeout_ms),
          bounded(body.maxAttempts, 'حداکثر تلاش', 1, 10, current.max_attempts),
          body.enabled === undefined ? current.enabled : body.enabled,
        ],
      );
      await audit(client, adminId, 'ai_pool_updated', 'ai_pool', current.id, { code, fields: Object.keys(body) });
    });
    return this.pools();
  }

  /** Replaces the member list. Members that stay keep their id, so their health history survives. */
  async setMembers(adminId: string, code: string, body: unknown) {
    const list = Array.isArray(body) ? body : (body as { members?: unknown } | null)?.members;
    if (!Array.isArray(list) || list.length > 12) throw new ApiError(400, 'validation', 'فهرست مدل‌ها معتبر نیست');
    const pool = await this.pool.query<{ id: string }>(`select id from ai_pools where code = $1`, [code]);
    if (!pool.rows[0]) throw new ApiError(404, 'not_found', 'استخر پیدا نشد');
    const seen = new Set<string>();
    const members = list.map((entry: Record<string, unknown>, index: number) => {
      const providerId = requiredUuid(entry.providerId);
      const model = text(entry.model, 'مدل', 200)!;
      if (seen.has(`${providerId}|${model}`)) throw new ApiError(400, 'validation', 'مدل تکراری است');
      seen.add(`${providerId}|${model}`);
      const weight = entry.weight === undefined ? 1 : entry.weight;
      if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 100) throw new ApiError(400, 'validation', 'وزن معتبر نیست');
      return {
        providerId,
        model,
        position: index,
        weight,
        enabled: entry.enabled !== false,
        priceIn: micros(entry.priceInMicrosPerM, 'قیمت ورودی') ?? 0,
        priceOut: micros(entry.priceOutMicrosPerM, 'قیمت خروجی') ?? 0,
      };
    });
    await withTransaction(this.pool, async (client) => {
      const known = await client.query<{ id: string }>(`select id from ai_providers where id = any($1::uuid[])`, [
        [...new Set(members.map((member) => member.providerId))],
      ]);
      if (known.rowCount !== new Set(members.map((member) => member.providerId)).size) {
        throw new ApiError(400, 'validation', 'سرویس انتخاب‌شده وجود ندارد');
      }
      await client.query(
        `delete from ai_pool_members where pool_id = $1 and (provider_id::text || '|' || model) <> all($2::text[])`,
        [pool.rows[0]!.id, members.map((member) => `${member.providerId}|${member.model}`)],
      );
      for (const member of members) {
        await client.query(
          `insert into ai_pool_members (id, pool_id, provider_id, model, position, weight, enabled, price_in_micros_per_m, price_out_micros_per_m)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (pool_id, provider_id, model) do update set
             position = excluded.position, weight = excluded.weight, enabled = excluded.enabled,
             price_in_micros_per_m = excluded.price_in_micros_per_m, price_out_micros_per_m = excluded.price_out_micros_per_m`,
          [uuidv7(), pool.rows[0]!.id, member.providerId, member.model, member.position, member.weight, member.enabled, member.priceIn, member.priceOut],
        );
      }
      await audit(client, adminId, 'ai_pool_members_set', 'ai_pool', pool.rows[0]!.id, {
        code,
        members: members.map((member) => `${member.model}${member.enabled ? '' : ' (off)'}`),
      });
    });
    return this.pools();
  }

  async resetHealth(adminId: string, memberId: string) {
    await withTransaction(this.pool, async (client) => {
      const found = await client.query(`select 1 from ai_pool_members where id = $1`, [memberId]);
      if (!found.rowCount) throw new ApiError(404, 'not_found', 'مدل پیدا نشد');
      await client.query(
        `update ai_pool_health set consecutive_failures = 0, cooldown_until = null, last_error_code = null where member_id = $1`,
        [memberId],
      );
      await audit(client, adminId, 'ai_member_health_reset', 'ai_pool_member', memberId, {});
    });
    return { ok: true };
  }

  /** Sends one tiny prompt through the pool so failover and keys can be checked end to end. */
  async testPool(adminId: string, code: string) {
    try {
      const result = await this.router.run({
        task: 'pool_test',
        poolCode: code,
        requestId: null,
        maxTokens: 16,
        temperature: 0,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        validate: (content) => content.slice(0, 40),
      });
      await audit(this.pool, adminId, 'ai_pool_tested', 'ai_pool', null, { code, ok: true });
      return { ok: true, answer: result.value, usage: result.usage, chain: result.chain };
    } catch (error) {
      await audit(this.pool, adminId, 'ai_pool_tested', 'ai_pool', null, { code, ok: false });
      if (error instanceof PoolExhaustedError) return { ok: false, answer: null, usage: error.usage, chain: error.chain };
      const code2 = (error as { code?: string }).code ?? 'error';
      return { ok: false, answer: null, usage: null, chain: [], errorCode: code2 };
    }
  }

  // ------------------------------------------------------------ cost, prompts, quality

  usage() {
    return this.budget.status();
  }

  budgetControls() {
    return this.budget.controls();
  }

  setBudget(adminId: string, body: Record<string, unknown>) {
    return this.budget.updateControls(adminId, body);
  }

  async ledger(requestId: string | null, limit: number) {
    const { rows } = await this.pool.query(
      `select id, request_id as "requestId", task, pool_code as "poolCode", provider_name as "provider", model, attempt_no as "attemptNo",
              chunk, outcome, tokens_in as "tokensIn", tokens_out as "tokensOut", cost_micros::float as "costMicros",
              cost_source as "costSource", latency_ms as "latencyMs", error_code as "errorCode", created_at as "createdAt"
       from ai_usage_ledger ${requestId ? 'where request_id = $2' : ''} order by created_at desc limit $1`,
      requestId ? [limit, requestId] : [limit],
    );
    return { items: rows };
  }

  /** Recent drafts with their quality signals, for the plan quality monitor. */
  async generations(limit: number) {
    const { rows } = await this.pool.query(
      `select g.id, g.request_id as "requestId", g.provider, g.model, g.status, g.skipped_reason as "reason",
              g.cost_micros::float as "costMicros", g.tokens, g.latency_ms as "latencyMs", g.pool_code as "poolCode",
              g.prompt_version as "promptVersion", g.created_at as "createdAt",
              jsonb_array_length(coalesce(g.warnings, '[]'::jsonb)) as "warningCount",
              jsonb_array_length(coalesce(g.ai_notes -> 'warnings', '[]'::jsonb)) as "validatorWarnings",
              g.ai_notes -> 'critic' ->> 'verdict' as "critic",
              jsonb_array_length(coalesce(g.attempt_chain, '[]'::jsonb)) as "attempts",
              (select count(*) from jsonb_array_elements(coalesce(g.attempt_chain, '[]'::jsonb)) a where a ->> 'outcome' <> 'ok')::int as "failedAttempts"
       from ai_generations g order by g.created_at desc limit $1`,
      [limit],
    );
    const totals = await this.pool.query(
      `select count(*)::int as total, count(*) filter (where status = 'drafted')::int as drafted,
              count(*) filter (where status = 'failed')::int as failed, count(*) filter (where status = 'skipped')::int as skipped,
              coalesce(avg(cost_micros) filter (where status = 'drafted'), 0)::float as "avgCostMicros",
              coalesce(avg(latency_ms) filter (where status = 'drafted'), 0)::float as "avgLatencyMs"
       from ai_generations where created_at >= now() - interval '30 days'`,
    );
    return { totals: totals.rows[0], items: rows };
  }

  promptList(key?: string) {
    return this.prompts.list(key).then((items) => ({ items }));
  }

  createPrompt(adminId: string, key: string, body: Record<string, unknown>) {
    return this.prompts.createVersion(adminId, key, body);
  }

  async activatePrompt(adminId: string, key: string, version: number) {
    await this.prompts.activate(adminId, key, version);
    return { ok: true };
  }

}
