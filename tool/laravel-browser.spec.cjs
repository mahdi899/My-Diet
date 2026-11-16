const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
const php = process.env.PHP_BINARY || path.join(root, '.tools/php84/php.exe');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
});

test('React site, admin, doctor, onboarding and worker use PHP/MySQL without the legacy backend', { timeout: 120000 }, async () => {
  assert.ok(process.env.MYSQL_TEST_URL, 'Requires an explicit disposable MySQL URL');
  assert.match(new URL(process.env.MYSQL_TEST_URL).pathname, /_test/);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(root, '.tools/browser-tests/node_modules/playwright'));
  const secret = randomUUID() + '!Aa9';
  const env = { ...process.env, DATABASE_URL: process.env.MYSQL_TEST_URL, APP_ENV: 'testing', APP_ROLE: 'api',
    NODE_ENV: 'development', SMS_PROVIDER: 'console', OTP_FIXED_CODE: '123456', BROWSER_TEST_PASSWORD: secret, CACHE_STORE: 'file' };
  const cwd = path.join(root, 'backend-laravel');
  const seed = `
require 'vendor/autoload.php';
$app=require 'bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$db=app(Illuminate\\Database\\ConnectionInterface::class);
$roles=[];
foreach (['admin','specialist'] as $role) {
  $id=App\\Shared\\Domain\\LegacyCrypto::uuid();
  $phone='+98912'.random_int(1000000,9999999);
  $db->table('users')->insert(['id'=>$id,'phone_e164'=>$phone,'role'=>$role,'status'=>'active','display_name'=>'کاربر مرورگر']);
  $db->table('wallets')->insert(['user_id'=>$id]);
  if ($role==='admin') {
    $username='browser-'.$id;
    $db->table('admin_credentials')->insert(['user_id'=>$id,'username'=>$username,'password_hash'=>App\\Shared\\Domain\\LegacyCrypto::hashPassword(getenv('BROWSER_TEST_PASSWORD'))]);
    $roles['username']=$username;
  } else {
    $db->table('specialist_profiles')->insert(['user_id'=>$id,'display_name'=>'پزشک مستقل','active'=>1,'verification_status'=>'verified']);
    $roles['phone']=$phone;
  }
}
echo json_encode($roles);
`;
  const fixture = JSON.parse((await run(php, ['-r', seed], { cwd, env, windowsHide: true })).stdout);
  const children = [];
  let browser;
  async function start(binary, args, childEnv, directory, url) {
    const child = spawn(binary, args, { cwd: directory, env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let log = '';
    child.stdout.on('data', data => { log = (log + data).slice(-20000); });
    child.stderr.on('data', data => { log = (log + data).slice(-20000); });
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('Test server exited: ' + log);
      try { if ((await fetch(url)).ok) return; } catch {}
      await delay(100);
    }
    throw new Error('Test server not ready: ' + log);
  }
  try {
    const apiPort = await freePort();
    const base = 'http://127.0.0.1:' + apiPort;
    const allowed = [cwd, os.tmpdir()].join(path.delimiter);
    await start(php, ['-d', 'open_basedir=' + allowed, '-S', '127.0.0.1:' + apiPort, '-t', 'public', 'public/index.php'], env, cwd, base + '/health/ready');
    const api = async (route, method = 'GET', body, token) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.ok(response.ok, route + ': HTTP ' + response.status);
      return response.json();
    };
    const token = (await api('/v1/auth/admin/login', 'POST', { username: fixture.username, password: secret })).accessToken;
    const article = { slug: 'standalone-' + randomUUID(), title: 'مقاله اتصال مستقل', category: 'تست', image: 0, readingMinutes: 3,
      intro: 'خواندن از MySQL', sections: [{ heading: 'اتصال مستقل تأیید شد', body: 'این متن از PHP و MySQL دریافت شد.' }] };
    await api('/v1/admin/articles', 'POST', article, token);
    await api('/v1/admin/articles/' + article.slug + '/publish', 'POST', undefined, token);
    const port = await freePort();
    const web = 'http://127.0.0.1:' + port;
    await start(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port)],
      { ...env, SABZINE_API_TARGET: base }, path.join(root, 'frontend'), web);
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(web + '/articles');
    await page.getByRole('link', { name: new RegExp(article.title) }).click();
    await page.getByRole('heading', { name: 'اتصال مستقل تأیید شد', exact: true }).waitFor();
    await page.goto(web + '/admin/login');
    await page.getByLabel('نام کاربری', { exact: true }).fill(fixture.username);
    await page.getByLabel('رمز عبور', { exact: true }).fill(secret);
    await page.getByRole('button', { name: 'ورود به پنل', exact: true }).click();
    await page.getByRole('heading', { name: 'داشبورد', exact: true }).waitFor();
    const refresh = page.waitForResponse(r => r.url().endsWith('/v1/auth/refresh') && r.status() === 201);
    await page.goto(web + '/admin/foods'); await refresh;
    await page.getByRole('heading', { name: 'کاتالوگ غذا', exact: true }).waitFor();
    await page.getByRole('button', { name: 'خروج از حساب', exact: true }).click();
    await page.getByRole('heading', { name: 'خوش برگشتید', exact: true }).waitFor();
    await page.goto(web + '/doctor/login');
    await page.getByLabel('شماره تلفن', { exact: true }).fill(fixture.phone.replace(/^\+98/, '0'));
    await page.getByRole('button', { name: 'دریافت کد ورود', exact: true }).click();
    await page.getByLabel('کد ورود', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'ورود به پنل', exact: true }).click();
    await page.getByRole('heading', { name: 'برنامه‌های آماده بررسی', exact: true }).waitFor();
    await page.goto(web + '/doctor/profile');
    await page.getByText('پزشک مستقل', { exact: true }).waitFor();
    const customer = await browser.newPage({ viewport: { width: 430, height: 900 } });
    await customer.addInitScript(saved => sessionStorage.setItem('mydiet.quiz.progress', JSON.stringify(saved)),
      { goal: 'weight_loss', answersByNumber: { 1: 'کاربر مرورگر' }, focused: 0, unlocked: 0, planId: 'weekly', submissionId: randomUUID(), step: { stage: 'phone', index: 0 } });
    await customer.goto(web + '/onboarding');
    await customer.getByLabel('شماره همراهت', { exact: true }).fill('0912' + String(Math.floor(Math.random() * 9000000) + 1000000));
    await customer.getByRole('button', { name: 'دریافت کد تأیید', exact: true }).click();
    await customer.getByLabel('کد تأیید شش‌رقمی', { exact: true }).fill('123456');
    const transfer = customer.waitForResponse(r => r.url().endsWith('/v1/me/onboarding-transfers') && r.status() === 201);
    await customer.getByRole('button', { name: 'تأیید و ادامه به پرداخت', exact: true }).click(); await transfer;
    await customer.getByRole('button', { name: 'کارت‌به‌کارت', exact: true }).click();
    await customer.getByText('منتظر واریز و بررسی پشتیبانی', { exact: true }).waitFor();
    await run(php, ['artisan', 'sabzine:work', '--once'], { cwd, env: { ...env, APP_ROLE: 'worker' }, windowsHide: true, timeout: 30000 });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    for (const child of children.reverse()) {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = new Promise(resolve => child.once('exit', resolve));
        child.kill(); await closed;
      }
    }
  }
});
