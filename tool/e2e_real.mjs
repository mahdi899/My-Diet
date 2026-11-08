// Live end-to-end run against a running dev API + worker (backend/local-admin.mjs and local-worker.mjs):
//   admin sets up OpenRouter + pools -> a user onboards, pays from the wallet -> AI drafts the plan ->
//   a doctor completes and approves it -> the user sees the plan.
//
// The OpenRouter key is read from the OPENROUTER_API_KEY environment variable only. It is never written to disk.
//   $env:OPENROUTER_API_KEY = '...'; node tool/e2e_real.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { activeQuestions } from '../backend/dist/onboarding/spec.js';

const API = process.env.API ?? 'http://localhost:3000';
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY in the environment.');
const config = JSON.parse(readFileSync(new URL('../backend/.env.local-admin.json', import.meta.url), 'utf8'));
const DRAFT_MODELS = (process.env.E2E_DRAFT_MODELS ?? 'google/gemini-2.5-flash,openai/gpt-4o-mini').split(',');
const CRITIC_MODEL = process.env.E2E_CRITIC_MODEL ?? 'openai/gpt-4o-mini';
const stamp = String(Date.now()).slice(-6);

const say = (...parts) => console.log(...parts);
const step = (title) => say(`\n=== ${title}`);

async function call(method, path, { token, body, headers = {}, expect } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (expect ? !expect.includes(response.status) : !response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return { status: response.status, data };
}

async function otpLogin(phone) {
  await call('POST', '/v1/auth/otp/request', { body: { phone } });
  const verified = await call('POST', '/v1/auth/otp/verify', { body: { phone, code: '123456' } });
  return verified.data.accessToken;
}

function sampleAnswers(overrides = {}) {
  const base = { name: 'نگار رضایی', age: 33, sex: 'female', height_cm: 166, weight_kg: 79, target_weight_kg: 68, sleep_wake: { sleep: 23, wake: 7 } };
  const pick = (question) => {
    if (overrides[question.key] != null) return overrides[question.key];
    if (base[question.key] != null) return base[question.key];
    const options = question.options ?? [];
    if (question.kind === 'text') return 'توضیح';
    if (question.kind === 'number' || question.kind === 'age') return question.default ?? question.min ?? 1;
    if (question.kind === 'single') return (options.find((o) => o.code !== 'yes') ?? options[0]).code;
    const none = options.find((o) => o.code === 'none');
    return [(none ?? options[0]).code];
  };
  const answers = {};
  for (let round = 0; round < 5; round += 1) {
    for (const question of activeQuestions('weight_loss', answers)) {
      if (answers[question.key] != null) continue;
      answers[question.key] = pick(question);
      if (question.followUp) {
        const value = answers[question.key];
        const codes = Array.isArray(value) ? value : [String(value)];
        if (codes.some((code) => question.followUp.whenCodes.includes(code))) answers[question.followUp.key] = 'توضیح';
      }
    }
  }
  return answers;
}

async function onboardAndOrder(phone, overrides) {
  const token = await otpLogin(phone);
  await call('PUT', '/v1/me/onboarding/draft', { token, body: { track: 'weight_loss', patch: sampleAnswers(overrides), stepKey: 'review', progress: 90 } });
  await call('POST', '/v1/me/onboarding/submit', { token, body: { consent: true } });
  let wallet = (await call('GET', '/v1/me/wallet', { token })).data;
  while (wallet.cashToman + wallet.promoToman < 500000) {
    const topup = await call('POST', '/v1/me/topups', { token, body: { packageCode: 'p50' } });
    await call('POST', '/v1/payments/sandbox/complete', { body: { paymentId: topup.data.paymentId } });
    wallet = (await call('GET', '/v1/me/wallet', { token })).data;
  }
  const placed = await call('POST', '/v1/me/orders', {
    token, headers: { 'Idempotency-Key': randomUUID() }, body: { serviceCode: 'new_plan', expectedPriceToman: 500000 }, expect: [200, 201, 402, 409],
  });
  return { token, wallet, placed };
}

async function waitFor(token, predicate, label, seconds = 240) {
  const until = Date.now() + seconds * 1000;
  let last = '';
  while (Date.now() < until) {
    const current = (await call('GET', '/v1/me/request', { token })).data;
    const status = `${current?.status}${current?.phase ? `/${current.phase}` : ''}`;
    if (status !== last) { say(`  [${new Date().toISOString().slice(11, 19)}] request ${status}`); last = status; }
    if (predicate(current)) return current;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out waiting for: ${label} (last ${last})`);
}

// 1. Admin ------------------------------------------------------------------------------------------------
step('Admin login and OpenRouter setup');
const admin = (await call('POST', '/v1/auth/admin/login', { body: { username: config.adminUsername, password: config.adminPassword } })).data.accessToken;
const providers = (await call('GET', '/v1/admin/ai/providers', { token: admin })).data.items;
let provider = providers.find((p) => p.name === 'openrouter-e2e');
if (!provider) {
  provider = (await call('POST', '/v1/admin/ai/providers', {
    token: admin, body: { name: 'openrouter-e2e', kind: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: KEY, appTitle: 'سبزینه' },
  })).data;
} else {
  provider = (await call('PUT', `/v1/admin/ai/providers/${provider.id}`, { token: admin, body: { apiKey: KEY } })).data;
}
say('provider', provider.id, 'key hint', provider.keyHint, 'leaks key in response:', JSON.stringify(provider).includes(KEY));

const catalogue = [];
for (const id of [...DRAFT_MODELS, CRITIC_MODEL]) {
  const found = await call('GET', `/v1/admin/ai/providers/${provider.id}/models?q=${encodeURIComponent(id)}`, { token: admin });
  catalogue.push(...found.data.items);
}
say('resolved models', catalogue.map((m) => `${m.id} (${m.priceInMicrosPerM}/${m.priceOutMicrosPerM} µ$/M)`).join(', '));
const priced = (id) => {
  const model = catalogue.find((m) => m.id === id);
  if (!model) throw new Error(`Model ${id} is not in the OpenRouter catalogue`);
  return { providerId: provider.id, model: id, priceInMicrosPerM: model.priceInMicrosPerM, priceOutMicrosPerM: model.priceOutMicrosPerM };
};
const test = (await call('POST', `/v1/admin/ai/providers/${provider.id}/test`, { token: admin, body: { model: CRITIC_MODEL } })).data;
say('provider test', JSON.stringify(test));

step('Pools with a deliberately broken first member (failover)');
await call('PUT', '/v1/admin/ai/pools/plan_draft/members', {
  token: admin, body: { members: [{ providerId: provider.id, model: 'nonexistent/model-xyz' }, ...DRAFT_MODELS.map(priced)] },
});
await call('PUT', '/v1/admin/ai/pools/plan_critic/members', { token: admin, body: { members: [priced(CRITIC_MODEL)] } });
const pooled = (await call('POST', '/v1/admin/ai/pools/plan_draft/test', { token: admin, expect: [200, 201] })).data;
say('pool test ok=', pooled.ok, 'chain=', JSON.stringify(pooled.chain.map((c) => `${c.model}:${c.outcome}`)));
if (!pooled.ok || pooled.chain[0].outcome === 'ok') throw new Error('Failover was not exercised');
await call('PUT', '/v1/admin/ai/budget', { token: admin, body: { dailyCapMicros: 3_000_000, monthlyCapMicros: 30_000_000, perRequestCapMicros: 1_000_000, perUserDailyDrafts: 5 } });

// 2. Doctor -----------------------------------------------------------------------------------------------
step('Doctor account');
const doctorPhone = `0912${stamp}1`.slice(0, 11);
const doctor = (await call('POST', '/v1/admin/specialists', { token: admin, body: { phone: doctorPhone, displayName: 'دکتر آزمایشی', credential: 'کارشناس ارشد تغذیه' } })).data;
say('doctor', doctor.id);

// 3. User -------------------------------------------------------------------------------------------------
step('Fresh user: onboarding, wallet top-up, order');
const userPhone = `0913${stamp}2`.slice(0, 11);
const user = await onboardAndOrder(userPhone, {});
say('wallet', JSON.stringify(user.wallet), 'order', user.placed.status, JSON.stringify(user.placed.data).slice(0, 200));
const requestId = user.placed.data.requestId;
if (!requestId) throw new Error('Order was not placed');

step('AI draft through the worker (real OpenRouter)');
await waitFor(user.token, (r) => ['in_review', 'awaiting_user', 'awaiting_review'].includes(r?.status) || r?.hasDraft === true, 'draft ready');
const gens = (await call('GET', '/v1/admin/ai/generations', { token: admin })).data.items;
const generation = gens.find((g) => g.requestId === requestId) ?? gens[0];
say('generation', JSON.stringify(generation).slice(0, 700));
const ledger = (await call('GET', '/v1/admin/ai/ledger?limit=20', { token: admin })).data.items;
say('ledger rows', ledger.length);
for (const row of ledger.slice(0, 8)) say('  ', row.task, row.model, row.outcome, `${row.costMicros ?? row.cost_micros}µ$`, row.latencyMs ?? '');
const usage = (await call('GET', '/v1/admin/ai/usage', { token: admin })).data;
say('usage today µ$', usage.todayMicros, 'alert', usage.alert);

// 4. Doctor review and approval ---------------------------------------------------------------------------
step('Doctor completes the third option and approves');
await call('POST', `/v1/admin/requests/${requestId}/assignment`, { token: admin, body: { specialistId: doctor.id, reason: 'e2e' }, expect: [200, 201, 409] });
const doctorToken = await otpLogin(doctorPhone);
let detail = (await call('GET', `/v1/specialist/requests/${requestId}`, { token: doctorToken })).data;
say('doctor sees status', detail.status, 'days', detail.version?.days?.length, 'phone leaked:', JSON.stringify(detail).includes('+9891'));
const dishes = (await call('GET', '/v1/catalog/foods?q=قیمه&limit=1', { token: doctorToken })).data.items;
const dish = dishes[0] ?? (await call('GET', '/v1/catalog/foods?limit=1', { token: doctorToken })).data.items[0];
const composed = (await call('POST', '/v1/catalog/compose', { token: doctorToken, body: { kind: 'specialist_alternative', items: [{ slug: dish.slug, servings: 1 }] } })).data;
const days = detail.version.days.map((day) => ({
  meals: day.meals.map((meal) => ({
    ...meal,
    options: [...(meal.options ?? []).map((o) => ({ ...o, approved: true })), { ...composed.option, optionId: randomUUID(), approved: true }],
  })),
}));
const saved = (await call('PUT', `/v1/specialist/requests/${requestId}/draft`, { token: doctorToken, headers: { 'If-Match': String(detail.version.lockVersion) }, body: { days } })).data;
await call('POST', `/v1/specialist/requests/${requestId}/publish`, { token: doctorToken, headers: { 'If-Match': String(saved.lockVersion) } });
say('published');

step('User sees the approved plan');
const plan = (await call('GET', '/v1/me/plan', { token: user.token })).data;
const firstDay = plan.days.find((day) => day.meals.length) ?? plan.days[0];
say('days', plan.days.length, 'first day', firstDay.date, 'meals', firstDay.meals.map((m) => `${m.mealType}:${m.title}(${m.calories})`).join(' | '));
say('options per meal', firstDay.meals.map((m) => m.options?.length).join(','));

// 5. Budget cap ----------------------------------------------------------------------------------------------
step('Budget cap blocks the next draft');
await call('PUT', '/v1/admin/ai/budget', { token: admin, body: { dailyCapMicros: 1, monthlyCapMicros: null, perRequestCapMicros: null, perUserDailyDrafts: 5 } });
const blocked = await onboardAndOrder(`0914${stamp}3`.slice(0, 11), {});
say('second order', blocked.placed.status, JSON.stringify(blocked.placed.data).slice(0, 160));
await new Promise((resolve) => setTimeout(resolve, 8000));
const afterBlock = (await call('GET', '/v1/me/request', { token: blocked.token })).data;
say('request after cap:', afterBlock?.status, afterBlock?.phase ?? '');
await call('PUT', '/v1/admin/ai/budget', { token: admin, body: { dailyCapMicros: 3_000_000, monthlyCapMicros: 30_000_000, perRequestCapMicros: 1_000_000, perUserDailyDrafts: 5 } });
say('\nE2E finished.');
