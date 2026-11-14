import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { execFile,spawn,type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { bootApp, type Booted } from '../helpers/boot.js';
import { verifyAccessToken } from '../../src/common/jwt.js';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const url = process.env.MYSQL_FULL_TEST_URL;
const php = process.env.PHP_BINARY!;
describe('Full product PostgreSQL to MySQL data rehearsal', {concurrency:1,timeout:180_000,skip:!url || !php}, () => {
  let app: Booted;
  let env: NodeJS.ProcessEnv;
  let auth: {Authorization:string};
  let requestId: string;
  let server: ChildProcess | undefined;
  const options = () => ({cwd:path.join(root,'backend-laravel'),env,windowsHide:true,timeout:120_000,maxBuffer:4*1024*1024});
  before(async () => {
    app = await bootApp({JWT_SECRET:'test-only-product-import-secret'});
    auth = await app.login('09120000333');
    const userId = verifyAccessToken(auth.Authorization.slice(7),'test-only-product-import-secret').sub;
    const fixture = JSON.parse(await readFile(path.join(root,'backend-laravel/tests/Fixtures/node-questionnaire.json'),'utf8'));
    const submitted = await request(app.api.getHttpServer()).post('/v1/me/questionnaire/submissions').set(auth).send(fixture[0].input);
    assert.equal(submitted.status,201);
    const intake = JSON.parse(await readFile(path.join(root,'backend-laravel/tests/Fixtures/node-onboarding.json'),'utf8')).canonical[0];
    const draft = await request(app.api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth).send({track:intake.track,patch:intake.answers});
    assert.equal(draft.status,200);
    const completed = await request(app.api.getHttpServer()).post('/v1/me/onboarding/submit').set(auth).send({consent:true});
    assert.equal(completed.status,201);
    const order=randomUUID(), plan=randomUUID(), version=randomUUID(), day=randomUUID(), meal=randomUUID(), uid=randomUUID(), option=randomUUID();
    requestId = plan;
    await app.pool.query("insert into orders(id,user_id,service_code,price_toman,cash_toman,promo_toman,status,idempotency_key) values($1,$2,'new_plan',100,100,0,'paid','test-migration-key')",[order,userId]);
    await app.pool.query("insert into plan_requests(id,user_id,order_id,kind,status,submission_id,price_toman,week_start,effective_from) values($1,$2,$3,'new_plan','published',$4,100,'2026-11-14','2026-11-14')",[plan,userId,order,submitted.body.id]);
    await app.pool.query("insert into plan_versions(id,request_id,version_number,status) values($1,$2,1,'draft')",[version,plan]);
    await app.pool.query('insert into plan_days(id,plan_version_id,day_index,civil_date) values($1,$2,0,\'2026-11-14\')',[day,version]);
    await app.pool.query("insert into plan_meals(id,plan_day_id,meal_uid,position,meal_type,title,calories) values($1,$2,$3,0,'lunch','عدسی',300)",[meal,day,uid]);
    await app.pool.query("insert into plan_meal_options(meal_id,option_uid,kind,document) values($1,$2,'primary',$3)",[meal,option,JSON.stringify({optionId:option,kind:'primary',calories:300,approved:true,title:'عدسی',test:[true,null,1.5,'🙂'],amount:9007199254740991})]);
    await app.pool.query("update plan_versions set status='published',published_at='2026-11-14 00:00:00+00' where id=$1",[version]);
    await app.pool.query('insert into active_plan_versions(user_id,version_id) values($1,$2)',[userId,version]);
    const log = randomUUID();
    await app.pool.query("insert into meal_logs(id,user_id,request_id,scheduled_date,meal_uid,eaten,plan_version_id,option_uid,plan_meal_id) values($1,$2,$3,'2026-11-14',$4,true,$5,$6,$7)",[log,userId,plan,uid,version,option,meal]);
    await app.pool.query('update meal_logs set eaten=false where id=$1',[log]);
    await app.pool.query("insert into wallet_ledger(id,user_id,bucket,amount_toman,kind,reference_id) values($1,$2,'cash',9007199254740993,'adjustment',$3)",[randomUUID(),userId,order]);
    await app.pool.query('update wallets set cash_toman=9007199254740993 where user_id=$1',[userId]);
    await app.pool.query("update food_catalog set image_bytes=$1,nutrition=$2,updated_at='2026-11-14 12:34:56.123456+03:30' where slug=(select slug from food_catalog order by slug limit 1)",[Buffer.from([255,216,255,0,1,2,254]),JSON.stringify({method:'recipe_estimate',mixed:[1,true,null,{message:'متن 🙂'}]})]);
    env = {...process.env,DATABASE_URL:url,MYSQL_TEST_URL:url,POSTGRES_SOURCE_URL:app.databaseUrl,APP_ENV:'testing',NODE_ENV:'test',DB_CONNECTION:'mysql'};
  });
  after(async () => {
    if(server && server.exitCode === null) {server.kill();await new Promise(resolve => server!.once('exit',resolve));}
    await app?.stop();
  });
  it('validates lossless conversion and rolls back all earlier table copies if a later value cannot fit', async () => {
    await app.pool.query("update food_catalog set slug=$1 where slug=(select slug from food_catalog order by slug limit 1)",['a'.repeat(300)]);
    try {
      await assert.rejects(run(php,['artisan','migration:import-product','--execute'],options()), (error:unknown) => {
        assert.match(String((error as {stdout?:string}).stdout),/Source text exceeds target capacity/); return true;
      });
    } finally {
      await app.pool.query("update food_catalog set slug='import_test_food' where slug=$1",['a'.repeat(300)]);
    }
    const preview = JSON.parse((await run(php,['artisan','migration:import-product'],options())).stdout);
    assert.equal(preview.executed,false); assert.equal(Object.keys(preview.tables).length,117);
    assert.equal(preview.tables.plan_versions.rows,1); assert.equal(preview.tables.meal_log_history.rows,2);
    assert.equal(preview.tables.nutrition_profiles.rows,1); assert.equal(preview.tables.nutrition_profile_history.rows,1);
    assert.ok(preview.tables.onboarding_answer_facts.rows>0);
    const sourceBefore = (await app.pool.query('select count(*)::int as n from users')).rows[0].n;
    const imported = JSON.parse((await run(php,['artisan','migration:import-product','--execute'],options())).stdout);
    assert.equal(imported.executed,true); assert.equal(imported.sourceReadOnly,true); assert.deepEqual(imported.tables,preview.tables);
    assert.equal((await app.pool.query('select count(*)::int as n from users')).rows[0].n,sourceBefore);
    await assert.rejects(run(php,['artisan','migration:import-product','--execute'],options()), (error:unknown) => String((error as {stdout?:string}).stdout).includes('empty destination'));
  });
  it('serves imported published plans, meal activity and request timelines exactly like Node', async () => {
    const port = await new Promise<number>((resolve,reject) => {const listener=net.createServer();listener.on('error',reject);listener.listen(0,'127.0.0.1',()=>{const port=(listener.address() as net.AddressInfo).port;listener.close(()=>resolve(port));});});
    server = spawn(php,['-S',`127.0.0.1:${port}`,'-t','public','public/index.php'],{...options(),timeout:0,stdio:['ignore','pipe','pipe']});
    let logs=''; server.stderr?.on('data',chunk=>{logs+=String(chunk);}); server.stdout?.on('data',()=>undefined);
    const base = `http://127.0.0.1:${port}`;
    let ready=false;
    for(let i=0;i<100;i++) {try {if((await fetch(base+'/health/ready')).ok){ready=true;break;}} catch {} await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,logs);
    for(const route of ['/v1/me/onboarding','/v1/me/plan','/v1/me/plan/week?weekStart=2026-11-14','/v1/me/plan/day/2026-11-14','/v1/me/requests','/v1/me/request','/v1/me/requests/'+requestId]) {
      const node=await request(app.api.getHttpServer()).get(route).set(auth);
      const laravel=await fetch(base+route,{headers:auth});
      assert.equal(laravel.status,node.status,route); assert.deepEqual(await laravel.json(),node.body,route);
    }
  });
});
