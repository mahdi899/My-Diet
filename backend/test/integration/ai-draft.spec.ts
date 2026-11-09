import { HttpException } from '@nestjs/common';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { encryptText } from '../../src/common/field-crypto.js';
import { uuidv7 } from '../../src/common/id.js';
import { bootApp, type Booted } from '../helpers/boot.js';
import { completeOnboarding } from '../helpers/onboarding.js';

function hasApiErrorCode(error: unknown, code: string): boolean {
  if (!(error instanceof HttpException)) return false;
  const response = error.getResponse();
  return typeof response === 'object' && response !== null && 'code' in response && response.code === code;
}

type Mode = 'good' | 'server_error' | 'bad_slug_once' | 'unsafe_slug';

const FIELD_KEY = 'dev-only-field-key-not-for-production';

/** A tiny stand-in for a chat model: it reads the catalogue out of the prompt and answers with real slugs. */
function modelAnswer(userText: string, salt: number, poison?: string): string {
  const days = JSON.parse(/DAYS TO WRITE: (\[[\d,\s]*\])/.exec(userText)![1]!) as number[];
  const lists = new Map<string, string[]>();
  let current = '';
  for (const line of userText.split('\n')) {
    const header = /^\[(breakfast|lunch|dinner|snack)\]$/.exec(line.trim());
    if (header) {
      current = header[1]!;
      lists.set(current, []);
    } else if (current && /^[a-z0-9_]+ \| /.test(line)) lists.get(current)!.push(line.split(' | ')[0]!);
  }
  return JSON.stringify({
    days: days.map((day) => ({
      day,
      meals: [...lists.entries()].map(([mealType, slugs]) => {
        const pick = (offset: number) => slugs[(day * 3 + salt + offset) % slugs.length]!;
        return {
          mealType,
          primary: [{ slug: poison ?? pick(0), servings: 1 }],
          alternative: [{ slug: pick(1), servings: 1 }],
          note: 'نوش جان',
        };
      }),
    })),
  });
}

describe('AI plan drafting through pools', { concurrency: 1, timeout: 300_000 }, () => {
  let app: Booted;
  let server: http.Server;
  let baseUrl = '';
  const modes = new Map<string, Mode>();
  const calls: Array<{ model: string; system: string; user: string }> = [];
  const poisonedOnce = new Set<string>();
  let userSeq = 0;

  before(async () => {
    app = await bootApp({ AI_PROVIDER: 'pool', AI_ALLOW_PRIVATE_ENDPOINTS: 'true' });
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { model: string; messages: Array<{ role: string; content: string }> };
        const system = body.messages.find((message) => message.role === 'system')?.content ?? '';
        const user = body.messages.find((message) => message.role === 'user')?.content ?? '';
        calls.push({ model: body.model, system, user });
        const mode = modes.get(body.model) ?? 'good';
        if (mode === 'server_error') {
          res.writeHead(500);
          return void res.end('{}');
        }
        let content: string;
        if (body.model.startsWith('critic/')) content = JSON.stringify({ verdict: 'ok', issues: [{ severity: 'info', text: 'پلن متنوع است' }] });
        else if (mode === 'bad_slug_once' && !poisonedOnce.has(body.model)) {
          poisonedOnce.add(body.model);
          content = modelAnswer(user, 0, 'not-a-real-dish');
        } else content = modelAnswer(user, body.model.length);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          model: `${body.model}-routed`,
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 3000, completion_tokens: 2000, cost: 0.002 },
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    await setupPool('plan_draft', ['a/broken', 'b/good']);
    await setupPool('plan_critic', ['critic/m']);
    modes.set('a/broken', 'server_error');
  });

  after(async () => {
    server?.close();
    await app?.stop();
  });

  async function setupPool(code: string, models: string[]) {
    const poolId = uuidv7();
    await app.pool.query(`insert into ai_pools (id, code, title, strategy, max_attempts) values ($1,$2,$2,'priority',6) on conflict (code) do nothing`, [poolId, code]);
    const existing = await app.pool.query<{ id: string }>(`select id from ai_pools where code = $1`, [code]);
    const providerId = uuidv7();
    await app.pool.query(
      `insert into ai_providers (id, name, kind, base_url, api_key_encrypted) values ($1,$2,'openrouter',$3,$4)`,
      [providerId, `fake-${code}-${providerId.slice(-6)}`, baseUrl, encryptText('sk-test-not-real', FIELD_KEY)],
    );
    await app.pool.query(`delete from ai_pool_members where pool_id = $1`, [existing.rows[0]!.id]);
    for (const [index, model] of models.entries()) {
      await app.pool.query(
        `insert into ai_pool_members (id, pool_id, provider_id, model, position, weight) values ($1,$2,$3,$4,$5,1)`,
        [uuidv7(), existing.rows[0]!.id, providerId, model, index],
      );
    }
  }

  /** A brand-new onboarded user with a queued plan request. */
  async function queued(): Promise<{ requestId: string; userId: string }> {
    userSeq += 1;
    const phone = `0912700${String(1000 + userSeq)}`;
    const auth = await app.login(phone);
    await completeOnboarding(app.api, auth);
    const user = await app.pool.query<{ id: string }>(`select id from users where phone_e164 = $1`, [`+98${phone.slice(1)}`]);
    const userId = user.rows[0]!.id;
    const submission = await app.pool.query<{ id: string }>(`select id from questionnaire_submissions where user_id = $1 order by id desc limit 1`, [userId]);
    const orderId = uuidv7();
    const requestId = uuidv7();
    await app.pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
      [orderId, userId, `order-${orderId}`],
    );
    await app.pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman)
       values ($1,$2,$3,'new_plan','queued',$4,500000)`,
      [requestId, userId, orderId, submission.rows[0]!.id],
    );
    return { requestId, userId };
  }

  async function generate(requestId: string) {
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    await app.api.get(PlanDraftService).generate(requestId);
  }

  const generation = async (requestId: string) =>
    (await app.pool.query(`select * from ai_generations where request_id = $1 order by attempt_no desc limit 1`, [requestId])).rows[0];

  const mealCount = async (requestId: string) =>
    (await app.pool.query<{ n: number }>(
      `select count(m.id)::int as n from plan_versions v join plan_days d on d.plan_version_id = v.id
       join plan_meals m on m.plan_day_id = d.id where v.request_id = $1`,
      [requestId],
    )).rows[0]!.n;

  it('drafts a catalogue-grounded week, fails over, records cost and critic notes', async () => {
    calls.length = 0;
    const { requestId } = await queued();
    await generate(requestId);
    const row = await generation(requestId);
    assert.equal(row.status, 'drafted', JSON.stringify(row));
    assert.equal(row.pool_code, 'plan_draft');
    assert.match(row.prompt_version, /^plan_draft@\d+$/);
    assert.ok(Number(row.cost_micros) > 0);
    assert.ok(await mealCount(requestId) >= 7 * 2);
    const ledger = await app.pool.query(`select outcome, cost_micros from ai_usage_ledger where request_id = $1`, [requestId]);
    assert.ok(ledger.rows.some((entry) => entry.outcome === 'rejected'), 'first member failed');
    assert.ok(ledger.rows.some((entry) => entry.outcome === 'ok'));
    assert.equal(ledger.rows.reduce((sum, entry) => sum + Number(entry.cost_micros), 0), Number(row.cost_micros), 'generation cost equals the ledger');
    assert.ok(Array.isArray(row.attempt_chain) && row.attempt_chain.length >= 3);
    assert.equal(row.ai_notes.critic.verdict, 'ok');
    assert.equal(row.ai_notes.dayTotals.length, 7);

    const prompt = calls.find((call) => call.model === 'b/good')!;
    assert.ok(prompt.user.includes('weight_loss'));
    assert.equal(/نگار/.test(prompt.user), false, 'the name never reaches the model');
    assert.equal(/09127|\+98912/.test(prompt.user), false, 'the phone never reaches the model');

    const plan = await app.pool.query(
      `select m.title, m.calories from plan_versions v join plan_days d on d.plan_version_id = v.id
       join plan_meals m on m.plan_day_id = d.id where v.request_id = $1 limit 3`,
      [requestId],
    );
    for (const meal of plan.rows) assert.ok(meal.title.length > 0 && Number(meal.calories) > 50);
  });

  it('asks the model to repair an answer that names a dish outside the catalogue', async () => {
    modes.set('a/broken', 'bad_slug_once');
    poisonedOnce.clear();
    calls.length = 0;
    const { requestId } = await queued();
    await generate(requestId);
    const row = await generation(requestId);
    assert.equal(row.status, 'drafted', JSON.stringify(row));
    const ledger = await app.pool.query(`select outcome from ai_usage_ledger where request_id = $1`, [requestId]);
    assert.ok(ledger.rows.some((entry) => entry.outcome === 'invalid_plan'));
    modes.set('a/broken', 'server_error');
    modes.set('b/good', 'good');
  });

  it('hands over a blank week when the per-request cap is hit, and still books the money spent', async () => {
    await app.pool.query(`update ai_controls set per_request_cap_micros = 1500 where id = true`);
    const { requestId } = await queued();
    await generate(requestId);
    const row = await generation(requestId);
    assert.equal(row.status, 'failed');
    assert.equal(row.skipped_reason, 'budget_blocked');
    assert.ok(Number(row.cost_micros) > 0 && Number(row.cost_micros) <= 2000);
    assert.equal(await mealCount(requestId), 0);
    await app.pool.query(`update ai_controls set per_request_cap_micros = null where id = true`);
  });

  it('enforces the kill switch, the daily cap warning and the per-user quota', async () => {
    const first = await queued();
    await app.pool.query(`update ai_controls set kill_switch = true where id = true`);
    await generate(first.requestId);
    assert.equal((await generation(first.requestId)).skipped_reason, 'kill_switch');
    await app.pool.query(`update ai_controls set kill_switch = false where id = true`);

    await app.pool.query(`update ai_controls set per_user_daily_drafts = 1 where id = true`);
    const quota = await queued();
    await generate(quota.requestId);
    assert.equal((await generation(quota.requestId)).status, 'drafted');
    const orderId = uuidv7();
    const again = uuidv7();
    const submission = await app.pool.query<{ id: string }>(`select id from questionnaire_submissions where user_id = $1 limit 1`, [quota.userId]);
    await app.pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
      [orderId, quota.userId, `order-${orderId}`],
    );
    await app.pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman)
       values ($1,$2,$3,'new_plan','queued',$4,500000)`,
      [again, quota.userId, orderId, submission.rows[0]!.id],
    );
    await generate(again);
    assert.equal((await generation(again)).skipped_reason, 'user_quota');
    await app.pool.query(`update ai_controls set per_user_daily_drafts = 5 where id = true`);

    const spent = Number((await app.pool.query(`select coalesce(sum(cost_micros),0)::text as s from ai_generations`)).rows[0].s);
    await app.pool.query(`update ai_controls set daily_cost_cap_micros = $1 where id = true`, [Math.ceil(spent * 1.05)]);
    const warned = await queued();
    await generate(warned.requestId);
    const warnings = await app.pool.query(`select 1 from audit_logs where action = 'ai_budget_warning_daily'`);
    assert.equal(warnings.rowCount, 1);
    await app.pool.query(`update ai_controls set daily_cost_cap_micros = null where id = true`);
  });

  it('shows the doctor the profile and AI review, and regenerates the same draft in place', async () => {
    const { requestId } = await queued();
    await generate(requestId);
    const specialistId = uuidv7();
    await app.pool.query(`insert into users (id, phone_e164, role, display_name) values ($1,'+989127999001','specialist','دکتر آزمون')`, [specialistId]);
    await app.pool.query('update plan_requests set assigned_specialist_id = $1 where id = $2', [specialistId, requestId]);
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    const plans = app.api.get(PlanDraftService);

    const before = await plans.staffRequest(specialistId, 'specialist', requestId, null);
    assert.equal(before.profile?.track, 'weight_loss');
    assert.ok((before.profile?.energy.targetKcal ?? 0) > 1000);
    assert.equal(before.aiReview?.status, 'drafted');
    assert.equal(before.aiReview?.poolCode, 'plan_draft');
    assert.equal(before.aiReview?.dayTotals.length, 7);
    assert.ok(Array.isArray(before.riskFlags));

    const firstUid = before.version!.days[0]!.meals[0]!.mealUid;
    const lock = before.version!.lockVersion;
    await assert.rejects(plans.regenerate(specialistId, requestId, lock + 5), (error: unknown) => hasApiErrorCode(error, 'lock_conflict'));
    assert.deepEqual(await plans.regenerate(specialistId, requestId, lock), { status: 'generating' });
    for (let i = 0; i < 100; i += 1) {
      const status = (await app.pool.query<{ status: string }>('select status from plan_requests where id = $1', [requestId])).rows[0]!.status;
      if (status === 'in_review') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const after = await plans.staffRequest(specialistId, 'specialist', requestId, null);
    assert.equal(after.status, 'in_review');
    assert.equal(after.version!.id, before.version!.id, 'same draft version, swapped in place');
    assert.equal(after.version!.lockVersion, lock + 1);
    assert.notEqual(after.version!.days[0]!.meals[0]!.mealUid, firstUid);
    assert.equal(after.aiReview?.attemptNo, 2);
    assert.equal((await app.pool.query('select count(*)::int as n from ai_generations where request_id = $1', [requestId])).rows[0].n, 2);

    await app.pool.query('update ai_controls set kill_switch = true where id = true');
    await assert.rejects(plans.regenerate(specialistId, requestId, lock + 1), (error: unknown) => hasApiErrorCode(error, 'ai_budget_blocked'));
    await app.pool.query('update ai_controls set kill_switch = false where id = true');
  });

  it('lets the doctor complete the third option from the catalogue, approve everything and publish', async () => {
    const { requestId, userId } = await queued();
    await generate(requestId);
    const specialistId = uuidv7();
    await app.pool.query(`insert into users (id, phone_e164, role, display_name) values ($1,'+989127999002','specialist','دکتر دوم')`, [specialistId]);
    await app.pool.query(`insert into specialist_profiles(user_id,display_name,credential,verification_status) values($1,'دکتر دوم','test','verified')`, [specialistId]);
    await app.pool.query('update plan_requests set assigned_specialist_id = $1 where id = $2', [specialistId, requestId]);
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    const { FoodService } = await import('../../dist/food/food.service.js');
    const plans = app.api.get(PlanDraftService);
    const foods = app.api.get(FoodService);

    const draft = await plans.staffRequest(specialistId, 'specialist', requestId, null);
    // The AI wrote two options per meal, so publishing is refused until the doctor adds and approves the third.
    await assert.rejects(plans.publish(specialistId, 'specialist', requestId, draft.version!.lockVersion), (error: unknown) => hasApiErrorCode(error, 'options_required'));

    const dish = (await foods.list({ q: 'قیمه', limit: 1 })).items[0] ?? (await foods.list({ limit: 1 })).items[0]!;
    const composed = await foods.compose({ kind: 'specialist_alternative', items: [{ slug: dish.slug, servings: 1.5 }] });
    assert.equal(composed.option.calories, Math.round(dish.kcal * 1.5));
    await assert.rejects(foods.compose({ kind: 'primary', items: [{ slug: 'no-such-dish', servings: 1 }] }));

    const days = draft.version!.days.map((day) => ({
      meals: day.meals.map((meal) => {
        const options = (meal.options ?? []).map((o) => ({ ...o, approved: true }));
        options.push({ ...composed.option, optionId: uuidv7(), approved: true });
        return { ...meal, options };
      }),
    }));
    const saved = await plans.replaceDraft(specialistId, 'specialist', requestId, draft.version!.lockVersion, { days });
    await plans.publish(specialistId, 'specialist', requestId, saved.lockVersion);
    const final = await plans.staffRequest(specialistId, 'specialist', requestId, null);
    assert.equal(final.status, 'published');
    assert.equal(final.version!.status, 'published');
    assert.ok(final.version!.days.every((d) => d.meals.every((m) => m.options?.length === 3 && m.options.every((o) => o.approved))));
    assert.ok(userId);
  });
});
