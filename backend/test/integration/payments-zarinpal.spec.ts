import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { bootApp, type Booted } from '../helpers/boot.js';

/** A local stand-in for Zarinpal's v4 API; no real money or network is involved. */
function fakeZarinpal() {
  const issued = new Map<string, { amount: number; paid: boolean }>();
  const calls: string[] = [];
  let failRequest = false;
  let n = 0;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
        amount: number;
        authority?: string;
        merchant_id: string;
      };
      calls.push(`${req.url} ${body.merchant_id}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/pg/v4/payment/request.json') {
        if (failRequest) return void res.end(JSON.stringify({ data: [], errors: { code: -9, message: 'bad' } }));
        const authority = `A${String(++n).padStart(35, '0')}`;
        issued.set(authority, { amount: body.amount, paid: true });
        return void res.end(JSON.stringify({ data: { code: 100, authority }, errors: [] }));
      }
      const found = body.authority ? issued.get(body.authority) : undefined;
      if (!found || found.amount !== body.amount) {
        return void res.end(JSON.stringify({ data: [], errors: { code: -50, message: 'amount mismatch' } }));
      }
      const first = found.paid;
      found.paid = false;
      res.end(JSON.stringify({ data: { code: first ? 100 : 101, ref_id: 987654 }, errors: [] }));
    });
  });
  return {
    server,
    calls,
    issued,
    failNextRequest: () => (failRequest = true),
    heal: () => (failRequest = false),
  };
}

describe('Zarinpal hosted payments', { concurrency: 1, timeout: 180_000 }, () => {
  let app: Booted;
  const fake = fakeZarinpal();

  before(async () => {
    await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
    app = await bootApp({
      PAYMENT_GATEWAY: 'sandbox',
      PAYMENT_GATEWAYS: 'sandbox,zarinpal',
      ZARINPAL_MERCHANT_ID: 'merchant-1234',
      ZARINPAL_BASE_URL: base,
      PUBLIC_API_URL: 'https://api.example.test',
    });
  });

  after(async () => {
    fake.server.close();
    await app?.stop();
  });

  const api = () => request(app.api.getHttpServer());

  async function wallet(auth: { Authorization: string }) {
    return (await api().get('/v1/me/wallet').set(auth)).body as { cashToman: number };
  }

  it('lists the gateway and returns the StartPay redirect with our callback', async () => {
    const names = (await api().get('/v1/payments/gateways')).body as Array<{ name: string }>;
    assert.deepEqual(names.map((g) => g.name).sort(), ['sandbox', 'zarinpal']);

    const auth = await app.login('09125550001');
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'zarinpal' });
    assert.equal(started.status, 201);
    assert.equal(started.body.gateway, 'zarinpal');
    assert.match(started.body.redirectUrl, /\/pg\/StartPay\/A\d+$/);
    assert.equal(started.body.status, 'pending');
    assert.ok(fake.calls.some((c) => c.startsWith('/pg/v4/payment/request.json merchant-1234')));
    const row = (await app.pool.query('select authority, amount_rial from payments where id = $1', [started.body.paymentId])).rows[0];
    assert.match(row.authority, /^A\d+$/);
    assert.equal(Number(row.amount_rial), started.body.amountToman * 10);
  });

  let pkg = '';
  before(async () => {
    pkg = (await app.pool.query(`select code from topup_packages where active order by amount_toman limit 1`)).rows[0].code;
  });

  it('credits exactly once after verify, and a replayed callback does not double-credit', async () => {
    const auth = await app.login('09125550002');
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'zarinpal' });
    const authority = (await app.pool.query('select authority from payments where id = $1', [started.body.paymentId])).rows[0].authority as string;
    const before = (await wallet(auth)).cashToman;

    const first = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Authority: authority, Status: 'OK' });
    assert.equal(first.status, 200);
    assert.match(first.text, /پرداخت موفق بود/);
    assert.equal((await wallet(auth)).cashToman, before + started.body.amountToman);

    const replay = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Authority: authority, Status: 'OK' });
    assert.match(replay.text, /پرداخت موفق بود/);
    assert.equal((await wallet(auth)).cashToman, before + started.body.amountToman);

    const status = await api().get(`/v1/me/topups/${started.body.paymentId}`).set(auth);
    assert.equal(status.body.status, 'credited');
    const ledger = await app.pool.query(`select count(*)::int as n from wallet_ledger where reference_id = $1`, [started.body.paymentId]);
    assert.equal(ledger.rows[0].n, 1);
    const ref = (await app.pool.query('select ref_id from payments where id = $1', [started.body.paymentId])).rows[0].ref_id;
    assert.equal(ref, '987654');
  });

  it('rejects a callback with a wrong or missing authority and never credits', async () => {
    const auth = await app.login('09125550003');
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'zarinpal' });
    const before = (await wallet(auth)).cashToman;
    const forged = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Authority: 'A' + '9'.repeat(35), Status: 'OK' });
    assert.equal(forged.status, 404);
    const missing = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Status: 'OK' });
    assert.equal(missing.status, 404);
    assert.equal((await wallet(auth)).cashToman, before);
  });

  it('marks the payment failed when the person abandons the gateway', async () => {
    const auth = await app.login('09125550004');
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'zarinpal' });
    const authority = (await app.pool.query('select authority from payments where id = $1', [started.body.paymentId])).rows[0].authority as string;
    const before = (await wallet(auth)).cashToman;
    const result = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Authority: authority, Status: 'NOK' });
    assert.match(result.text, /پرداخت انجام نشد/);
    assert.equal((await wallet(auth)).cashToman, before);
    assert.equal((await api().get(`/v1/me/topups/${started.body.paymentId}`).set(auth)).body.status, 'failed');
    // A late "OK" for a closed payment cannot revive it.
    const late = await api().get('/v1/payments/callback/zarinpal').query({ paymentId: started.body.paymentId, Authority: authority, Status: 'OK' });
    assert.match(late.text, /پرداخت انجام نشد/);
    assert.equal((await wallet(auth)).cashToman, before);
  });

  it('fails the payment cleanly when the gateway refuses to start', async () => {
    const auth = await app.login('09125550005');
    fake.failNextRequest();
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'zarinpal' });
    fake.heal();
    assert.equal(started.status, 502);
    assert.equal(started.body.code, 'payment_unavailable');
    const failed = await app.pool.query(`select count(*)::int as n from payments p join users u on u.id = p.user_id where u.phone_e164 = '+989125550005' and p.status = 'failed'`);
    assert.equal(failed.rows[0].n, 1);
  });

  it('sandbox keeps working alongside and shape stays compatible', async () => {
    const auth = await app.login('09125550006');
    const started = await api().post('/v1/me/topups').set(auth).send({ packageCode: pkg, gateway: 'sandbox' });
    assert.equal(started.status, 201);
    assert.equal(started.body.gateway, 'sandbox');
    assert.equal(started.body.redirectUrl ?? null, null);
  });
});
