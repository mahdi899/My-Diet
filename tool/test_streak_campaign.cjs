const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');
const sandbox = { structuredClone };
runInNewContext(readFileSync(resolve(__dirname, '../admin/streak-campaign.js'), 'utf8'), sandbox);
const { createRepository } = sandbox.SabzineStreak;

const repo = createRepository();
const login = repo.login('user', '2026-10-24');
assert.equal(login.consecutive, 0);
assert.equal(login.days.every(day => day.state !== 'qualified'), true);
assert.equal(repo.wallet('user'), 0);

const partial = repo.recordDay('user', '2026-10-24', false);
assert.equal(partial.days.find(day => day.date === '2026-10-24').state, 'pending_verification');
assert.equal(repo.claim('user', '2026-10-24').grants.length, 0);

for (let day = 0; day < 6; day += 1) repo.recordDay('user', `2026-10-${24 + day}`, true);
assert.equal(repo.claim('user', '2026-10-29').wallet, 0);
repo.recordDay('user', '2026-10-30', true);
const confirmed = repo.claim('user', '2026-10-30');
assert.equal(confirmed.claimState, 'confirmed');
assert.equal(confirmed.wallet, 200000);
assert.equal(confirmed.days.at(-1).state, 'rewarded');
const duplicate = repo.claim('user', '2026-10-30');
assert.equal(duplicate.claimState, 'duplicate');
assert.equal(duplicate.grants.length, 0);
assert.equal(repo.wallet('user'), 200000);
assert.equal(duplicate.ledger.length, 1);

const reset = createRepository();
reset.recordDay('gap', '2026-10-24', true);
for (let day = 26; day <= 30; day += 1) reset.recordDay('gap', `2026-10-${day}`, true);
const broken = reset.claim('gap', '2026-10-30');
assert.equal(broken.consecutive, 5);
assert.equal(broken.wallet, 0);
assert.equal(broken.days.find(day => day.date === '2026-10-25').state, 'missed');

const locked = createRepository();
locked.recordDay('mid', '2026-10-24', true);
locked.save({
  consecutiveDays: 7,
  milestones: [{ day: 7, amountToman: 50000 }],
  startsOn: '2026-10-24',
  effectiveOn: '2026-10-24',
  repeat: 'cycle',
});
for (let day = 25; day <= 30; day += 1) locked.recordDay('mid', `2026-10-${day}`, true);
const kept = locked.claim('mid', '2026-10-30');
assert.equal(kept.version, 1);
assert.equal(kept.wallet, 200000);

const fresh = createRepository();
fresh.save({
  consecutiveDays: 7,
  milestones: [{ day: 3, amountToman: 10000 }, { day: 7, amountToman: 50000 }],
  startsOn: '2026-10-24',
  effectiveOn: '2026-10-24',
  repeat: 'cycle',
});
for (let day = 24; day <= 26; day += 1) fresh.recordDay('new', `2026-10-${day}`, true);
const third = fresh.claim('new', '2026-10-26');
assert.equal(third.wallet, 10000);
for (let day = 27; day <= 30; day += 1) fresh.recordDay('new', `2026-10-${day}`, true);
const seventh = fresh.claim('new', '2026-10-30');
assert.equal(seventh.wallet, 60000);
assert.equal(fresh.claim('new', '2026-10-30').claimState, 'duplicate');
assert.equal(fresh.wallet('new'), 60000);
console.log('streak campaign demo passed');
