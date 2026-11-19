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

test('React site, admin, doctor, onboarding and worker use PHP/MySQL without the legacy backend', { timeout: 240000 }, async () => {
  assert.ok(process.env.MYSQL_TEST_URL, 'Requires an explicit disposable MySQL URL');
  assert.match(new URL(process.env.MYSQL_TEST_URL).pathname, /_test/);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(root, '.tools/browser-tests/node_modules/playwright'));
  const secret = randomUUID() + '!Aa9';
  const env = { ...process.env, DATABASE_URL: process.env.MYSQL_TEST_URL, APP_ENV: 'testing', APP_ROLE: 'api',
    NODE_ENV: 'development', SMS_PROVIDER: 'console', OTP_FIXED_CODE: '123456', BROWSER_TEST_PASSWORD: secret, CACHE_STORE: 'file',
    ANALYTICS_DATABASE_URL: process.env.MYSQL_TEST_URL, ANALYTICS_WEBSITE_ID: randomUUID() };
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
    $roles['specialistId']=$id;
  }
}
$crypto=App\\Shared\\Domain\\LegacyCrypto::class;
foreach (['review','change'] as $kind) {
  $ids=[];
  foreach (['user','session','submission','order','request','version'] as $key) $ids[$key]=$crypto::uuid();
  $name=$kind==='review' ? 'بیمار بررسی مرورگر' : 'بیمار تغییر مرورگر';
  $db->table('users')->insert(['id'=>$ids['user'],'phone_e164'=>'+98913'.random_int(1000000,9999999),'role'=>'user','status'=>'active','display_name'=>$name]);
  $db->table('wallets')->insert(['user_id'=>$ids['user']]);
  $db->table('specialist_members')->insert(['user_id'=>$ids['user'],'specialist_id'=>$roles['specialistId']]);
  $db->statement('insert into sessions(id,user_id,created_at,absolute_expires_at) values(?,?,current_timestamp(6),date_add(current_timestamp(6),interval 30 day))',[$ids['session'],$ids['user']]);
  $ids['token']=$crypto::sign(['sub'=>$ids['user'],'sid'=>$ids['session'],'role'=>'user','iat'=>time(),'exp'=>time()+3600],config('identity.jwt_secret'));
  $db->table('questionnaire_submissions')->insert(['id'=>$ids['submission'],'user_id'=>$ids['user'],'schema_version'=>1,'answers'=>'{}','risk_flags'=>'[]']);
  $db->table('orders')->insert(['id'=>$ids['order'],'user_id'=>$ids['user'],'service_code'=>'new_plan','price_toman'=>100,'cash_toman'=>100,'promo_toman'=>0,'status'=>'paid','idempotency_key'=>$crypto::uuid()]);
  $db->table('plan_requests')->insert(['id'=>$ids['request'],'user_id'=>$ids['user'],'order_id'=>$ids['order'],'kind'=>'new_plan','status'=>'in_review','submission_id'=>$ids['submission'],'price_toman'=>100,'assigned_specialist_id'=>$roles['specialistId']]);
  $db->table('plan_versions')->insert(['id'=>$ids['version'],'request_id'=>$ids['request'],'version_number'=>1,'status'=>'draft']);
  $db->table('plan_version_context')->insert(['version_id'=>$ids['version'],'questionnaire_schema_version'=>1,'questionnaire_snapshot'=>'{}']);
  $body=json_decode(file_get_contents('tests/Fixtures/node-plans.json'),true)[4]['input'];
  $editor=app(App\\Modules\\Plans\\Application\\PlanEditor::class);
  $editor->replace($roles['specialistId'],'specialist',$ids['request'],1,json_decode(json_encode($body)));
  if ($kind==='change') {
    $editor->publish($roles['specialistId'],'specialist',$ids['request'],2);
    $change=app(App\\Modules\\Plans\\Application\\PlanChanges::class)->submit($ids['user'],['commandId'=>$crypto::uuid(),'versionId'=>$ids['version'],'reasonIds'=>['schedule'],'explanation'=>'زمان وعده را تغییر دهید','targets'=>[['dayIndex'=>0,'mealUid'=>$body['days'][0]['meals'][0]['mealUid']]]]);
    $ids['changeId']=$change['id'];
  }
  $roles[$kind]=$ids;
}
echo json_encode($roles);
`;
  const fixture = JSON.parse((await run(php, ['-r', seed], { cwd, env, windowsHide: true })).stdout);
  const children = [];
  let browser;
  let page;
  const failedApi = [];
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
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', async response => {
      if (new URL(response.url()).pathname.startsWith('/v1/') && response.status() >= 400) {
        const body = await response.json().catch(() => ({}));
        failedApi.push(response.status() + ' ' + new URL(response.url()).pathname + ' ' + (body.code ?? '') + ' ' + (body.messageFa ?? body.detail ?? ''));
      }
    });
    async function checkSections(panel) {
      const { readFile } = require('node:fs/promises');
      const source = await readFile(path.join(root, 'frontend/src/features', panel, 'nav.ts'), 'utf8');
      const sections = [...source.matchAll(/\{ id: '([^']+)', title: '([^']+)'/g)];
      assert.ok(sections.length >= (panel === 'admin' ? 25 : 7));
      for (const [, id, title] of sections) {
        await page.locator('#nav').getByRole('link', { name: title, exact: true }).click();
        await page.waitForURL(web + '/' + panel + '/' + id);
        await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
        await page.waitForLoadState('networkidle');
        assert.ok((await page.locator('#content').innerText()).trim(), panel + '/' + id + ' has no content');
        assert.equal(await page.getByRole('alert').count(), 0, panel + '/' + id + ': ' + await page.getByRole('alert').allTextContents());
        assert.deepEqual(failedApi, [], panel + '/' + id + ' API failures');
        assert.deepEqual(errors, [], panel + '/' + id + ' JavaScript failures');
      }
      console.log('PASS: ' + sections.length + ' live ' + panel + ' sections, API responses and JavaScript errors');
    }
    async function checkResponsive(panel) {
      const { mkdir } = require('node:fs/promises');
      const directory = path.join(root, '.tools/panel-audit');
      await mkdir(directory, { recursive: true });
      await page.goto(web + '/' + panel + '/dashboard');
      await page.waitForLoadState('networkidle');
      for (const width of [1440, 768, 430]) {
        await page.setViewportSize({ width, height: 1000 });
        if (width < 760) {
          await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().left >= innerWidth - 1);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), panel + ' overflows at ' + width);
        await page.screenshot({ path: path.join(directory, panel + '-' + width + '.png'), fullPage: true });
      }
      await page.getByRole('button', { name: 'باز کردن منو', exact: true }).click();
      await page.getByRole('button', { name: 'بستن منو', exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto(web + '/articles');
    await page.getByRole('link', { name: new RegExp(article.title) }).first().click();
    await page.getByRole('heading', { name: 'اتصال مستقل تأیید شد', exact: true }).waitFor();
    await page.goto(web + '/admin/login');
    await page.getByLabel('نام کاربری', { exact: true }).fill(fixture.username);
    await page.getByLabel('رمز عبور', { exact: true }).fill(secret);
    await page.getByRole('button', { name: 'ورود به پنل', exact: true }).click();
    await page.getByRole('heading', { name: 'داشبورد', exact: true }).waitFor();
    failedApi.length = 0;
    if (!process.env.PANEL_SKIP_NAVIGATION) {
      await checkSections('admin');
      await checkResponsive('admin');
    }
    await page.goto(web + '/admin/specialists');
    const doctorRow = page.getByRole('row').filter({ hasText: 'پزشک مستقل' });
    await doctorRow.getByRole('button', { name: 'ویرایش', exact: true }).click();
    const specialistDialog = page.getByRole('dialog');
    await specialistDialog.getByText('بیمار بررسی مرورگر', { exact: true }).waitFor();
    await specialistDialog.getByLabel('ظرفیت', { exact: true }).fill('21');
    await specialistDialog.getByRole('button', { name: 'ذخیره پزشک', exact: true }).click();
    await specialistDialog.waitFor({ state: 'hidden' });
    await page.reload();
    await doctorRow.getByRole('button', { name: 'ویرایش', exact: true }).click();
    assert.equal(await specialistDialog.getByLabel('ظرفیت', { exact: true }).inputValue(), '21');
    await specialistDialog.getByRole('button', { name: 'بستن', exact: true }).click();
    await page.getByRole('button', { name: 'افزودن', exact: true }).click();
    await specialistDialog.getByLabel('نام', { exact: true }).fill('پزشک');
    await specialistDialog.getByLabel('نام خانوادگی', { exact: true }).fill('جدید آزمایش');
    await specialistDialog.getByLabel('شماره تلفن').fill('0914' + String(Math.floor(Math.random() * 9000000) + 1000000));
    await specialistDialog.getByRole('button', { name: 'ایجاد حساب پزشک', exact: true }).click();
    await specialistDialog.getByText('حساب پزشک ایجاد شد. می‌توانید زیرمجموعه‌ها را اضافه کنید.', { exact: true }).waitFor();
    await specialistDialog.getByRole('button', { name: 'پایان', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'پزشک جدید آزمایش' }).waitFor();
    await page.goto(web + '/admin/subscription-prices');
    await page.locator('select[name="planId"]').selectOption('weekly');
    await page.getByLabel('مبلغ جدید (تومان)', { exact: true }).fill('۱۲۳۴۵۶');
    await page.getByRole('button', { name: 'ذخیره تعرفه', exact: true }).click();
    await page.getByText('تعرفهٔ اشتراک ذخیره شد و برای خرید بعدی اعمال می‌شود.', { exact: true }).waitFor();
    assert.equal((await api('/v1/admin/subscription-prices', 'GET', undefined, token)).plans.find(plan => plan.id === 'weekly').priceToman, 123456);
    await page.goto(web + '/admin/coach-quotas');
    const quota = page.locator('form').filter({ has: page.getByRole('heading', { name: 'شروع ۱۵ روزه', exact: true }) });
    await quota.getByLabel('سقف روزانه', { exact: true }).fill('9');
    await quota.getByRole('button', { name: 'ذخیره', exact: true }).click();
    await page.getByText('سقف پیام مربی ذخیره شد.', { exact: true }).waitFor();
    await page.reload();
    await quota.getByLabel('سقف روزانه', { exact: true }).waitFor();
    assert.equal(await quota.getByLabel('سقف روزانه', { exact: true }).inputValue(), '9');
    await page.goto(web + '/admin/campaign-links');
    await page.getByRole('button', { name: 'ساخت لینک جدید', exact: true }).click();
    await page.getByLabel('نام لینک', { exact: true }).fill('کمپین تست مرورگر');
    await page.getByLabel('پسوند دلخواه لینک', { exact: true }).fill('browser-' + randomUUID());
    await page.getByRole('button', { name: 'ساخت لینک', exact: true }).click();
    await page.getByText('لینک ساخته شد؛ می‌توانید آن را کپی کنید', { exact: true }).waitFor();
    const campaignRow = page.getByRole('row').filter({ hasText: 'کمپین تست مرورگر' });
    await campaignRow.getByRole('button', { name: 'غیرفعال کردن', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تأیید', exact: true }).click();
    await page.getByText('وضعیت لینک تغییر کرد', { exact: true }).waitFor();
    await page.reload();
    await campaignRow.getByRole('button', { name: 'فعال کردن', exact: true }).waitFor();
    await campaignRow.getByRole('button', { name: 'حذف', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'حذف لینک', exact: true }).click();
    await page.getByText('لینک حذف شد', { exact: true }).waitFor();
    assert.equal(await campaignRow.count(), 0);
    await page.goto(web + '/admin/articles');
    await page.getByRole('button', { name: 'افزودن مقاله', exact: true }).click();
    const articleDialog = page.getByRole('dialog');
    const uiSlug = 'ui-' + randomUUID();
    await articleDialog.getByLabel('شناسهٔ آدرس').fill(uiSlug);
    await articleDialog.getByLabel('عنوان مقاله', { exact: true }).fill('مقاله تست رابط');
    await articleDialog.getByLabel('دسته‌بندی', { exact: true }).fill('تغذیه');
    await articleDialog.getByLabel('خلاصه').fill('خلاصه تست انتشار از رابط مدیریت');
    await articleDialog.getByLabel('تیتر بخش', { exact: true }).fill('تیتر تست رابط');
    await articleDialog.getByLabel('متن بخش', { exact: true }).fill('متن تست انتشار از رابط مدیریت');
    await articleDialog.getByRole('button', { name: 'ذخیره پیش‌نویس', exact: true }).click();
    await page.getByText('پیش‌نویس مقاله ذخیره شد.', { exact: true }).waitFor();
    const uiArticleRow = page.getByRole('row').filter({ hasText: 'مقاله تست رابط' });
    await uiArticleRow.getByRole('button', { name: 'انتشار', exact: true }).click();
    await articleDialog.getByRole('button', { name: 'انتشار مقاله', exact: true }).click();
    await page.getByText('مقاله منتشر شد.', { exact: true }).waitFor();
    assert.equal((await api('/v1/public/articles/' + uiSlug)).title, 'مقاله تست رابط');
    await uiArticleRow.getByRole('button', { name: 'ویرایش', exact: true }).click();
    await articleDialog.getByLabel('خلاصه').fill('خلاصه اصلاح‌شده از رابط مدیریت');
    await articleDialog.getByRole('button', { name: 'ذخیره تغییرات مقالهٔ منتشرشده', exact: true }).click();
    await page.getByText('تغییرات مقاله ذخیره شد.', { exact: true }).waitFor();
    assert.equal((await api('/v1/public/articles/' + uiSlug)).intro, 'خلاصه اصلاح‌شده از رابط مدیریت');
    await uiArticleRow.getByRole('button', { name: 'لغو انتشار', exact: true }).click();
    await articleDialog.getByRole('button', { name: 'لغو انتشار', exact: true }).click();
    await page.getByText('مقاله به پیش‌نویس برگشت.', { exact: true }).waitFor();
    assert.equal((await fetch(base + '/v1/public/articles/' + uiSlug)).status, 404);
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
    failedApi.length = 0;
    if (!process.env.PANEL_SKIP_NAVIGATION) {
      await checkSections('doctor');
      await checkResponsive('doctor');
    }
    await page.goto(web + '/doctor/profile');
    await page.getByRole('heading', { name: 'پزشک مستقل', exact: true }).waitFor();
    await page.getByLabel('تخصص', { exact: true }).fill('تخصص ذخیره‌شده در تست');
    await page.getByRole('button', { name: 'ذخیرهٔ پروفایل', exact: true }).click();
    await page.getByText('پروفایل ذخیره شد.', { exact: true }).waitFor();
    await page.reload();
    await page.getByLabel('تخصص', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('تخصص', { exact: true }).inputValue(), 'تخصص ذخیره‌شده در تست');
    await page.goto(web + '/doctor/patients');
    await page.getByRole('button', { name: 'مشاهدهٔ اطلاعات بیمار بررسی مرورگر', exact: true }).click();
    await page.getByRole('dialog').getByRole('heading', { name: 'پاسخ‌های پرسش‌نامهٔ آنبوردینگ', exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'بستن', exact: true }).click();
    await page.goto(web + '/doctor/reports');
    await page.getByRole('button', { name: 'مشاهدهٔ تقویم فعالیت بیمار بررسی مرورگر', exact: true }).click();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.goto(web + '/doctor/dashboard');
    const reviewRow = page.getByRole('row').filter({ hasText: 'بیمار بررسی مرورگر' });
    await reviewRow.getByRole('button', { name: 'باز کردن پرونده و برنامه', exact: true }).click();
    await page.getByRole('heading', { name: 'بررسی برنامهٔ بیمار بررسی مرورگر', exact: true }).waitFor();
    await page.getByRole('button', { name: 'تأیید همهٔ گزینه‌ها', exact: true }).click();
    await page.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click();
    await page.getByText('تغییرات ذخیره شد.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'انتشار برای کاربر', exact: true }).click();
    await page.getByText('برنامه منتشر شد و برای کاربر فعال شد.', { exact: true }).waitFor();
    assert.equal((await api('/v1/me/plan', 'GET', undefined, fixture.review.token)).versionId, fixture.review.version);
    await page.goto(web + '/doctor/changes');
    await page.getByRole('row').filter({ hasText: 'بیمار تغییر مرورگر' }).getByRole('button', { name: 'جزئیات درخواست', exact: true }).click();
    const changeDialog = page.getByRole('dialog');
    await changeDialog.getByText('توضیح: زمان وعده را تغییر دهید', { exact: true }).waitFor();
    await changeDialog.getByRole('button', { name: 'شروع بررسی', exact: true }).click();
    await changeDialog.getByLabel('یادداشت برای کاربر', { exact: true }).fill('زمان مناسب شما چیست؟');
    await changeDialog.getByRole('button', { name: 'سؤال از کاربر', exact: true }).click();
    await changeDialog.getByText('منتظر کاربر: زمان مناسب شما چیست؟', { exact: true }).waitFor();
    assert.equal(await changeDialog.getByRole('button', { name: 'ویرایش برنامه', exact: true }).isDisabled(), true);
    await api('/v1/me/plan-changes/' + fixture.change.changeId + '/replies', 'POST', { body: 'ساعت یک' }, fixture.change.token);
    await page.reload();
    await page.getByRole('button', { name: 'جزئیات درخواست', exact: true }).click();
    await changeDialog.getByText('پاسخ کاربر: ساعت یک', { exact: true }).waitFor();
    await changeDialog.getByRole('button', { name: 'شروع بررسی', exact: true }).click();
    await changeDialog.getByRole('button', { name: 'ویرایش برنامه', exact: true }).click();
    await page.getByRole('heading', { name: 'بررسی برنامهٔ بیمار تغییر مرورگر', exact: true }).waitFor();
    await page.getByRole('button', { name: 'تأیید همهٔ گزینه‌ها', exact: true }).click();
    await page.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click();
    await page.getByText('تغییرات ذخیره شد.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'انتشار برای کاربر', exact: true }).click();
    await page.getByText('برنامه منتشر شد و برای کاربر فعال شد.', { exact: true }).waitFor();
    assert.equal((await api('/v1/me/plan-changes/' + fixture.change.changeId, 'GET', undefined, fixture.change.token)).status, 'approved');
    assert.notEqual((await api('/v1/me/plan', 'GET', undefined, fixture.change.token)).versionId, fixture.change.version);
    const changedVersion = (await api('/v1/me/plan', 'GET', undefined, fixture.change.token)).versionId;
    const rejected = await api('/v1/me/plan-changes', 'POST', { commandId: randomUUID(), versionId: changedVersion, reasonIds: ['schedule'], explanation: 'درخواست دوم برای بررسی رد', targets: [{ dayIndex: 0 }] }, fixture.change.token);
    await page.goto(web + '/doctor/changes');
    await page.getByRole('button', { name: 'جزئیات درخواست', exact: true }).click();
    await changeDialog.getByRole('button', { name: 'شروع بررسی', exact: true }).click();
    await changeDialog.getByLabel('یادداشت برای کاربر', { exact: true }).fill('برنامه فعلی مناسب است');
    await changeDialog.getByRole('button', { name: 'رد درخواست', exact: true }).click();
    await changeDialog.getByText('دلیل رد: برنامه فعلی مناسب است', { exact: true }).waitFor();
    assert.equal((await api('/v1/me/plan-changes/' + rejected.id, 'GET', undefined, fixture.change.token)).status, 'rejected');
    assert.equal((await api('/v1/me/plan', 'GET', undefined, fixture.change.token)).versionId, changedVersion);
    await changeDialog.getByRole('button', { name: 'بستن', exact: true }).click();
    assert.deepEqual(failedApi, []);
    await page.route('**/v1/specialist/queue?bucket=awaiting_review', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ messageFa: 'خطای آزمایشی دریافت صف' }) }));
    await page.goto(web + '/doctor/dashboard');
    await page.getByText('خطای آزمایشی دریافت صف', { exact: true }).waitFor();
    await page.unroute('**/v1/specialist/queue?bucket=awaiting_review');
    await page.getByRole('button', { name: 'خروج از حساب', exact: true }).click();
    await page.getByLabel('شماره تلفن', { exact: true }).waitFor();
    await page.goto(web + '/doctor/patients');
    await page.getByLabel('شماره تلفن', { exact: true }).waitFor();
    assert.equal(await page.locator('#panel').count(), 0);
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
    await customer.goto(web + '/admin/users');
    await customer.getByLabel('نام کاربری', { exact: true }).waitFor();
    assert.equal(await customer.locator('#panel').count(), 0);
    await customer.goto(web + '/doctor/patients');
    await customer.getByLabel('شماره تلفن', { exact: true }).waitFor();
    assert.equal(await customer.locator('#panel').count(), 0);
    await run(php, ['artisan', 'sabzine:work', '--once'], { cwd, env: { ...env, APP_ROLE: 'worker' }, windowsHide: true, timeout: 30000 });
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error('API failures: ' + JSON.stringify(failedApi));
    if (page) {
      const { mkdir } = require('node:fs/promises');
      const directory = path.join(root, '.tools/panel-audit');
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {});
      console.error('Browser failure at ' + page.url() + '\n' + (await page.locator('body').innerText().catch(() => '')).slice(-4000));
    }
    throw error;
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
