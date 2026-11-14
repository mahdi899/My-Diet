import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { OnboardingTransfers } from '../../src/onboarding/application/onboarding-transfers.js';
import { PostgresTransferRepository } from '../../src/onboarding/infrastructure/postgres-transfer-repository.js';
import { bootApp, type Booted } from '../helpers/boot.js';

describe('onboarding transfer transactions', { concurrency: 1, timeout: 120_000 }, () => {
  let app: Booted;
  let transfers: OnboardingTransfers;
  let userId: string;
  const submissionId = randomUUID();
  let unique = 0;
  let starts = 0;
  let sms = 0;

  before(async () => {
    app = await bootApp();
    await app.login('09120000531');
    userId = (await app.pool.query<{ id: string }>("select id from users where phone_e164='+989120000531'")).rows[0]!.id;
    await app.pool.query(`insert into demo_lead_submissions
      (id,phone_hash,phone_encrypted,goal,answers_encrypted,phone_verified)
      values($1,'verified-hash','test','weight_loss','test',true)`, [submissionId]);
    transfers = new OnboardingTransfers(new PostgresTransferRepository(app.pool), {
      gateway: {
        start: async () => { starts++; return String(10000 + starts); },
        verify: async () => true,
        redirectUrl: track => 'https://gateway.test/' + track,
      },
      confirmation: { send: async () => { sms++; } },
      phoneHash: () => 'verified-hash', newId: randomUUID, uniqueAmount: base => base + (++unique),
    });
  });
  after(async () => { await app?.stop(); });

  it('serializes concurrent creation and payment starts on the same order', async () => {
    const orders = await Promise.all(Array.from({ length: 4 }, () => transfers.create(userId, { plan: 'weekly', submissionId })));
    assert.equal(new Set(orders.map(order => order.id)).size, 1);
    const redirects = await Promise.all(orders.map(order => transfers.startGateway(userId, order.id)));
    assert.equal(new Set(redirects.map(result => result.url)).size, 1);
    assert.equal(starts, 1);
    const status = await transfers.status(userId, orders[0]!.id);
    assert.equal(status.gateway_started, true);
  });

  it('confirms concurrent callbacks once, with one audit record and one SMS', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => transfers.gatewayReturn('10001', '1')));
    assert.ok(results.every(result => !result.url.includes('pending')));
    assert.equal(sms, 1);
    const audits = await app.pool.query("select 1 from audit_logs where action='onboarding_zibal_confirmed'");
    assert.equal(audits.rowCount, 1);
    await transfers.gatewayReturn('10001', '1');
    assert.equal(sms, 1);
  });

  it('rolls back a duplicate bank reference without confirming a second order', async () => {
    const first = await transfers.create(userId, { plan: 'monthly', submissionId });
    const second = await transfers.create(userId, { plan: 'quarterly', submissionId });
    await transfers.confirm(userId, first.id, { reference: 'bank-12345', amountToman: first.amount_toman });
    await assert.rejects(transfers.confirm(userId, second.id, { reference: 'bank-12345', amountToman: second.amount_toman }));
    assert.equal((await transfers.status(userId, second.id)).confirmed_at, null);
    assert.equal(sms, 2);
  });

  it('does not expose an order to another user', async () => {
    const order = await transfers.create(userId, { plan: 'quarterly', submissionId });
    await assert.rejects(transfers.status(randomUUID(), order.id));
    await assert.rejects(transfers.startGateway(randomUUID(), order.id));
    assert.equal(starts, 1);
  });
});
