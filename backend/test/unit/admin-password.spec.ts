import assert from 'node:assert/strict';
import { it } from 'node:test';
import { hashPassword, verifyPassword } from '../../src/common/password.js';

it('hashes passwords with independent salts and rejects invalid passwords', () => {
  const password = 'a-long-admin-password';
  const hash = hashPassword(password);
  assert.notEqual(hash,hashPassword(password));
  assert.equal(verifyPassword(password,hash),true);
  assert.equal(verifyPassword('wrong-password',hash),false);
  assert.equal(verifyPassword(password,'invalid'),false);
  assert.equal(verifyPassword('a'.repeat(257),hash),false);
  assert.throws(()=>hashPassword('short'));
});
