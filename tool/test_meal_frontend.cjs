// Browser contract tests use fixtures, never production authentication or patient data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '../backend/admin-web');
const server = createServer(async (req, res) => {
  const file = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.ttf':'font/ttf'})[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let fail = false;
    await page.route('**/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const reply = (value, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(value) });
      if (path.endsWith('/auth/refresh')) return reply({role:'specialist',accessToken:'fixture',sessionExpiresAt:new Date(Date.now()+3600000).toISOString()});
      if (path.endsWith('/specialist/queue')) return reply([{id:'fixture',displayName:'کاربر نمونه',status:'in_review',createdAt:'2026-11-01T08:00:00Z'}]);
      if (path.endsWith('/conversations')) return reply([]);
      if (path.endsWith('/specialist/requests/fixture')) return fail ? reply({detail:'دسترسی مجاز نیست'},403) : reply({version:{days:[{meals:[{title:'غذای نمونه',calories:400,items:[{name:'برنج پخته',quantity:150,unit:'گرم'}]}]}]}});
      return reply([]);
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/specialist.html`);
    await page.getByRole('button', {name:'بررسی جزئیات و جایگزین‌ها',exact:true}).click();
    await page.getByRole('heading',{name:'کامل‌بودن غذاها و جایگزین‌ها پیش از انتشار'}).waitFor();
    await page.getByText('شنبه',{exact:true}).click();
    await page.getByText('یک جایگزین هوش مصنوعی لازم است',{exact:true}).waitFor();
    assert(await page.getByText('زمان آماده‌سازی ثبت نشده',{exact:true}).isVisible());
    assert.equal(await page.getByRole('button',{name:'انتشار',exact:true}).count(),0);
    const shots = resolve(__dirname,'../screenshots/phase2'); await mkdir(shots,{recursive:true});
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:resolve(shots,'specialist-incomplete-demo.png'),fullPage:true});
    const checks = await page.evaluate(() => {
      const food = {title:'غذای نمونه',calories:400,preparationMinutes:15,instructions:'روش نمونه',quantityBasis:'پخته',items:[{name:'برنج',quantity:150,unit:'گرم'}]};
      const complete = {...food,alternatives:['ai','specialist'].map(source=>({id:source,source,approved:true,reviewedBy:'fixture',reviewedAt:'2026-11-01T08:00:00Z',meal:food}))};
      const valid = SabzineMealQuality.check(complete);
      complete.alternatives[0].approved=false;
      const invalid=SabzineMealQuality.check(complete);
      return {valid,invalid};
    });
    assert.deepEqual(checks.valid,[]); assert(checks.invalid.some(x=>x.includes('تأیید متخصص ندارد')));
    await page.getByRole('button',{name:'بازگشت به فهرست'}).click();
    fail=true;
    await page.getByRole('button',{name:'بررسی جزئیات و جایگزین‌ها',exact:true}).click();
    await page.getByText('دسترسی مجاز نیست',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: actual specialist navigation, incomplete fields, alternative approval validation and permission failure. All responses are fixtures.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode=1; }).finally(() => server.close());
