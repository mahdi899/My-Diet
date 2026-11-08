import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { uuidv7 } from '../../src/common/id.js';
import { DEFAULT_PROMPTS } from '../../src/ai/draft/prompts.js';
import { loginAdmin } from '../helpers/admin-login.js';
import { bootApp, type Booted } from '../helpers/boot.js';

const KEY = 'sk-or-v1-test-key-1234567890abcdef';

describe('AI admin API', { concurrency: 1, timeout: 240_000 }, () => {
  let app: Booted;
  let server: http.Server;
  let baseUrl = '';
  let admin: { Authorization: string };
  const chatAuth: string[] = [];

  before(async () => {
    app = await bootApp({ AI_PROVIDER: 'pool', AI_ALLOW_PRIVATE_ENDPOINTS: 'true' });
    server = http.createServer((req, res) => {
      if (req.url?.endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return void res.end(JSON.stringify({
          data: [
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' } },
            { id: 'meta/free-model:free', name: 'Free', context_length: 8000, pricing: { prompt: '0', completion: '0' } },
          ],
        }));
      }
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { model: string };
        chatAuth.push(String(req.headers.authorization));
        if (body.model === 'a/broken') {
          res.writeHead(500);
          return void res.end('{}');
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          model: body.model,
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 12, completion_tokens: 2, cost: 0.00001 },
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    const adminId = uuidv7();
    await app.pool.query(`insert into users (id, phone_e164, role, display_name) values ($1, '+989128000000', 'admin', 'مدیر')`, [adminId]);
    await app.pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    admin = { Authorization: `Bearer ${(await loginAdmin(app.api, app.pool, '09128000000')).accessToken}` };
  });

  after(async () => {
    server?.close();
    await app?.stop();
  });

  const http_ = () => request(app.api.getHttpServer());
  let providerId = '';
  let secondId = '';

  it('keeps AI settings away from non-admins', async () => {
    const user = await app.login('09127770001');
    assert.equal((await http_().get('/v1/admin/ai/providers').set(user)).status, 403);
    assert.equal((await http_().get('/v1/admin/ai/providers')).status, 401);
  });

  it('stores a provider key encrypted and never returns it', async () => {
    const created = await http_().post('/v1/admin/ai/providers').set(admin)
      .send({ name: 'openrouter-main', kind: 'openrouter', baseUrl, apiKey: KEY, appTitle: 'سبزینه' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    providerId = created.body.id;
    assert.equal(created.body.hasKey, true);
    assert.equal(created.body.keyHint, '…cdef');
    assert.equal(JSON.stringify(created.body).includes(KEY), false);
    const stored = await app.pool.query(`select api_key_encrypted from ai_providers where id = $1`, [providerId]);
    assert.ok(String(stored.rows[0].api_key_encrypted).startsWith('enc1:'));
    assert.equal(String(stored.rows[0].api_key_encrypted).includes(KEY), false);
    const listed = await http_().get('/v1/admin/ai/providers').set(admin);
    assert.equal(JSON.stringify(listed.body).includes(KEY), false);
    assert.equal((await http_().post('/v1/admin/ai/providers').set(admin).send({ name: 'x', kind: 'openrouter', baseUrl, apiKey: 'short' })).status, 400);
    assert.equal((await http_().post('/v1/admin/ai/providers').set(admin).send({ name: 'openrouter-main', kind: 'openrouter', baseUrl, apiKey: KEY })).status, 409);
    const audited = await app.pool.query(`select detail from audit_logs where action = 'ai_provider_created'`);
    assert.equal(JSON.stringify(audited.rows).includes(KEY), false);
  });

  it('tests a provider with a real call and records its cost', async () => {
    const result = await http_().post(`/v1/admin/ai/providers/${providerId}/test`).set(admin).send({ model: 'openai/gpt-4o-mini' });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.ok, true);
    assert.equal(result.body.costMicros, 10);
    assert.equal(chatAuth.at(-1), `Bearer ${KEY}`);
    const ledger = await app.pool.query(`select outcome, task from ai_usage_ledger where task = 'provider_test'`);
    assert.equal(ledger.rowCount, 1);
    const none = await http_().post('/v1/admin/ai/providers').set(admin).send({ name: 'no-key', kind: 'openai_compatible', baseUrl });
    secondId = none.body.id;
    assert.equal(none.body.hasKey, false);
    assert.equal((await http_().post(`/v1/admin/ai/providers/${secondId}/test`).set(admin).send({})).status, 409);
  });

  it('lists the live model catalogue with prices in micro-USD per million tokens', async () => {
    const list = await http_().get(`/v1/admin/ai/providers/${providerId}/models?q=gpt`).set(admin);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].priceInMicrosPerM, 150_000);
    assert.equal(list.body.items[0].priceOutMicrosPerM, 600_000);
    const all = await http_().get(`/v1/admin/ai/providers/${providerId}/models`).set(admin);
    assert.equal(all.body.items.find((model: { id: string }) => model.id === 'meta/free-model:free').free, true);
  });

  it('configures a pool with fallback members and proves failover', async () => {
    const set = await http_().put('/v1/admin/ai/pools/plan_draft/members').set(admin).send({
      members: [
        { providerId, model: 'a/broken', priceInMicrosPerM: 100_000, priceOutMicrosPerM: 100_000 },
        { providerId, model: 'openai/gpt-4o-mini', priceInMicrosPerM: 150_000, priceOutMicrosPerM: 600_000 },
      ],
    });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    const pool = set.body.items.find((entry: { code: string }) => entry.code === 'plan_draft');
    assert.deepEqual(pool.members.map((member: { model: string }) => member.model), ['a/broken', 'openai/gpt-4o-mini']);

    const tested = await http_().post('/v1/admin/ai/pools/plan_draft/test').set(admin);
    assert.equal(tested.status, 201, JSON.stringify(tested.body));
    assert.equal(tested.body.ok, true);
    assert.deepEqual(tested.body.chain.map((entry: { outcome: string }) => entry.outcome), ['rejected', 'ok']);

    const after = await http_().get('/v1/admin/ai/pools').set(admin);
    const members = after.body.items.find((entry: { code: string }) => entry.code === 'plan_draft').members;
    assert.equal(members[0].consecutiveFailures, 1);
    assert.equal(members[1].totalOk, 1);
    const reset = await http_().post(`/v1/admin/ai/members/${members[0].id}/reset-health`).set(admin);
    assert.equal(reset.status, 201);

    const reorder = await http_().put('/v1/admin/ai/pools/plan_draft/members').set(admin).send({
      members: [{ providerId, model: 'openai/gpt-4o-mini' }, { providerId, model: 'a/broken' }],
    });
    const kept = reorder.body.items.find((entry: { code: string }) => entry.code === 'plan_draft').members;
    assert.equal(kept[0].id, members[1].id, 'a member that stays keeps its identity and health');
    assert.equal(kept[0].totalOk, 1);

    assert.equal((await http_().put('/v1/admin/ai/pools/plan_draft').set(admin).send({ strategy: 'nope' })).status, 400);
    const updated = await http_().put('/v1/admin/ai/pools/plan_draft').set(admin).send({ strategy: 'cost_first', maxAttempts: 3, temperature: 0.2 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.items.find((entry: { code: string }) => entry.code === 'plan_draft').strategy, 'cost_first');
  });

  it('refuses to delete a provider that a pool still uses, and deletes an unused one', async () => {
    assert.equal((await http_().delete(`/v1/admin/ai/providers/${providerId}`).set(admin)).status, 409);
    assert.equal((await http_().delete(`/v1/admin/ai/providers/${secondId}`).set(admin)).status, 200);
  });

  it('rotates a key without revealing the old one', async () => {
    const rotated = await http_().put(`/v1/admin/ai/providers/${providerId}`).set(admin).send({ apiKey: 'sk-or-v1-rotated-key-9876543210zz' });
    assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
    assert.equal(rotated.body.keyHint, '…10zz');
    await http_().post(`/v1/admin/ai/providers/${providerId}/test`).set(admin).send({ model: 'openai/gpt-4o-mini' });
    assert.equal(chatAuth.at(-1), 'Bearer sk-or-v1-rotated-key-9876543210zz');
  });

  it('manages budget controls and reports usage', async () => {
    const set = await http_().put('/v1/admin/ai/budget').set(admin)
      .send({ dailyCapMicros: 5_000_000, monthlyCapMicros: 80_000_000, perRequestCapMicros: 600_000, perUserDailyDrafts: 3 });
    assert.equal(set.status, 200, JSON.stringify(set.body));
    const got = await http_().get('/v1/admin/ai/budget').set(admin);
    assert.equal(got.body.monthlyCapMicros, 80_000_000);
    assert.equal(got.body.perUserDailyDrafts, 3);
    assert.equal((await http_().put('/v1/admin/ai/budget').set(admin).send({ perUserDailyDrafts: 0 })).status, 400);
    assert.equal((await http_().put('/v1/admin/ai/budget').set(admin).send({ dailyCapMicros: -5 })).status, 400);
    const usage = await http_().get('/v1/admin/ai/usage').set(admin);
    assert.equal(usage.status, 200);
    assert.ok(usage.body.todayMicros > 0);
    assert.ok(usage.body.byModel.length >= 1);
    assert.ok(['ok', 'warning', 'blocked', 'killed'].includes(usage.body.alert));
    const ledger = await http_().get('/v1/admin/ai/ledger?limit=5').set(admin);
    assert.ok(ledger.body.items.length >= 1);
    assert.equal(JSON.stringify(ledger.body).includes('sk-or'), false);
    const gens = await http_().get('/v1/admin/ai/generations').set(admin);
    assert.equal(gens.status, 200);
    await http_().put('/v1/admin/ai/budget').set(admin).send({ dailyCapMicros: null, monthlyCapMicros: null, perRequestCapMicros: null, perUserDailyDrafts: 5 });
  });

  it('versions prompts, validates placeholders and switches the active one', async () => {
    const listed = await http_().get('/v1/admin/ai/prompts?key=plan_draft').set(admin);
    assert.equal(listed.body.items[0].status, 'active');
    assert.equal(listed.body.items[0].version, 1);
    const bad = await http_().post('/v1/admin/ai/prompts/plan_draft').set(admin).send({ systemPrompt: 'x'.repeat(300), userTemplate: 'no placeholders' });
    assert.equal(bad.status, 400);
    const draft = await http_().post('/v1/admin/ai/prompts/plan_draft').set(admin)
      .send({ systemPrompt: DEFAULT_PROMPTS.plan_draft.systemPrompt + '\nنسخهٔ آزمایشی', userTemplate: DEFAULT_PROMPTS.plan_draft.userTemplate, notes: 'تست' });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.version, 2);
    assert.equal((await http_().post('/v1/admin/ai/prompts/plan_draft/2/activate').set(admin)).status, 201);
    const now = await http_().get('/v1/admin/ai/prompts?key=plan_draft').set(admin);
    assert.deepEqual(now.body.items.map((item: { version: number; status: string }) => [item.version, item.status]), [[2, 'active'], [1, 'retired']]);
    assert.equal((await http_().post('/v1/admin/ai/prompts/nonsense').set(admin).send({})).status, 400);
    assert.equal((await http_().post('/v1/admin/ai/prompts/plan_draft/9/activate').set(admin)).status, 404);
  });
});
