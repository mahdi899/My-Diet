import type { Pool } from 'pg';
import { decryptText } from '../../common/field-crypto.js';
import { uuidv7 } from '../../common/id.js';
import type { AttemptOutcome, AttemptRecord, PoolMember, PoolSettings } from './types.js';

/** Keys written by the old single-connection screen are JSON strings; new ones are plain text. */
export function openApiKey(stored: string, secret: string): string {
  const plain = decryptText(stored, secret);
  if (plain.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(plain);
      if (typeof parsed === 'string') return parsed;
    } catch {
      // fall through to the raw value
    }
  }
  return plain;
}

interface MemberRow {
  member_id: string;
  model: string;
  position: number;
  weight: number;
  price_in: string;
  price_out: string;
  provider_id: string;
  name: string;
  kind: 'openrouter' | 'openai_compatible';
  base_url: string;
  api_key_encrypted: string | null;
  http_referer: string | null;
  app_title: string | null;
  consecutive_failures: number | null;
  cooldown_until: Date | null;
}

export class PoolStore {
  constructor(
    private readonly pool: Pool,
    private readonly secret: string,
  ) {}

  async settings(code: string): Promise<PoolSettings | null> {
    const { rows } = await this.pool.query<{
      code: string;
      strategy: PoolSettings['strategy'];
      temperature: string;
      max_tokens: number;
      timeout_ms: number;
      max_attempts: number;
    }>(
      `select code, strategy, temperature::text, max_tokens, timeout_ms, max_attempts
       from ai_pools where code = $1 and enabled`,
      [code],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      code: row.code,
      strategy: row.strategy,
      temperature: Number(row.temperature),
      maxTokens: row.max_tokens,
      timeoutMs: row.timeout_ms,
      maxAttempts: row.max_attempts,
    };
  }

  /** Enabled members of enabled providers that have a key, with their health. */
  async members(code: string): Promise<PoolMember[]> {
    const { rows } = await this.pool.query<MemberRow>(
      `select m.id as member_id, m.model, m.position, m.weight,
              m.price_in_micros_per_m::text as price_in, m.price_out_micros_per_m::text as price_out,
              p.id as provider_id, p.name, p.kind, p.base_url, p.api_key_encrypted, p.http_referer, p.app_title,
              h.consecutive_failures, h.cooldown_until
       from ai_pool_members m
       join ai_pools pl on pl.id = m.pool_id
       join ai_providers p on p.id = m.provider_id
       left join ai_pool_health h on h.member_id = m.id
       where pl.code = $1 and pl.enabled and m.enabled and p.active
       order by m.position, m.created_at`,
      [code],
    );
    const members: PoolMember[] = [];
    for (const row of rows) {
      if (!row.api_key_encrypted) continue;
      members.push({
        memberId: row.member_id,
        poolCode: code,
        provider: {
          id: row.provider_id,
          name: row.name,
          kind: row.kind,
          baseUrl: row.base_url,
          apiKey: openApiKey(row.api_key_encrypted, this.secret),
          httpReferer: row.http_referer,
          appTitle: row.app_title,
        },
        model: row.model,
        position: row.position,
        weight: row.weight,
        priceInMicrosPerM: Number(row.price_in),
        priceOutMicrosPerM: Number(row.price_out),
        consecutiveFailures: row.consecutive_failures ?? 0,
        cooldownUntil: row.cooldown_until,
      });
    }
    return members;
  }

  async record(
    task: string,
    poolCode: string,
    requestId: string | null,
    chunk: string | null,
    attemptNo: number,
    attempt: AttemptRecord,
  ): Promise<void> {
    await this.pool.query(
      `insert into ai_usage_ledger
         (id, request_id, task, pool_code, member_id, provider_name, model, attempt_no, chunk, outcome,
          tokens_in, tokens_out, cost_micros, cost_source, latency_ms, error_code)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        uuidv7(), requestId, task, poolCode, attempt.memberId, attempt.provider, attempt.model, attemptNo, chunk,
        attempt.outcome, attempt.tokensIn, attempt.tokensOut, attempt.costMicros, attempt.costSource,
        attempt.latencyMs, attempt.errorCode,
      ],
    );
  }

  async markOk(memberId: string): Promise<void> {
    await this.pool.query(
      `insert into ai_pool_health (member_id, consecutive_failures, last_ok_at, total_ok)
       values ($1, 0, now(), 1)
       on conflict (member_id) do update set consecutive_failures = 0, cooldown_until = null,
         last_ok_at = now(), total_ok = ai_pool_health.total_ok + 1`,
      [memberId],
    );
  }

  /**
   * Circuit breaker. Auth and rate-limit failures cool the member down at once; any other failure
   * does so after three in a row, with the pause doubling up to thirty minutes.
   */
  async markFailed(memberId: string, outcome: AttemptOutcome, errorCode: string | null, retryAfterMs: number | null): Promise<void> {
    const immediate =
      outcome === 'auth_failed' ? 600 : outcome === 'rate_limited' ? Math.max(30, Math.ceil((retryAfterMs ?? 60_000) / 1000)) : 0;
    await this.pool.query(
      `insert into ai_pool_health (member_id, consecutive_failures, cooldown_until, last_error_code, last_fail_at, total_fail)
       values ($1, 1, case when $3::int > 0 then now() + make_interval(secs => $3::int) end, $2, now(), 1)
       on conflict (member_id) do update set
         consecutive_failures = ai_pool_health.consecutive_failures + 1,
         last_error_code = $2,
         last_fail_at = now(),
         total_fail = ai_pool_health.total_fail + 1,
         cooldown_until = case
           when $3::int > 0 then now() + make_interval(secs => $3::int)
           when ai_pool_health.consecutive_failures + 1 >= 3
             then now() + make_interval(secs => least(1800, 30 * power(2, ai_pool_health.consecutive_failures + 1 - 3))::int)
           else ai_pool_health.cooldown_until end`,
      [memberId, errorCode, immediate],
    );
  }
}
