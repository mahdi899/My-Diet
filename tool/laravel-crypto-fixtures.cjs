/* Test vectors from the actual Node implementation; all keys/data here are synthetic. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { scryptSync } = require('node:crypto');
(async () => {
  const root = path.resolve(__dirname, '..');
  const load = name => import(pathToFileURL(path.join(root, 'backend/dist/common', name + '.js')));
  const [fields, jwt, totp] = await Promise.all([load('field-crypto'), load('jwt'), load('totp')]);
  const key = 'synthetic-migration-key-keep-out-of-production';
  const plain = JSON.stringify({ name: 'آزمایش مهاجرت', note: 'test/🙂', weight: 71.5 });
  const claims = { sub: '01934300-0000-7000-8000-000000000001', sid: '01934300-0000-7000-8000-000000000002', role: 'admin', iat: 1735689600, exp: 4102444800 };
  const salt = '0123456789abcdef0123456789abcdef';
  const secret = Buffer.from('12345678901234567890');
  const data = {
    key, plain, encrypted: fields.encryptText(plain, key), claims, jwt: jwt.signAccessToken(claims, key),
    passwords: ['migration-test', 'رمز آزمایشی 🙂'].map(password => ({ password, encoded: salt + ':' + scryptSync(password, salt, 64).toString('hex') })),
    totp: { secret: secret.toString('base64'), base32: totp.base32Encode(secret), at: 59000, code: totp.totpCode(secret, 59000) },
  };
  const directory = path.join(root, 'backend-laravel/tests/Fixtures');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'node-crypto.json'), JSON.stringify(data, null, 2) + '\n');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
