import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { bootApp, type Booted } from '../helpers/boot.js';
import { hashPassword } from '../../src/common/password.js';
import { decryptText, encryptText } from '../../src/common/field-crypto.js';
import { verifyAccessToken } from '../../src/common/jwt.js';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const php = process.env.PHP_BINARY!;
const mysqlUrl = process.env.MYSQL_TEST_URL!;
const secrets = { JWT_SECRET: 'test-only-cross-runtime-jwt-secret', OTP_PEPPER: 'test-only-cross-runtime-otp-pepper', FIELD_KEY: 'test-only-cross-runtime-field-key' };
const password = 'Migration-only-password!';
const adminId = randomUUID();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
}

describe('Node/PostgreSQL to Laravel/MySQL compatibility', { concurrency: 1, timeout: 180_000, skip: !mysqlUrl || !php }, () => {
  let source: Booted;
  let nodeBase: string;
  let phpBase: string;
  let secondBase: string;
  let nodeAccess: string;
  let nodeRefresh: string;
  let customerAccess: string;
  let customerId: string;
  const servers: ChildProcess[] = [];
  let env: NodeJS.ProcessEnv;
  const options = () => ({ cwd: path.join(root, 'backend-laravel'), env, windowsHide: true, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  async function api(base: string, route: string, method = 'GET', body?: unknown, token?: string, headers: Record<string, string> = {}) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as Record<string, unknown>, headers: response.headers };
  }
  async function startPhp(): Promise<string> {
    const port = await freePort();
    const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'public', 'public/index.php'], { ...options(), stdio: ['ignore', 'pipe', 'pipe'] });
    servers.push(server);
    let logs = '';
    server.stderr?.on('data', chunk => { logs += String(chunk); });
    server.stdout?.on('data', () => undefined);
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('PHP test server exited: ' + logs);
      try { if ((await api(base, '/health/ready')).status === 200) return base; } catch { /* Not listening yet. */ }
      await delay(100);
    }
    throw new Error('PHP test server failed readiness: ' + logs);
  }

  before(async () => {
    source = await bootApp(secrets);
    await source.api.listen(0, '127.0.0.1');
    nodeBase = `http://127.0.0.1:${(source.api.getHttpServer().address() as net.AddressInfo).port}`;
    await source.pool.query("insert into users(id,phone_e164,role,status,display_name) values($1,'+989120008888','admin','active','مدیر آزمایش')", [adminId]);
    await source.pool.query('insert into admin_credentials(user_id,username,password_hash) values($1,$2,$3)', [adminId, 'migration-admin', hashPassword(password)]);
    const login = await api(nodeBase, '/v1/auth/admin/login', 'POST', { username: 'migration-admin', password });
    assert.equal(login.status, 201);
    nodeAccess = login.body.accessToken as string;
    const parentRotation = await api(nodeBase, '/v1/auth/refresh', 'POST', { refreshToken: login.body.refreshToken });
    assert.equal(parentRotation.status, 201);
    nodeRefresh = parentRotation.body.refreshToken as string;
    const customer = await source.login('09120000777');
    customerAccess = customer.Authorization.slice(7);
    customerId = verifyAccessToken(customerAccess, secrets.JWT_SECRET).sub;
    await source.pool.query("update users set status='active' where id=$1", [customerId]);
    const details = { name: 'کاربر مهاجرت', contactPhone: '+989120000777', age: 32, height: 174, weight: 70.5, photo: null };
    await source.pool.query('insert into user_personal_details(user_id,details_encrypted) values($1,$2)', [customerId, encryptText(JSON.stringify(details), secrets.FIELD_KEY)]);
    await source.pool.query('update wallets set cash_toman=9007199254740993,promo_toman=175000 where user_id=$1', [customerId]);
    const specialistId = randomUUID();
    await source.pool.query("insert into users(id,phone_e164,role,status) values($1,'+989120005555','specialist','active')", [specialistId]);
    await source.pool.query("insert into specialist_profiles(user_id,display_name,active,rating,birth_date) values($1,'متخصص آزمایش',true,4.50,'1990-01-01')", [specialistId]);
    for (let i = 0; i < 201; i++) {
      const conversationId = randomUUID();
      await source.pool.query("insert into conversations(id,kind,user_id) values($1,'support',$2)", [conversationId, customerId]);
      await source.pool.query('insert into conversation_participants(conversation_id,user_id) values($1,$2)', [conversationId, customerId]);
    }
    env = { ...process.env, ...secrets, DATABASE_URL: mysqlUrl, MYSQL_TEST_URL: mysqlUrl, POSTGRES_SOURCE_URL: source.databaseUrl,
      DB_CONNECTION: 'mysql', APP_ENV: 'testing', NODE_ENV: 'development', SMS_PROVIDER: 'console', CACHE_STORE: 'file', SESSION_DRIVER: 'array' };
    const preflight = JSON.parse((await run(php, ['artisan', 'migration:preflight'], options())).stdout);
    assert.ok(preflight.sourceTableCount > 13);
    assert.deepEqual(preflight.missingTargetTables, []);
    assert.equal(preflight.readyForFullDataMigration, false);
    const preview = JSON.parse((await run(php, ['artisan', 'migration:import-identity'], options())).stdout);
    assert.equal(preview.executed, false);
    await source.pool.query('update admin_credentials set username=$1 where user_id=$2', ['x'.repeat(300), adminId]);
    try {
      await assert.rejects(run(php, ['artisan', 'migration:import-identity', '--execute'], options()),
        (error: unknown) => String((error as { stdout?: string }).stdout).includes('Source text exceeds target capacity'));
    } finally {
      await source.pool.query('update admin_credentials set username=$1 where user_id=$2', ['migration-admin', adminId]);
    }
    const retriedPreview = JSON.parse((await run(php, ['artisan', 'migration:import-identity'], options())).stdout);
    assert.deepEqual(retriedPreview, preview, 'Failed partial copy must roll back the entire MySQL destination');
    const imported = JSON.parse((await run(php, ['artisan', 'migration:import-identity', '--execute'], options())).stdout);
    assert.equal(imported.executed, true);
    assert.equal(imported.tables.users.rows, 3);
    assert.equal(imported.tables.conversation_participants.rows, 202);
    assert.deepEqual(imported.tables, preview.tables);
    phpBase = await startPhp(); secondBase = await startPhp();
  });

  after(async () => {
    await Promise.all(servers.map(async server => {
      if (server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    }));
    await source?.stop();
  });

  it('accepts existing Node sessions and returns the same profiles and encrypted personal details', async () => {
    for (const [route, token] of [['/v1/me', nodeAccess], ['/v1/me', customerAccess], ['/v1/me/personal-details', customerAccess]]) {
      const [node, laravel] = await Promise.all([api(nodeBase, route!, 'GET', undefined, token), api(phpBase, route!, 'GET', undefined, token)]);
      assert.equal(laravel.status, node.status); assert.deepEqual(laravel.body, node.body);
    }
  });

  it('keeps HTTP validation, authorization, phone errors and failed login messages identical', async () => {
    const cases: [string, string, unknown, string?][] = [
      ['/health/live', 'GET', undefined], ['/v1/me', 'GET', undefined],
      ['/v1/auth/otp/request', 'POST', { phone: '123' }], ['/v1/auth/otp/request', 'POST', { phone: '09120000001', extra: true }],
      ['/v1/auth/otp/request', 'POST', { phone: '+12125551234' }], ['/v1/auth/otp/request', 'POST', []],
      ['/v1/auth/otp/request', 'POST', { phone: '09120000001', existingAccountOnly: true }],
      ['/v1/auth/admin/login', 'POST', { username: 'migration-admin', password: 'wrong' }],
      ['/v1/auth/specialist/login', 'POST', { username: 'nobody', password: 2 }],
      ['/v1/auth/totp', 'POST', { totpToken: 'nonexistent', code: '123456' }],
      ['/v1/auth/otp/latest?phone=09120000001', 'GET', undefined],
      ['/v1/me/totp', 'GET', undefined, customerAccess],
      ['/v1/auth/sessions/not-a-uuid', 'DELETE', undefined, customerAccess],
    ];
    for (const [route, method, body, token] of cases) {
      const node = await api(nodeBase, route, method, body, token);
      const laravel = await api(phpBase, route, method, body, token);
      assert.equal(laravel.status, node.status, route); assert.deepEqual(laravel.body, node.body, route);
    }
  });

  it('verifies Node password hashes and emits access JWTs that Node can verify', async () => {
    const response = await api(phpBase, '/v1/auth/admin/login', 'POST', { username: 'migration-admin', password });
    assert.equal(response.status, 201);
    assert.equal(verifyAccessToken(response.body.accessToken as string, secrets.JWT_SECRET).sub, adminId);
  });

  it('preserves empty plan responses and validates request and date filters over HTTP', async () => {
    for (const route of ['/v1/me/plan','/v1/me/request']) {
      const [node,laravel] = await Promise.all([nodeBase,phpBase].map(base => fetch(base+route,{headers:{Authorization:'Bearer '+customerAccess}})));
      assert.equal(laravel!.status,node!.status);
      assert.equal(await laravel!.text(),await node!.text(),route);
    }
    for (const route of ['/v1/me/requests','/v1/me/plan/week?weekStart=2026-11-15','/v1/me/plan/day/2026-02-30','/v1/me/info-questions?status=invalid']) {
      const a = await api(nodeBase,route,'GET',undefined,customerAccess);
      const b = await api(phpBase,route,'GET',undefined,customerAccess);
      assert.equal(b.status,a.status); assert.deepEqual(b.body,a.body);
    }
  });

  it('preserves the web refresh cookie and requires its client header over real HTTP', async () => {
    const login = await api(phpBase, '/v1/auth/admin/login', 'POST', { username: 'migration-admin', password }, undefined, { 'x-sabzine-client': 'web' });
    assert.equal(login.status, 201);
    assert.equal(login.body.refreshToken, undefined);
    const cookie = login.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i); assert.match(cookie, /Path=\/v1\/auth/i);
    assert.equal((await api(phpBase, '/v1/auth/refresh', 'POST', {}, undefined, { Cookie: cookie.split(';')[0]! })).status, 401);
    const refreshed = await api(phpBase, '/v1/auth/refresh', 'POST', {}, undefined, { Cookie: cookie.split(';')[0]!, 'x-sabzine-client': 'web' });
    assert.equal(refreshed.status, 201); assert.equal(refreshed.body.refreshToken, undefined);
  });

  it('rotates an imported Node refresh token without extending its session', async () => {
    const response = await api(phpBase, '/v1/auth/refresh', 'POST', { refreshToken: nodeRefresh });
    assert.equal(response.status, 201);
    const claims = verifyAccessToken(response.body.accessToken as string, secrets.JWT_SECRET);
    assert.equal(claims.sid, verifyAccessToken(nodeAccess, secrets.JWT_SECRET).sid);
    assert.equal((await api(nodeBase, '/v1/me', 'GET', undefined, response.body.accessToken as string)).status, 200);
    assert.equal((await api(phpBase, '/v1/auth/refresh', 'POST', { refreshToken: nodeRefresh })).status, 401);
    assert.equal((await api(phpBase, '/v1/me', 'GET', undefined, response.body.accessToken as string)).status, 401);
  });

  it('preserves encrypted fields and bigint money through import, and Node decrypts new PHP ciphertext', async () => {
    const details = { name: 'اطلاعات جدید 🙂', contactPhone: '09120000777', age: 33, height: 174, weight: 69.5, photo: null };
    assert.equal((await api(phpBase, '/v1/me/personal-details', 'PATCH', details, customerAccess)).status, 200);
    const code = 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); echo json_encode(["encrypted"=>Illuminate\\Support\\Facades\\DB::table("user_personal_details")->where("user_id",$argv[1])->value("details_encrypted"),"cash"=>(string)Illuminate\\Support\\Facades\\DB::table("wallets")->where("user_id",$argv[1])->value("cash_toman")]);';
    const stored = JSON.parse((await run(php, ['-r', code, customerId], options())).stdout);
    assert.equal(stored.cash, '9007199254740993');
    assert.deepEqual(JSON.parse(decryptText(stored.encrypted, secrets.FIELD_KEY)), { ...details, contactPhone: '+989120000777' });
  });

  it('serializes concurrent refresh replays across two independent PHP processes', async () => {
    const login = await api(phpBase, '/v1/auth/admin/login', 'POST', { username: 'migration-admin', password });
    const results = await Promise.all([phpBase, secondBase].map(base => api(base, '/v1/auth/refresh', 'POST', { refreshToken: login.body.refreshToken })));
    assert.deepEqual(results.map(result => result.status).sort(), [201, 401]);
    const winner = results.find(result => result.status === 201)!;
    assert.equal((await api(phpBase, '/v1/me', 'GET', undefined, winner.body.accessToken as string)).status, 401);
  });

  it('serializes OTP resend cooldown across two independent PHP processes', async () => {
    const results = await Promise.all([phpBase, secondBase].map(base => api(base, '/v1/auth/otp/request', 'POST', { phone: '09120000666' })));
    assert.deepEqual(results.map(result => result.status).sort(), [201, 429]);
  });

  it('matches questionnaire HTTP validation, encrypted drafts, submissions and acquisition decisions', async () => {
    const phone = '09120000444';
    const nodeToken = (await source.login(phone)).Authorization.slice(7);
    assert.equal((await api(phpBase, '/v1/auth/otp/request', 'POST', { phone })).status, 201);
    const verified = await api(phpBase, '/v1/auth/otp/verify', 'POST', { phone, code: '123456' });
    assert.equal(verified.status,201,JSON.stringify(verified.body));
    const phpToken = verified.body.accessToken as string;
    const fixture = JSON.parse(await readFile(path.join(root, 'backend-laravel/tests/Fixtures/node-questionnaire.json'), 'utf8'));
    for (const route of ['/v1/questionnaire/schema','/v1/me/questionnaire','/v1/me/questionnaire/current','/v1/me/acquisition-state']) {
      const a = await api(nodeBase, route, 'GET', undefined, nodeToken);
      const b = await api(phpBase, route, 'GET', undefined, phpToken);
      assert.equal(b.status,a.status,route); assert.deepEqual(b.body,a.body,route);
    }
    for (const vector of fixture.filter((vector: { error?: unknown }) => vector.error)) {
      const a = await api(nodeBase, '/v1/me/questionnaire/submissions','POST',vector.input,nodeToken);
      const b = await api(phpBase, '/v1/me/questionnaire/submissions','POST',vector.input,phpToken);
      assert.equal(b.status,a.status); assert.deepEqual(b.body,a.body);
    }
    const answers = { ...fixture[0].input, healthDetails: 'شرح محرمانهٔ آزمایشی' };
    for (const [base,token] of [[nodeBase,nodeToken],[phpBase,phpToken]]) {
      assert.equal((await api(base!, '/v1/me/questionnaire','PUT',answers,token)).status,200);
      const draft = await api(base!, '/v1/me/questionnaire','GET',undefined,token);
      assert.deepEqual(draft.body.answers,answers); assert.ok(draft.body.updatedAt);
      assert.equal((await api(base!, '/v1/me/questionnaire/submissions','POST',answers,token)).status,201);
    }
    const a = (await api(nodeBase, '/v1/me/questionnaire/current','GET',undefined,nodeToken)).body.submission as Record<string,unknown>;
    const b = (await api(phpBase, '/v1/me/questionnaire/current','GET',undefined,phpToken)).body.submission as Record<string,unknown>;
    delete a.id; delete a.submittedAt; delete b.id; delete b.submittedAt;
    assert.deepEqual(b,a);
    assert.deepEqual((await api(phpBase,'/v1/me/acquisition-state','GET',undefined,phpToken)).body,(await api(nodeBase,'/v1/me/acquisition-state','GET',undefined,nodeToken)).body);
  });

  it('matches catalog queries, composition, validation and serializes simultaneous replacements', async () => {
    const token = (await api(phpBase,'/v1/auth/admin/login','POST',{username:'migration-admin',password})).body.accessToken as string;
    const withoutIds = (value: unknown): unknown => Array.isArray(value) ? value.map(withoutIds) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !['id','optionId'].includes(key)).map(([key,item]) => [key,withoutIds(item)])) : value;
    for (const route of ['/v1/admin/foods?limit=3','/v1/admin/foods?q=قورمه','/v1/admin/foods?category=fruit&active=true','/v1/admin/foods?category=invalid','/v1/admin/foods?cursor=orange&limit=5','/v1/admin/foods/export']) {
      const a = await api(nodeBase,route,'GET',undefined,nodeAccess);
      const b = await api(phpBase,route,'GET',undefined,token);
      assert.equal(b.status,a.status,route); assert.deepEqual(withoutIds(b.body),withoutIds(a.body),route);
    }
    const foods = (await api(nodeBase,'/v1/admin/foods?limit=1','GET',undefined,nodeAccess)).body.items as Record<string,unknown>[];
    const food = foods[0]!;
    for (const body of [{kind:'specialist_alternative',items:[{slug:food.slug,servings:1.5}],note:'آزمایش'},{kind:'primary',items:[]},{kind:'bad',items:[]},{kind:'primary',items:[{slug:'absent',servings:1}]}]) {
      const a = await api(nodeBase,'/v1/catalog/compose','POST',body,nodeAccess);
      const b = await api(phpBase,'/v1/catalog/compose','POST',body,token);
      assert.equal(b.status,a.status); assert.deepEqual(withoutIds(b.body),withoutIds(a.body));
    }
    for (const body of [{...food,slug:'new_food',kcal:-2},{...food,slug:'new_food',active:'true'},{...food,slug:'new_food',proteinG:null}]) {
      const a = await api(nodeBase,'/v1/admin/foods','POST',body,nodeAccess);
      const b = await api(phpBase,'/v1/admin/foods','POST',body,token);
      assert.equal(b.status,a.status); assert.deepEqual(b.body,a.body);
    }
    const revision = (await api(phpBase,'/v1/admin/foods/revision','GET',undefined,token)).body.revision;
    const responses = await Promise.all([phpBase,secondBase].map(base => api(base,'/v1/admin/foods/replace','POST',{operationId:randomUUID(),expectedRevision:revision,foods:[food]},token)));
    assert.deepEqual(responses.map(response => response.status).sort(),[201,409]);
  });

  it('matches wallet, topups, orders and refunds and serializes repeated payment and order requests', async () => {
    const phone = '09120000222';
    const nodeToken = (await source.login(phone)).Authorization.slice(7);
    assert.equal((await api(phpBase,'/v1/auth/otp/request','POST',{phone})).status,201);
    const login = await api(phpBase,'/v1/auth/otp/verify','POST',{phone,code:'123456'});
    assert.equal(login.status,201);
    const phpToken = login.body.accessToken as string;
    const catalog = await api(nodeBase,'/v1/catalog');
    assert.deepEqual((await api(phpBase,'/v1/catalog')).body,catalog.body);
    assert.deepEqual((await api(phpBase,'/v1/payments/gateways')).body,(await api(nodeBase,'/v1/payments/gateways')).body);
    const tokens = [[nodeBase,nodeToken],[phpBase,phpToken]] as const;
    for(const [base,token] of tokens) {
      const topup = await api(base,'/v1/me/topups','POST',{packageCode:'p50'},token);
      assert.equal(topup.status,201,JSON.stringify(topup.body));
      const credit = await api(base,'/v1/payments/sandbox/complete','POST',{paymentId:topup.body.paymentId});
      assert.equal(credit.status,201);
      if(base === phpBase) {
        const replays = await Promise.all([phpBase,secondBase].map(server => api(server,'/v1/payments/sandbox/complete','POST',{paymentId:topup.body.paymentId})));
        assert.deepEqual(replays.map(reply => reply.body),[credit.body,credit.body]);
        const ledger = (await api(base,'/v1/me/wallet/ledger','GET',undefined,token)).body;
        assert.equal((ledger as unknown as unknown[]).length,1);
      }
    }
    assert.deepEqual((await api(phpBase,'/v1/me/wallet','GET',undefined,phpToken)).body,(await api(nodeBase,'/v1/me/wallet','GET',undefined,nodeToken)).body);
    const fixture = JSON.parse(await readFile(path.join(root,'backend-laravel/tests/Fixtures/node-questionnaire.json'),'utf8'));
    for(const [base,token] of tokens) {
      assert.equal((await api(base,'/v1/me/questionnaire/submissions','POST',fixture[0].input,token)).status,201);
    }
    const services = catalog.body.services as {code:string;priceToman:number}[];
    const body = {serviceCode:'new_plan',expectedPriceToman:services.find(service => service.code === 'new_plan')!.priceToman};
    const packages = catalog.body.topups as {code:string;amountToman:number}[];
    const largest = [...packages].sort((a,b) => b.amountToman-a.amountToman)[0]!;
    for(const [base,token] of tokens) {
      while(Number((await api(base,'/v1/me/wallet','GET',undefined,token)).body.cashToman) < body.expectedPriceToman) {
        const topup = await api(base,'/v1/me/topups','POST',{packageCode:largest.code},token);
        assert.equal(topup.status,201);
        assert.equal((await api(base,'/v1/payments/sandbox/complete','POST',{paymentId:topup.body.paymentId})).status,201);
      }
    }
    const headers = {'idempotency-key':'cross-runtime-order-1'};
    const nodeOrder = await api(nodeBase,'/v1/me/orders','POST',body,nodeToken,headers);
    assert.equal(nodeOrder.status,201,JSON.stringify(nodeOrder.body));
    const copies = await Promise.all([phpBase,secondBase].map(server => api(server,'/v1/me/orders','POST',body,phpToken,headers)));
    assert.deepEqual(copies.map(copy => copy.status),[201,201],JSON.stringify(copies.map(copy => copy.body)));
    assert.deepEqual(copies[0]!.body,copies[1]!.body);
    const {orderId:nodeOrderId,requestId:_nodeRequest,...nodeRest} = nodeOrder.body;
    const {orderId:phpOrderId,requestId:_phpRequest,...phpRest} = copies[0]!.body;
    assert.deepEqual(phpRest,nodeRest);
    for(const [base,token] of tokens) {
      const conflict = await api(base,'/v1/me/orders','POST',{...body,expectedPriceToman:body.expectedPriceToman+1},token,headers);
      assert.equal(conflict.status,422);
      assert.equal(conflict.body.code,'idempotency_conflict');
    }
    const phpCancelled = await Promise.all([phpBase,secondBase].map(server => api(server,`/v1/me/orders/${phpOrderId}/cancel`,'POST',undefined,phpToken)));
    assert.deepEqual(phpCancelled.map(reply => reply.status).sort(),[201,409]);
    const nodeCancelled = await api(nodeBase,`/v1/me/orders/${nodeOrderId}/cancel`,'POST',undefined,nodeToken);
    assert.equal(nodeCancelled.status,201);
    assert.deepEqual(phpCancelled.find(reply => reply.status === 201)!.body,nodeCancelled.body);
  });

  it('connects real React site, admin and doctor screens to Laravel/MySQL with login and refresh', {skip:!process.env.PLAYWRIGHT_MODULE}, async () => {
    const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE!);
    const port = await freePort();
    const vite = spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port)],{
      cwd:path.join(root,'frontend'),env:{...env,SABZINE_API_TARGET:phpBase},windowsHide:true,stdio:['ignore','pipe','pipe'],
    });
    servers.push(vite);
    let logs = '';
    vite.stdout?.on('data',chunk => {logs += String(chunk);}); vite.stderr?.on('data',chunk => {logs += String(chunk);});
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for(let i=0;i<150;i++) {
      if(vite.exitCode !== null) throw new Error('Vite exited: '+logs);
      try {if((await fetch(base)).status === 200) {ready=true;break;}} catch {}
      await delay(100);
    }
    assert.ok(ready,'Real frontend must start');
    const token = (await api(phpBase,'/v1/auth/admin/login','POST',{username:'migration-admin',password})).body.accessToken as string;
    const article = {slug:'browser-mysql-test',title:'مقالهٔ اتصال واقعی MySQL',category:'تست',image:0,readingMinutes:3,intro:'این مقاله از پایگاه داده خوانده می‌شود.',sections:[{heading:'اتصال تأیید شد',body:'این متن از Laravel دریافت شده است.'}]};
    assert.equal((await api(phpBase,'/v1/admin/articles','POST',article,token)).status,201);
    assert.equal((await api(phpBase,'/v1/admin/articles/'+article.slug+'/publish','POST',undefined,token)).status,201);
    const browser = await chromium.launch({headless:true,...(process.platform === 'win32' ? {channel:'chrome'} : {})});
    try {
      const page = await browser.newPage({viewport:{width:1440,height:1000}});
      const errors: string[] = []; page.on('pageerror',(error: Error) => errors.push(error.message));
      await page.goto(base+'/articles');
      await page.locator(`a[href="/article.html?id=${article.slug}"]`).click();
      await page.getByRole('heading',{name:'اتصال تأیید شد',exact:true}).waitFor();
      assert.ok((await page.locator('article').innerText()).includes(article.sections[0]!.body));
      await page.goto(base+'/admin/login');
      await page.getByLabel('نام کاربری',{exact:true}).fill('migration-admin');
      await page.getByLabel('رمز عبور',{exact:true}).fill(password);
      const login = page.waitForResponse((response: {url():string;status():number}) => response.url().endsWith('/v1/auth/admin/login') && response.status() === 201);
      await page.getByRole('button',{name:'ورود به پنل',exact:true}).click(); await login;
      await page.getByRole('heading',{name:'داشبورد',exact:true}).waitFor();
      await page.getByText('کاربران',{exact:true}).last().waitFor();
      const refresh = page.waitForResponse((response: {url():string;status():number}) => response.url().endsWith('/v1/auth/refresh') && response.status() === 201);
      await page.goto(base+'/admin/foods'); await refresh;
      await page.getByRole('heading',{name:'کاتالوگ غذا',exact:true}).waitFor();
      const foods = (await api(phpBase,'/v1/admin/foods','GET',undefined,token)).body.items as {nameFa:string}[];
      await page.getByText(foods[0]!.nameFa,{exact:true}).first().waitFor();
      await page.goto(base+'/admin/articles');
      await page.getByText(article.title,{exact:true}).first().waitFor();
      const loggedOut = page.waitForResponse((response: {url():string;status():number}) => response.url().endsWith('/v1/auth/logout') && response.status() === 201);
      await page.getByRole('button',{name:'خروج از حساب',exact:true}).click(); await loggedOut;
      await page.getByRole('heading',{name:'خوش برگشتید',exact:true}).waitFor();
      await page.goto(base+'/doctor/login');
      await page.getByLabel('شماره تلفن',{exact:true}).fill('09120005555');
      await page.getByRole('button',{name:'دریافت کد ورود',exact:true}).click();
      await page.getByLabel('کد ورود',{exact:true}).fill('123456');
      await page.getByRole('button',{name:'ورود به پنل',exact:true}).click();
      await page.getByRole('heading',{name:'برنامه‌های آماده بررسی',exact:true}).waitFor();
      const queue = page.waitForResponse((response: {url():string;status():number}) => response.url().endsWith('/v1/specialist/queue') && response.status() === 200);
      await page.goto(base+'/doctor/patients'); await queue;
      await page.getByRole('heading',{name:'پرونده کاربران',exact:true}).waitFor();
      await page.goto(base+'/doctor/profile');
      await page.getByText('متخصص آزمایش',{exact:true}).waitFor();
      assert.deepEqual(errors,[]);
    } finally { await browser.close(); }
  });
});
