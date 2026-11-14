import { writeFile } from 'node:fs/promises';
import { bootApp } from './boot.js';
import { questionnaireView } from '../../src/questionnaire/schema.js';
import { onboardingSpecView } from '../../src/onboarding/spec.js';

const app = await bootApp();
try {
  const tables = (await app.pool.query(`select tablename as name from pg_tables where schemaname='public' and tablename<>'pgmigrations' order by tablename`)).rows;
  const catalog = [];
  for (const {name} of tables) {
    const columns = (await app.pool.query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,pg_get_expr(d.adbin,d.adrelid) as default,a.attgenerated as generated,a.attidentity as identity
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`,[name])).rows;
    const constraints = (await app.pool.query(`select conname as name,contype as type,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=$1::regclass order by contype,conname`,[name])).rows;
    const indexes = (await app.pool.query(`select indexname as name,indexdef as definition from pg_indexes where schemaname='public' and tablename=$1 order by indexname`,[name])).rows;
    catalog.push({name,columns,constraints,indexes});
  }
  const functions = (await app.pool.query(`select p.proname as name,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`)).rows;
  const triggers = (await app.pool.query(`select tgname as name,pg_get_triggerdef(oid) as definition from pg_trigger where not tgisinternal order by tgname`)).rows;
  const seeds: Record<string, unknown[]> = {};
  for(const {name:table} of tables) {
    const rows=(await app.pool.query('select * from '+table)).rows;
    if(rows.length) seeds[table]=rows;
  }
  await writeFile(process.argv[2]!, JSON.stringify({tables:catalog,functions,triggers,seeds,assets:{questionnaire:questionnaireView(),onboarding:onboardingSpecView()}},null,2)+'\n');
  console.log(`Exported ${catalog.length} tables, ${functions.length} functions, ${triggers.length} triggers`);
} finally { await app.stop(); }
