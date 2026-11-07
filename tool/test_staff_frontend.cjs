// Standalone browser contract tests. All API responses below are test fixtures.
// Set PLAYWRIGHT_MODULE to an installed Playwright package when it is not on NODE_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '..', 'admin');
const shots = resolve(__dirname, '..', 'screenshots', 'phase1');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/admin\/?/, '') || 'index.html';
    const file = resolve(root, path);
    if (!file.startsWith(root + '\\') && file !== root) { res.writeHead(403).end(); return; }
    const content = await readFile(file);
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf'})[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
const makeSession = role => ({role,accessToken:'fixture-access',sessionExpiresAt:new Date(Date.now()+86400000).toISOString()});
async function main() {
  await mkdir(shots,{recursive:true});
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  const base = `http://127.0.0.1:${server.address().port}/admin/`;
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let role='specialist',authenticated=false,refreshes=0,failQueue=false;
    await page.route('**/v1/**',async route=>{
      const path=new URL(route.request().url()).pathname.replace('/v1/','');
      const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(path==='auth/refresh'){refreshes++;return authenticated?reply(makeSession(role)):reply({},401);}
      if(path==='auth/otp/request')return reply({ok:true});
      if(path==='auth/otp/verify'||path==='auth/admin/login'){authenticated=true;return reply(makeSession(role));}
      if(path==='auth/logout'){authenticated=false;return reply({ok:true});}
      if(!authenticated)return reply({},401);
      if(path.startsWith('specialist/queue'))return failQueue?reply({detail:'اجازه دسترسی ندارید'},403):reply([{id:'fixture-request',displayName:'کاربر آزمایشی',status:'in_review',kind:'new_plan',createdAt:'2026-11-01T08:00:00Z'}]);
      if(path==='specialist/profile')return reply({displayName:'متخصص آزمایشی',credential:'متخصص تغذیه',councilNo:'12345',verificationStatus:'verified',bio:'اطلاعات آزمایشی برای بررسی رابط'});
      if(path==='conversations')return reply([]);
      if(path==='admin/dashboard')return reply({users:12,newUsers:2,revenueToman:500000,paidOrders:1,unreadMessages:0,aiToday:2});
      if(path==='admin/orders')return reply([]);
      return reply([]);
    });
    await page.goto(base+'specialist.html');
    await page.waitForFunction(()=>!document.getElementById('phone-form').hidden);
    await page.screenshot({path:resolve(shots,'specialist-login.png'),fullPage:true});
    assert.equal(await page.locator('#panel').isVisible(),false);
    await page.getByLabel('شماره تلفن',{exact:true}).fill('09123456789');
    await page.getByRole('button',{name:'دریافت کد ورود',exact:true}).click();
    await page.getByLabel('کد ورود',{exact:true}).fill('123456');
    await page.getByRole('button',{name:'ورود به سامانه',exact:true}).click();
    await page.getByRole('heading',{name:'فضایی برای تمرکز روی هر پرونده'}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('nav button').count(),7);
    await page.screenshot({path:resolve(shots,'specialist-shell-demo.png'),fullPage:true});
    for(const label of ['پرونده کاربران','گزارش‌های هفتگی','پروفایل حرفه‌ای','گفتگوها','برنامه‌های منتظر بررسی','درخواست‌های تغییر برنامه']){
      await page.getByRole('button',{name:label,exact:true}).click();
      await page.waitForFunction(()=>document.getElementById('content').getAttribute('aria-busy')==='false');
      assert(await page.locator('#content').innerText());
    }
    await page.setViewportSize({width:768,height:1024});
    await page.getByRole('button',{name:'داشبورد',exact:true}).click();
    await page.getByRole('heading',{name:'فضایی برای تمرکز روی هر پرونده'}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:resolve(shots,'specialist-tablet-demo.png'),fullPage:true});
    failQueue=true;
    await page.getByRole('button',{name:'برنامه‌های منتظر بررسی',exact:true}).click();
    await page.getByText('اجازه دسترسی به این بخش را ندارید.',{exact:true}).waitFor();
    failQueue=false;
    await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();
    await page.locator('#phone-form').waitFor({state:'visible'});
    assert.equal(await page.locator('#content').innerText(),'');
    // A valid customer session must not grant specialist workspace access.
    authenticated=true;role='user';await page.reload();
    await page.getByText('این حساب اجازه ورود به این پنل را ندارد.',{exact:true}).waitFor();
    assert.equal(await page.locator('#panel').isVisible(),false);
    // Administrator navigation and previous integration pages remain reachable.
    role='admin';await page.setViewportSize({width:1440,height:1000});await page.goto(base+'index.html');
    await page.getByRole('heading',{name:'آخرین سفارش‌ها',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:resolve(shots,'admin-shell-demo.png'),fullPage:true});
    for(const label of ['پیکربندی پرسش‌نامه','دلایل تغییر برنامه','گزارش کاربران','گزارش متخصصان','مسیر کاربران']) {
      await page.getByRole('link',{name:label,exact:true}).click();
      await page.getByRole('heading',{name:label==='مسیر کاربران'?'مسیر کاربران':label,exact:true}).last().waitFor();
      assert((await page.locator('#content').innerText()).includes('فاز'));
    }
    assert.equal(await page.getByRole('link',{name:'هوش مصنوعی',exact:true}).count(),1);
    assert.equal(await page.getByRole('link',{name:'نوتفیکیشن',exact:true}).count(),1);
    // A revoked session loses access and clears the private screen.
    authenticated=false;
    await page.locator('#nav [data-section=users]').click();
    await page.locator('#login').waitFor({state:'visible'});
    assert.equal(await page.locator('#panel').isVisible(),false);
    assert.equal(await page.locator('#content').innerText(),'');
    assert.deepEqual(errors,[]);
    console.log('PASS: specialist OTP, staff role rejection, 7 specialist routes, admin routes, responsive layout, permission errors, logout and revoked session.');
    console.log('Screenshots use explicit API fixtures; no real authentication or clinical data was created.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
