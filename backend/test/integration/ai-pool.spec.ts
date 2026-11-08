import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { encryptText } from '../../src/common/field-crypto.js';
import { uuidv7 } from '../../src/common/id.js';
import { PoolStore } from '../../src/ai/pool/pool-store.js';
import {
  BudgetBlockedError,
  PoolExhaustedError,
  PoolRouter,
  type BudgetGate,
} from '../../src/ai/pool/router.js';
import { ValidationFailure } from '../../src/ai/pool/types.js';
import { bootApp, type Booted } from '../helpers/boot.js';

type Behaviour = 'ok' | 'rate_limit' | 'auth' | 'server_error' | 'drop' | 'garbage' | 'bad_plan';

describe('AI pool router', { concurrency: 1, timeout: 240_000 }, () => {
  let app: Booted;
  let server: http.Server;
  let baseUrl = '';
  const behaviour = new Map<string, Behaviour>();
  const seen: Array<{ model: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> = [];
  const FIELD_KEY = 'dev-only-field-key-not-for-production';

  before(async () => {
    app = await bootApp();
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        const model = String(body.model);
        seen.push({ model, headers: req.headers, body });
        const mode = behaviour.get(model) ?? 'ok';
        if (mode === 'drop') return void req.socket.destroy();
        if (mode === 'rate_limit') {
          res.writeHead(429, { 'retry-after': '45' });
          return void res.end('{}');
        }
        if (mode === 'auth') {
          res.writeHead(401);
          return void res.end('{}');
        }
        if (mode === 'server_error') {
          res.writeHead(500);
          return void res.end('{}');
        }
        const content = mode === 'garbage' ? 'not json at all' : mode === 'bad_plan' ? '{"days":[]}' : '{"days":[1,2,3]}';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          model: `${model}-routed`,
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 1000, completion_tokens: 500, cost: 0.0042 },
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });
  after(async () => {
    server?.close();
    await app?.stop();
  });

  const allow: BudgetGate = { check: async () => undefined };
  const store = () => new PoolStore(app.pool, FIELD_KEY);
  const router = (budget: BudgetGate = allow, rng?: () => number) =>
    new PoolRouter(store(), budget, { allowPrivate: true, rng });

  async function setup(
    code: string,
    members: Array<{ model: string; kind?: 'openrouter' | 'openai_compatible'; priceIn?: number; priceOut?: number; weight?: number }>,
    strategy: 'priority' | 'cost_first' | 'weighted' = 'priority',
  ): Promise<string[]> {
    const poolId = uuidv7();
    await app.pool.query(
      `insert into ai_pools (id, code, title, strategy, max_attempts) values ($1,$2,$2,$3,5)`,
      [poolId, code, strategy],
    );
    const providerId = uuidv7();
    await app.pool.query(
      `insert into ai_providers (id, name, kind, base_url, api_key_encrypted, http_referer, app_title)
       values ($1,$2,'openrouter',$3,$4,'https://sabzine.example','سبزینه')`,
      [providerId, `fake-${code}`, baseUrl, encryptText('sk-test-not-real', FIELD_KEY)],
    );
    const ids: string[] = [];
    for (const [index, member] of members.entries()) {
      const id = uuidv7();
      ids.push(id);
      await app.pool.query(
        `insert into ai_pool_members (id, pool_id, provider_id, model, position, weight, price_in_micros_per_m, price_out_micros_per_m)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, poolId, providerId, member.model, index, member.weight ?? 1, member.priceIn ?? 0, member.priceOut ?? 0],
      );
    }
    return ids;
  }

  const accept = (content: string) => {
    const parsed = JSON.parse(content) as { days?: unknown[] };
    if (!Array.isArray(parsed.days) || parsed.days.length !== 3) throw new ValidationFailure('invalid_plan', 'wrong_days');
    return parsed.days.length;
  };
  const run = (code: string, r = router()) =>
    r.run({ task: 'test', poolCode: code, requestId: null, messages: [{ role: 'user', content: 'سلام' }], validate: accept });

  it('fails over to the next model and keeps a ledger and health per member', async () => {
    const [a, b] = await setup('t_failover', [{ model: 'a/broken' }, { model: 'b/good' }]);
    behaviour.set('a/broken', 'server_error');
    const result = await run('t_failover');
    assert.equal(result.value, 3);
    assert.deepEqual(result.chain.map((entry) => entry.outcome), ['rejected', 'ok']);
    assert.equal(result.usage.model, 'b/good-routed');
    const ledger = await app.pool.query(`select outcome, cost_source from ai_usage_ledger where pool_code = 't_failover' order by attempt_no`);
    assert.deepEqual(ledger.rows.map((row) => row.outcome), ['rejected', 'ok']);
    assert.equal(ledger.rows[1].cost_source, 'provider');
    assert.equal(result.usage.costMicros, 4200, 'provider reported cost wins over price tables');
    const health = await app.pool.query(`select member_id, consecutive_failures, total_ok, total_fail from ai_pool_health`);
    const byId = new Map(health.rows.map((row) => [row.member_id, row]));
    assert.equal(byId.get(a!)!.consecutive_failures, 1);
    assert.equal(byId.get(b!)!.total_ok, '1');
  });

  it('sends OpenRouter headers, privacy and usage flags', async () => {
    await setup('t_headers', [{ model: 'c/headers' }]);
    seen.length = 0;
    await run('t_headers');
    const call = seen[0]!;
    assert.equal(call.headers.authorization, 'Bearer sk-test-not-real');
    assert.equal(call.headers['http-referer'], 'https://sabzine.example');
    assert.equal(decodeURIComponent(String(call.headers['x-title'])), 'سبزینه');
    assert.deepEqual(call.body.provider, { data_collection: 'deny' });
    assert.deepEqual(call.body.usage, { include: true });
    assert.deepEqual(call.body.response_format, { type: 'json_object' });
  });

  it('opens the circuit on rate limits and auth failures and skips cooled-down members', async () => {
    const [limited, denied] = await setup('t_circuit', [{ model: 'd/limited' }, { model: 'e/denied' }, { model: 'f/good' }]);
    behaviour.set('d/limited', 'rate_limit');
    behaviour.set('e/denied', 'auth');
    const first = await run('t_circuit');
    assert.deepEqual(first.chain.map((entry) => entry.outcome), ['rate_limited', 'auth_failed', 'ok']);
    const cooldowns = await app.pool.query(
      `select member_id, extract(epoch from (cooldown_until - now()))::int as secs from ai_pool_health where cooldown_until is not null`,
    );
    const secs = new Map(cooldowns.rows.map((row) => [row.member_id, row.secs as number]));
    assert.ok(secs.get(limited!)! >= 30 && secs.get(limited!)! <= 46, 'honours Retry-After');
    assert.ok(secs.get(denied!)! > 500, 'bad keys rest for ten minutes');
    seen.length = 0;
    const second = await run('t_circuit');
    assert.deepEqual(second.chain.map((entry) => entry.model), ['f/good-routed']);
    assert.deepEqual(seen.map((call) => call.model), ['f/good']);
  });

  it('charges an uncertain call at its upper bound and never retries that member', async () => {
    await setup('t_unknown', [
      { model: 'g/drop', priceIn: 1_000_000, priceOut: 2_000_000 },
      { model: 'h/good' },
    ]);
    behaviour.set('g/drop', 'drop');
    seen.length = 0;
    const result = await run('t_unknown');
    assert.deepEqual(result.chain.map((entry) => entry.outcome), ['outcome_unknown', 'ok']);
    assert.equal(seen.filter((call) => call.model === 'g/drop').length, 1);
    const unknown = result.chain[0]!;
    assert.equal(unknown.costSource, 'estimate');
    assert.ok(unknown.costMicros >= 12_000 && unknown.costMicros < 13_000, 'max_tokens at output price is the ceiling');
    assert.equal(result.usage.costMicros, unknown.costMicros + 4200);
  });

  it('treats unusable answers as failures that cost money and move on', async () => {
    await setup('t_invalid', [{ model: 'i/garbage' }, { model: 'j/bad' }, { model: 'k/good' }]);
    behaviour.set('i/garbage', 'garbage');
    behaviour.set('j/bad', 'bad_plan');
    const result = await run('t_invalid');
    assert.deepEqual(result.chain.map((entry) => entry.outcome), ['invalid_plan', 'invalid_plan', 'ok']);
    assert.equal(result.usage.costMicros, 3 * 4200);
    assert.equal(result.usage.tokens, 3 * 1500);
  });

  it('reports exhaustion with the usage already spent', async () => {
    await setup('t_dead', [{ model: 'l/down' }, { model: 'm/down' }]);
    behaviour.set('l/down', 'server_error');
    behaviour.set('m/down', 'server_error');
    await assert.rejects(run('t_dead'), (error: unknown) => {
      assert.ok(error instanceof PoolExhaustedError);
      assert.equal(error.chain.length, 2);
      assert.equal(error.code, 'pool_exhausted');
      return true;
    });
  });

  it('orders members by strategy', async () => {
    const settings = { code: 'x', temperature: 0.3, maxTokens: 1000, timeoutMs: 5000, maxAttempts: 5 };
    const member = (id: string, position: number, price: number, weight: number) => ({
      memberId: id, poolCode: 'x', position, weight, priceInMicrosPerM: price, priceOutMicrosPerM: price,
      consecutiveFailures: 0, cooldownUntil: null, model: id,
      provider: { id: 'p', name: 'p', kind: 'openrouter' as const, baseUrl: baseUrl, apiKey: 'k', httpReferer: null, appTitle: null },
    });
    const members = [member('premium', 0, 900, 1), member('cheap', 1, 100, 1), member('mid', 2, 400, 8)];
    const priority = router().order({ ...settings, strategy: 'priority' }, members).map((entry) => entry.memberId);
    assert.deepEqual(priority, ['premium', 'cheap', 'mid']);
    const cost = router().order({ ...settings, strategy: 'cost_first' }, members).map((entry) => entry.memberId);
    assert.deepEqual(cost, ['cheap', 'mid', 'premium']);
    const heavy = router(allow, () => 0.99).order({ ...settings, strategy: 'weighted' }, members).map((entry) => entry.memberId);
    assert.equal(heavy[0], 'mid', 'high roll lands in the heaviest bucket');
    const cooling = [{ ...members[0]!, cooldownUntil: new Date(Date.now() + 60_000) }, members[1]!];
    assert.deepEqual(router().order({ ...settings, strategy: 'priority' }, cooling).map((entry) => entry.memberId), ['cheap']);
    const allCooling = [{ ...members[0]!, cooldownUntil: new Date(Date.now() + 90_000) }, { ...members[1]!, cooldownUntil: new Date(Date.now() + 10_000) }];
    assert.deepEqual(router().order({ ...settings, strategy: 'priority' }, allCooling).map((entry) => entry.memberId), ['cheap'], 'probes the soonest to recover');
  });

  it('stops before calling when the budget gate refuses', async () => {
    await setup('t_budget', [{ model: 'n/never', priceIn: 1_000_000, priceOut: 1_000_000 }]);
    seen.length = 0;
    const gate: BudgetGate = {
      check: async (_request, planned) => {
        assert.ok(planned > 0, 'the gate sees a planned cost');
        throw new BudgetBlockedError('daily_cap');
      },
    };
    await assert.rejects(run('t_budget', router(gate)), (error: unknown) => {
      assert.ok(error instanceof BudgetBlockedError);
      assert.equal(error.reason, 'daily_cap');
      return true;
    });
    assert.equal(seen.length, 0);
    const ledger = await app.pool.query(`select outcome from ai_usage_ledger where pool_code = 't_budget'`);
    assert.deepEqual(ledger.rows.map((row) => row.outcome), ['budget_blocked']);
  });
});
