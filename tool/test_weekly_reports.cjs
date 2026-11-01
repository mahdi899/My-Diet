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
    await page.getByRole('button',{name:'گزارش‌های هفتگی',exact:true}).click();
    await page.getByRole('heading',{name:'گزارش‌های هفتگی کاربران',exact:true}).waitFor();
    assert((await page.locator('#content').innerText()).includes('حالت نمونهٔ طراحی'));
    await page.getByRole('heading',{name:'نمونه گزارش AI · نسخه ۲',exact:true}).waitFor();
    assert((await page.locator('#content').innerText()).includes('مقایسه با هفته قبل'));
    await page.getByLabel('هفته گزارش',{exact:true}).selectOption('sample-02');
    await page.getByRole('heading',{name:'نمونه گزارش AI · نسخه ۱',exact:true}).waitFor();
    assert((await page.locator('#content').innerText()).includes('داده ناقص'));
    await page.getByLabel('کاربر نمونه',{exact:true}).selectOption('کاربر نمونه ب');
    assert((await page.locator('#content').innerText()).includes('در انتظار آماده‌سازی'));
    await page.getByLabel('هفته گزارش',{exact:true}).selectOption('sample-04');
    assert((await page.locator('#content').innerText()).includes('آماده‌سازی ناموفق'));
    await page.getByLabel('کاربر نمونه',{exact:true}).selectOption('کاربر نمونه الف');
    await page.evaluate(() => document.fonts.ready);
    const shots=resolve(__dirname,'../screenshots/phase5');await mkdir(shots,{recursive:true});
    await page.screenshot({path:resolve(shots,'specialist-weekly-report-demo.png'),fullPage:true});
    await page.setViewportSize({width:768,height:1024});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS: authenticated weekly report route, patient/week selection, versions, comparison, partial/pending/failed fixtures, and tablet layout. No live AI calls.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode=1; }).finally(() => server.close());
