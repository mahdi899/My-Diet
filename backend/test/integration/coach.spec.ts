import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { uuidv7 } from '../../src/common/id.js';
import { bootApp, type Booted } from '../helpers/boot.js';
import { completeOnboarding } from '../helpers/onboarding.js';
import { loginAdmin } from '../helpers/admin-login.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';

interface SseFrame {
  event: string;
  data: {
    replayed?: boolean;
    message?: { type?: string; fallbackText?: string };
  };
}

function parseSse(raw: string): SseFrame[] {
  const events: SseFrame[] = [];
  for (const block of raw.split(/\n\n/)) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length) events.push({ event, data: JSON.parse(data.join('\n')) as SseFrame['data'] });
  }
  return events;
}

describe('coach API with the fake driver', { concurrency: 1, timeout: 240_000 }, () => {
  let app: Booted;

  before(async () => {
    app = await bootApp();
  });

  after(async () => {
    await app?.stop();
  });

  it('streams a turn, replays it, blocks a crisis, and logs water without a model', async () => {
    const auth = await app.login('09120000021');
    await completeOnboarding(app.api, auth);
    const server = app.api.getHttpServer();
    const id = uuidv7();
    const sent = await request(server).post('/v1/me/coach/messages').set(auth)
      .send({ clientMessageId: id, kind: 'text', text: 'امروز چقدر کالری باقی مانده؟' });
    assert.equal(sent.status, 200, sent.text);
    assert.match(String(sent.headers['content-type']), /text\/event-stream/);
    const events = parseSse(sent.text);
    assert.ok(events.some((event) => event.event === 'user_message'));
    assert.ok(events.some((event) => event.event === 'delta'));
    assert.ok(events.some((event) => event.event === 'message' && event.data.message?.type === 'calorie_ring'));
    assert.equal(events.at(-1)?.event, 'done');
    assert.equal(events.at(-1)?.data.replayed, false);

    const again = await request(server).post('/v1/me/coach/messages').set(auth)
      .send({ clientMessageId: id, kind: 'text', text: 'امروز چقدر کالری باقی مانده؟' });
    const replay = parseSse(again.text);
    assert.equal(replay.at(-1)?.data.replayed, true);
    assert.equal(replay.filter((event) => event.event === 'message').length, events.filter((event) => event.event === 'message').length);

    const crisis = await request(server).post('/v1/me/coach/messages').set(auth)
      .send({ clientMessageId: uuidv7(), kind: 'text', text: 'میخوام بمیرم' });
    const blocked = parseSse(crisis.text);
    assert.equal(blocked.some((event) => event.event === 'delta'), false);
    const reply = blocked.find((event) => event.event === 'message');
    assert.match(String(reply?.data.message?.fallbackText ?? ''), /۱۱۵/);

    const today = await request(server).get('/v1/me/coach/today').set(auth);
    assert.equal(today.status, 200);
    assert.equal(today.body.hasProfile, true);
    assert.ok(today.body.calories.target > 0);

    const water = await request(server).post('/v1/me/coach/actions').set(auth)
      .send({ clientMessageId: uuidv7(), action: 'log_water', args: { ml: 250 } });
    assert.ok(water.status === 200 || water.status === 201, JSON.stringify(water.body));
    assert.ok(water.body.messages.some((message: { type: string }) => message.type === 'water'));

    const thread = await request(server).get('/v1/me/coach/thread').set(auth);
    assert.equal(thread.status, 200);
    assert.ok(thread.body.messages.length >= 2);

    const adminPhone = '09128000088';
    await app.pool.query(
      `insert into users (id, phone_e164, role, status) values ($1, $2, 'admin', 'active')`,
      [uuidv7(), normalizeIranianMobile(adminPhone)],
    );
    const admin = await loginAdmin(app.api, app.pool, adminPhone);
    const userId = (
      await app.pool.query<{ id: string }>(`select id from users where phone_e164 = $1`, [
        normalizeIranianMobile('09120000021'),
      ])
    ).rows[0]!.id;
    const removed = await request(server)
      .post(`/v1/admin/users/${userId}/delete`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ confirmation: 'حذف حساب' });
    assert.equal(removed.status, 201, JSON.stringify(removed.body));
    const gone = await app.pool.query(`select 1 from users where id = $1`, [userId]);
    assert.equal(gone.rowCount, 0);
  });
});
