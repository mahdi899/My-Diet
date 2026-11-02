// Explicit browser fixtures; never contacts a real patient or publishes a real plan.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const assert=require('node:assert/strict');
const root=resolve(__dirname,'../backend/admin-web');
const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/admin/,''));
  if(!file.startsWith(root+sep))return res.writeHead(403).end();
  try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    let fail=false,posts=0;
    const messages=[{id:'initial',body:'پیام واقعی در قرارداد آزمایشی',authorId:'patient',createdAt:'2026-11-01T08:00:00Z'}];
    const token='fixture.'+Buffer.from(JSON.stringify({sub:'specialist'})).toString('base64url')+'.signature';
    await page.route('**/v1/**',route=>{
      const path=new URL(route.request().url()).pathname,method=route.request().method();
      const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(path.endsWith('/auth/refresh'))return reply({role:'specialist',accessToken:token,sessionExpiresAt:new Date(Date.now()+3600000).toISOString()});
      if(path.endsWith('/specialist/queue'))return reply([]);
      if(path.endsWith('/conversations'))return reply([{id:'live-fixture',kind:'specialist',createdAt:'2026-11-01T08:00:00Z'}]);
      if(path.endsWith('/messages')&&method==='POST'){posts++;if(fail)return reply({detail:'خطای آزمایشی سرور'},503);const data={id:'sent-'+posts,body:route.request().postDataJSON().body,authorId:'specialist',createdAt:new Date().toISOString()};messages.push(data);return reply({id:data.id});}
      if(path.endsWith('/messages'))return reply(messages);
      if(path.endsWith('/read'))return reply({ok:true});
      return reply([]);
    });
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/specialist.html#conversations');
    await page.getByText('پیام واقعی در قرارداد آزمایشی',{exact:true}).waitFor();
    await page.getByLabel('متن پیام').fill('<script>alert("xss")</script>');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
    await page.locator('.chat-message.mine').filter({hasText:'ارسال‌شده'}).waitFor();assert.equal(posts,1);assert.equal(await page.locator('.chat-message script').count(),0);
    fail=true;await page.getByLabel('متن پیام').fill('پیام قابل تلاش مجدد');await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();await page.getByRole('button',{name:'تلاش مجدد',exact:true}).waitFor();
    fail=false;await page.getByRole('button',{name:'تلاش مجدد',exact:true}).click();await page.getByRole('button',{name:'تلاش مجدد',exact:true}).waitFor({state:'hidden'});
    const photo={name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};
    await page.locator('input[type=file]').setInputFiles(photo);assert(await page.getByRole('button',{name:'ارسال پیام',exact:true}).isDisabled());
    assert.equal(posts,3);await page.getByRole('button',{name:'حذف پیوست',exact:true}).click();
    await page.getByRole('button',{name:'باز کردن پیام‌رسان نمونه',exact:true}).click();await page.getByText('سلام، برای تهیه شام زمان کمتری دارم.',{exact:false}).waitFor();
    await page.locator('input[type=file]').setInputFiles(photo);await page.getByRole('button',{name:'ارسال پیام',exact:true}).click();
    await page.locator('.chat-message img').waitFor();await page.locator('.chat-message img').click();assert(await page.locator('dialog.media-viewer').isVisible());await page.getByRole('button',{name:'بستن عکس',exact:true}).click();
    await page.getByRole('button',{name:'ضبط ویس',exact:true}).click();await page.getByRole('button',{name:/توقف و پیش‌نمایش/}).waitFor();
    await page.waitForTimeout(1250);await page.getByRole('button',{name:/توقف و پیش‌نمایش/}).click();await page.locator('.attachment-preview audio').waitFor();
    await page.getByRole('button',{name:'حذف پیوست',exact:true}).click();
    // Permission denial is actionable and never creates a voice message.
    await page.evaluate(()=>{window.originalGetUserMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
    await page.getByRole('button',{name:'ضبط ویس',exact:true}).click();await page.getByRole('alert').filter({hasText:'اجازه میکروفن داده نشد'}).waitFor();
    await page.evaluate(()=>navigator.mediaDevices.getUserMedia=window.originalGetUserMedia);
    const shots=resolve(__dirname,'../screenshots/phase7');await mkdir(shots,{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(shots,'specialist-chat-demo.png'),fullPage:true});
    await page.getByRole('button',{name:'درخواست‌های تغییر برنامه',exact:true}).click();await page.getByRole('button',{name:'باز کردن درخواست‌های تغییر نمونه',exact:true}).click();
    await page.getByRole('button',{name:'جزئیات درخواست',exact:true}).click();await page.getByRole('button',{name:'شروع بررسی',exact:true}).click();
    await page.getByRole('button',{name:'رد درخواست با توضیح',exact:true}).click();await page.getByRole('alert').filter({hasText:'دلیل رد الزامی است'}).waitFor();
    await page.getByLabel('توضیح رد یا سؤال از کاربر').fill('برای شام چند دقیقه زمان داری؟');await page.getByRole('button',{name:'درخواست توضیح از کاربر',exact:true}).click();
    await page.getByText('در انتظار پاسخ کاربر:',{exact:false}).first().waitFor();assert(await page.getByRole('button',{name:'ویرایش و تأیید برنامه جایگزین',exact:true}).isDisabled());
    await page.getByRole('button',{name:'شبیه‌سازی پاسخ کاربر',exact:true}).click();assert(await page.getByRole('button',{name:'ویرایش و تأیید برنامه جایگزین',exact:true}).isEnabled());
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(shots,'change-request-demo.png'),fullPage:true});
    await page.getByRole('button',{name:'گفتگو با کاربر',exact:true}).click();assert.equal(await page.locator('.change-detail').count(),0);assert.equal(await page.getByRole('button',{name:'شروع بررسی',exact:true}).count(),0);
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Transaction boundary: publication failure leaves approved status and old plan untouched.
    await page.evaluate(async()=>{
      const repo=SabzineMessagingRepository.sample(),id='change-demo';await repo.start(id);await repo.answer(id);
      const clinical=repo.replacement(id),r=await clinical.get();for(const d of r.version.days)for(const m of d.meals)for(const a of m.alternatives){a.approved=true;a.reviewedBy='demo-specialist';a.reviewedAt=new Date().toISOString();}
      await clinical.save(r,r.version.days);for(const q of (await clinical.get()).questions)await clinical.acknowledge(q.id);
      const saved=await clinical.get(),old=JSON.stringify(saved.published);clinical.setFailures(false,true);
      let failed=false;try{await clinical.publish(saved);}catch{failed=true;}
      if(!failed||(await repo.detail(id)).status!=='under_review'||JSON.stringify((await clinical.get()).published)!==old)throw new Error('failed publication changed active plan');
      clinical.setFailures(false,false);await clinical.publish(await clinical.get());
      if((await repo.detail(id)).status!=='approved')throw new Error('approval missing');
      const chat=await repo.messages('chat-demo');if(!chat.items.some(m=>m.body==='برنامه جدید در پنل شما قرار گرفت.'))throw new Error('system message missing');
      const rejected=SabzineMessagingRepository.sample();await rejected.start(id);await rejected.reject(id,'برنامه فعلی مناسب است');
      if((await rejected.detail(id)).status!=='rejected')throw new Error('rejection missing');
      let invalid=false;try{SabzineMessagingRepository.validate(new File(['x'],'x.svg',{type:'image/svg+xml'}));}catch{invalid=true;}if(!invalid)throw new Error('unsupported upload accepted');
      const paged=SabzineMessagingRepository.sample();for(let i=0;i<33;i++)await paged.send('chat-demo','پیام '+i);const page1=await paged.messages('chat-demo'),page2=await paged.messages('chat-demo',page1.nextCursor);if(page1.items.length!==30||page2.items.length!==4)throw new Error('pagination failed');
    });
    assert.deepEqual(errors,[]);console.log('Phase 7 messaging browser contracts passed');
  }finally{await browser.close();server.close();}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
