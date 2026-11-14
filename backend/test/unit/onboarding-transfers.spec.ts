import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApplicationError } from '../../src/common/application-error.js';
import { OnboardingTransfers } from '../../src/onboarding/application/onboarding-transfers.js';
import type { TransferRecord, TransferRepository, TransferSession } from '../../src/onboarding/application/transfer-ports.js';

const id = '0193fa01-1000-7000-8000-000000000001';

function fixture() {
  const state = { confirmed: false, sms: 0, verifications: 0, starts: 0, trackId: null as string | null, status: '', audits: 0 };
  const session: TransferSession = {
    lockUser: async () => ({ phone: '+989120000001' }),
    isVerifiedSubmission: async () => true,
    reusable: async () => null,
    insert: async input => ({ ...input, amount_toman: input.amountToman } as unknown as TransferRecord),
    lockPayment: async () => ({ amountToman: 1290001, trackId: state.trackId, active: true, confirmed: state.confirmed }),
    attachGateway: async (_id, trackId) => { state.trackId = trackId; },
    confirmGateway: async () => {
      if (state.confirmed) return null;
      state.confirmed = true;
      return { phone: '+989120000001' };
    },
    lockBankReference: async () => {},
    hasBankReference: async () => false,
    confirmBank: async (_id, _reference, amountToman) => ({ amountToman, phone: '+989120000001' }),
    audit: async () => { state.audits++; },
  };
  const repository: TransferRepository = {
    transaction: run => run(session),
    status: async () => null,
    byGatewayTrack: async () => ({ id, amountToman: 1290001, confirmed: state.confirmed }),
    list: async () => [],
    setSmsStatus: async (_id, status) => { state.status = status; },
  };
  const service = new OnboardingTransfers(repository, {
    gateway: {
      start: async () => { state.starts++; return '12345'; },
      verify: async (_track, amount) => { state.verifications++; assert.equal(amount, 12900010); return true; },
      redirectUrl: track => 'https://gateway.test/' + track,
    },
    confirmation: { send: async () => { state.sms++; } },
    phoneHash: phone => 'hash:' + phone,
    uniqueAmount: base => base + 1,
    newId: () => id,
  });
  return { service, session, state };
}

test('a repeated gateway start reuses the existing payment', async () => {
  const { service, state } = fixture();
  const first = await service.startGateway('user', id);
  assert.deepEqual(await service.startGateway('user', id), first);
  assert.equal(state.starts, 1);
});

test('a replayed payment callback neither confirms nor sends SMS twice', async () => {
  const { service, state } = fixture();
  const first = await service.gatewayReturn('12345', '1');
  assert.deepEqual(await service.gatewayReturn('12345', '1'), first);
  assert.equal(state.verifications, 1);
  assert.equal(state.sms, 1);
  assert.equal(state.audits, 1);
  assert.equal(state.status, 'sent');
});

test('a cancelled callback does not verify or confirm payment', async () => {
  const { service, state } = fixture();
  assert.match((await service.gatewayReturn('12345', '0')).url, /gateway=cancelled$/);
  assert.equal(state.verifications, 0);
  assert.equal(state.confirmed, false);
  assert.equal(state.sms, 0);
});

test('an unverified submission cannot create a transfer', async () => {
  const { service, session } = fixture();
  session.isVerifiedSubmission = async () => false;
  session.insert = async () => { assert.fail('must not insert'); };
  await assert.rejects(service.create('user', { plan: 'weekly', submissionId: id }),
    error => error instanceof ApplicationError && error.code === 'forbidden');
});

test('a duplicate bank reference cannot confirm another transfer', async () => {
  const { service, session, state } = fixture();
  session.hasBankReference = async () => true;
  session.confirmBank = async () => { assert.fail('must not confirm'); };
  await assert.rejects(service.confirm('admin', id, { reference: 'bank-123', amountToman: 1290001 }),
    error => error instanceof ApplicationError && error.code === 'conflict');
  assert.equal(state.sms, 0);
});
