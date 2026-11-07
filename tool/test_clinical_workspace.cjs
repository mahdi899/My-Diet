// Browser contract tests: explicit fixtures only, no live patient accounts or medical publication.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('node:http');
const { readFile,mkdir } = require('node:fs/promises');
const { resolve,extname,sep } = require('node:path');
const assert = require('node:assert/strict');
const root=resolve(__dirname,'../admin');
const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let accept=true;page.on('dialog',d=>accept?d.accept():d.dismiss());
    let denied=false,stale=false,revoke=false,putCount=0,refreshCount=0;
    let request={id:'fixture',displayName:'کاربر واقعیِ آزمایشی',status:'in_review',questions:[{id:'q1',prompt:'سؤال لازم',status:'open',required:true,answers:[]}],version:{status:'draft',lockVersion:3,days:Array.from({length:7},()=>({meals:[{mealUid:crypto.randomUUID(),mealType:'lunch',suggestedTime:'13:30',title:'غذای API نمونه',calories:500,notes:'',items:[{name:'برنج پخته',quantity:150,unit:'گرم'}]}]}))}};
    await page.route('**/v1/**',route=>{
      const path=new URL(route.request().url()).pathname,method=route.request().method();
      const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(path.endsWith('/auth/refresh')){refreshCount++;return revoke?reply({},401):reply({role:'specialist',accessToken:'fixture',sessionExpiresAt:new Date(Date.now()+3600000).toISOString()});}
      if(path.endsWith('/specialist/queue'))return reply([{id:'fixture',displayName:'کاربر واقعیِ آزمایشی',status:'in_review',createdAt:'2026-11-01T08:00:00Z'}]);
      if(path.endsWith('/conversations'))return reply([]);
      if(path.endsWith('/specialist/requests/fixture/draft')&&method==='PUT'){
        putCount++;assert.equal(route.request().headers()['if-match'],String(request.version.lockVersion));
        if(putCount===1)return reply({},401); // Retry must preserve the lock header and body after token refresh.
        if(stale)return reply({detail:'نسخه تغییر کرده'},409);
        request.version.days=route.request().postDataJSON().days;request.version.lockVersion++;
        return reply({lockVersion:request.version.lockVersion});
      }
      if(path.endsWith('/specialist/requests/fixture/questions')&&method==='POST'){request.questions.push({id:'q2',prompt:route.request().postDataJSON().prompt,status:'open',required:true,answers:[]});request.status='needs_info';return reply({id:'q2'});}
      if(path.includes('/specialist/info-questions/')&&path.endsWith('/acknowledge')){const id=path.split('/').at(-2),q=request.questions.find(q=>q.id===id);assert.equal(q.status,'answered');q.status='acknowledged';if(request.questions.every(q=>q.status==='acknowledged'))request.status='in_review';return reply({status:'acknowledged'});}
      if(path.endsWith('/specialist/requests/fixture'))return denied?reply({detail:'دسترسی مجاز نیست'},403):reply(request);
      return reply([]);
    });
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(base+'/specialist.html');
    await page.getByRole('button',{name:'پرونده کاربران',exact:true}).click();
    await page.getByRole('button',{name:'باز کردن پرونده و ویرایشگر نمونه',exact:true}).click();
    await page.getByRole('heading',{name:'پروندهٔ کاربر',exact:true}).waitFor();
    assert((await page.locator('.clinical-workspace').innerText()).includes('هیچ موردی گزارش نشده'));
    assert((await page.locator('.clinical-workspace').innerText()).includes('ارائه نشده'));
    await page.getByRole('button',{name:'دریافت تاریخچهٔ برنامه‌ها',exact:true}).click();
    await page.getByText('نسخه 1 ·',{exact:false}).first().waitFor();
    const shots=resolve(__dirname,'../references/screenshots/phase6');await mkdir(shots,{recursive:true});
    await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(shots,'patient-demo.png'),fullPage:true});
    await page.getByRole('button',{name:'ویرایش برنامه',exact:true}).click();
    const publish=page.getByRole('button',{name:'تأیید و انتشار نمونه',exact:true});assert(await publish.isDisabled());
    await page.getByLabel('وعده 1 · نام غذا',{exact:true}).fill('غذای ویرایش‌شده نمونه');
    for(const day of ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']){
      await page.getByRole('button',{name:day,exact:true}).click();
      for(const group of await page.locator('details.alternative-editor').all()){
        await group.locator('summary').click();
        await group.getByRole('button',{name:'جزئیات این جایگزین را بررسی و تأیید کردم',exact:true}).click();
      }
    }
    await page.getByRole('button',{name:'خطای ذخیره',exact:true}).click();
    await page.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'خطای ذخیره'}).waitFor();
    assert(await publish.isDisabled());
    await page.getByRole('button',{name:'موفق',exact:true}).click();
    await page.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).click();
    await page.getByText('بدون تغییر ذخیره‌نشده',{exact:true}).waitFor();
    assert(await publish.isDisabled()); // Required question is still open, despite complete alternatives.
    await page.getByRole('button',{name:'اطلاعات بیشتر',exact:true}).click();
    await page.getByRole('button',{name:'شبیه‌سازی پاسخ کاربر در نمونه',exact:true}).click();
    await page.getByRole('button',{name:'پاسخ را خواندم و بررسی کردم',exact:true}).click();
    await publish.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-publish]').disabled);
    await page.getByRole('button',{name:'خطای انتشار',exact:true}).click();await publish.click();
    await page.getByRole('alert').filter({hasText:'انتشار نمونه ناموفق'}).waitFor();
    await page.getByRole('button',{name:'مقایسه نسخه‌ها',exact:true}).click();
    await page.locator('.clinical-workspace details').first().locator('summary').click();
    assert((await page.locator('.clinical-workspace').innerText()).includes('برنامهٔ قبلی نمونه'));
    await page.getByRole('button',{name:'موفق',exact:true}).click();await publish.click();
    await page.waitForFunction(()=>document.querySelector('[data-publish]').disabled);
    await page.getByRole('button',{name:'ویرایش برنامه',exact:true}).click();
    await page.getByRole('button',{name:'شنبه',exact:true}).click();
    await page.getByRole('button',{name:'افزودن وعده',exact:true}).click();
    assert((await page.locator('[data-gate]').innerText()).includes('بدون نام'));
    await page.getByRole('button',{name:'حذف وعده',exact:true}).last().click();
    // Creating a specialist alternative starts empty; it never invents a second food.
    const specialist=page.locator('details.alternative-editor').filter({has:page.locator('summary',{hasText:'جایگزین متخصص'})});
    await specialist.locator('summary').click();await specialist.getByRole('button',{name:'حذف جایگزین',exact:true}).click();
    await specialist.locator('summary').click();await specialist.getByRole('button',{name:'ساخت جایگزین متخصص',exact:true}).click();
    await specialist.locator('summary').click();
    await page.getByLabel('وعده 1 · جایگزین متخصص · نام غذا',{exact:true}).fill('غذای جایگزین جدید');
    await page.getByLabel('وعده 1 · جایگزین متخصص · سهم غذا',{exact:true}).fill('یک سهم');
    await page.getByLabel('وعده 1 · جایگزین متخصص · کالری سهم',{exact:true}).fill('450');
    await page.getByLabel('وعده 1 · جایگزین متخصص · زمان آماده‌سازی (دقیقه)',{exact:true}).fill('15');
    await page.getByLabel('وعده 1 · جایگزین متخصص · مبنای مقدار خام یا پخته',{exact:true}).fill('پخته');
    await page.getByLabel('وعده 1 · جایگزین متخصص · روش آماده‌سازی',{exact:true}).fill('مواد پخته را سرو کن.');
    await specialist.getByRole('button',{name:'افزودن ماده',exact:true}).click();await specialist.locator('summary').click();
    await page.getByLabel('وعده 1 · جایگزین متخصص · نام ماده 1',{exact:true}).fill('برنج پخته');
    await page.getByLabel('وعده 1 · جایگزین متخصص · مقدار ماده 1',{exact:true}).fill('150');
    await page.getByLabel('وعده 1 · جایگزین متخصص · واحد ماده 1',{exact:true}).fill('گرم');
    await specialist.getByRole('button',{name:'جزئیات این جایگزین را بررسی و تأیید کردم',exact:true}).click();
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(shots,'editor-demo.png'),fullPage:true});
    await page.setViewportSize({width:768,height:1024});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    accept=false;await page.getByRole('button',{name:'داشبورد',exact:true}).click();assert(await page.locator('.clinical-workspace').isVisible());
    accept=true;await page.getByRole('button',{name:'بازگشت به فهرست',exact:true}).click();
    await page.getByRole('button',{name:'پرونده کاربران',exact:true}).click();
    denied=true;
    await page.getByRole('button',{name:'باز کردن پرونده و برنامه',exact:true}).click();
    await page.getByText('دسترسی مجاز نیست',{exact:true}).waitFor();
    assert.equal(await page.locator('.clinical-workspace').count(),0);denied=false;
    await page.getByRole('button',{name:'باز کردن پرونده و برنامه',exact:true}).click();
    await page.getByRole('button',{name:'ویرایش برنامه',exact:true}).click();
    await page.getByLabel('وعده 1 · نام غذا',{exact:true}).fill('عنوان زندهٔ اصلاح‌شده');
    await page.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).click();
    await page.getByText('بدون تغییر ذخیره‌نشده',{exact:true}).waitFor();assert.equal(putCount,2);assert(refreshCount>=2);
    assert.equal(request.version.days[0].meals[0].title,'عنوان زندهٔ اصلاح‌شده');assert(await page.getByRole('button',{name:'تأیید و انتشار برنامه',exact:true}).isDisabled());
    await page.getByRole('button',{name:'اطلاعات بیشتر',exact:true}).click();
    await page.getByLabel('سؤال ضروری از کاربر',{exact:true}).fill('اطلاعات دارو را به‌روز کرده‌ای؟');
    await page.getByRole('button',{name:'ارسال سؤال ضروری',exact:true}).click();
    await page.getByRole('heading',{name:'اطلاعات دارو را به‌روز کرده‌ای؟',exact:true}).waitFor();
    assert.equal(request.questions.length,2);
    for(const q of request.questions){q.status='answered';q.answers=[{body:'پاسخ کاربر از API آزمایشی'}];}
    await page.getByRole('button',{name:'تازه‌سازی پرونده',exact:true}).click();
    await page.getByRole('button',{name:'پاسخ را خواندم و بررسی کردم',exact:true}).first().click();
    await page.getByRole('button',{name:'پاسخ را خواندم و بررسی کردم',exact:true}).first().click();
    assert(request.questions.every(q=>q.status==='acknowledged'));
    await page.getByRole('button',{name:'ویرایش برنامه',exact:true}).click();
    stale=true;await page.getByLabel('وعده 1 · نام غذا',{exact:true}).fill('تغییر حفظ‌شده پس از تعارض');
    await page.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'نسخه یا وضعیت'}).waitFor();
    assert.equal(await page.getByLabel('وعده 1 · نام غذا',{exact:true}).inputValue(),'تغییر حفظ‌شده پس از تعارض');
    revoke=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.locator('#login').waitFor({state:'visible'});assert.equal(await page.locator('.clinical-workspace').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: patient context, seven-day alternatives, clinical lock, demo save/publish failure, comparison, meal/alternative editing, dirty navigation, live save/If-Match+refresh, conflict retention and revoked session.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
