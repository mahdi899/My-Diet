import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { hashPassword } from './dist/common/password.js';
import { uuidv7 } from './dist/common/id.js';

const configPath = '.env.local-admin.json';
const firstRun = !existsSync(configPath);
const config = firstRun ? {
  databasePassword: randomBytes(24).toString('hex'),
  adminUsername: 'admin', adminPassword: randomBytes(15).toString('base64url'),
  jwtSecret: randomBytes(32).toString('hex'), otpPepper: randomBytes(32).toString('hex'), fieldKey: randomBytes(32).toString('hex'),
} : JSON.parse(readFileSync(configPath, 'utf8'));
if (firstRun) writeFileSync(configPath,JSON.stringify(config,null,2));
const database = new EmbeddedPostgres({ databaseDir: '.pgdata', user:'sabzine', password: config.databasePassword, port: 54329, persistent:true, initdbFlags:['--encoding=UTF8','--locale=C'] });
if (!existsSync('.pgdata/PG_VERSION')) await database.initialise();
try { await database.start(); } catch(error) {
  const probe = new pg.Client({connectionString:`postgres://sabzine:${config.databasePassword}@127.0.0.1:54329/postgres`});
  try { await probe.connect(); } catch { throw error; } finally { await probe.end(); }
}
const connectionString=`postgres://sabzine:${config.databasePassword}@127.0.0.1:54329/postgres`;
const root=new pg.Client({connectionString});await root.connect();
if (!(await root.query("select 1 from pg_database where datname='sabzine'")).rowCount) await root.query('create database sabzine');
await root.end();
Object.assign(process.env,{NODE_ENV:'development',APP_ROLE:'api',DATABASE_URL:connectionString.replace('/postgres','/sabzine'),SMS_PROVIDER:'console',PAYMENT_GATEWAY:'sandbox',AI_PROVIDER:'fake',PUSH_PROVIDER:'console',LOG_LEVEL:'warn',JWT_SECRET:config.jwtSecret,OTP_PEPPER:config.otpPepper,FIELD_KEY:config.fieldKey});
const {migrateUp}=await import('./dist/database/migrate.js');await migrateUp(process.env.DATABASE_URL);
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
if(firstRun){
  const id=uuidv7();
  await client.query('begin');
  try{
    await client.query("insert into users(id,phone_e164,role,display_name) values($1,'+989120000099','admin','مدیر سبزینه')",[id]);
    await client.query('insert into wallets(user_id) values($1)',[id]);
    await client.query('insert into admin_credentials(user_id,username,password_hash) values($1,$2,$3)',[id,config.adminUsername,hashPassword(config.adminPassword)]);
    await client.query('commit');
  }catch(e){await client.query('rollback');throw e;}
}
await client.end();
const {createApp}=await import('./dist/bootstrap.js');const {app}=await createApp();await app.listen(3000,'0.0.0.0');
console.log('Admin ready: http://localhost:3000/admin/');
