/* End-to-end smoke test. Browser telemetry is tagged qa and excluded from reports. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.TEMP,'mydiet-browser-check/node_modules/playwright-core'));
const credentials=JSON.parse(fs.readFileSync('backend/.env.local-admin.json','utf8'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const bodies=[],errors=[],responses=[];
  try {
    const context=await browser.newContext({viewport:{width:1366,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'});
    await context.route('**/insights/api/send',async route=>{
      const body=route.request().postDataJSON();body.payload.tag='qa';bodies.push(body);
      await route.continue({postData:JSON.stringify(body)});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/insights/api/send'))responses.push(r.status());});
    await page.goto('https://my-diet.ir/demo/?utm_source=tracking_qa&utm_medium=test&utm_campaign=smoke&phone=PRIVATE_MARKER');
    await page.waitForFunction(()=>!!window.umami&&!!window.demoTracking);
    await page.locator('#letsGoBtn').click();await page.waitForURL('**/goals.html*');
    await page.locator('#goalsGrid .goal-card').first().click();await page.waitForURL('**/quiz.html*');
    await page.locator('input[data-field-index]').fill('PRIVATE_MEDICAL_MARKER');
    await page.locator('[data-field-submit]').click();
    await page.locator('[data-q-index]').first().waitFor();
    await page.waitForTimeout(11000);
    await page.locator('[data-q-index]').first().click();await page.waitForTimeout(700);
    await page.goBack();await page.waitForURL('**/goals.html*');await page.waitForTimeout(1000);
    assert(!JSON.stringify(bodies).includes('PRIVATE_'),'Input/query data leaked into telemetry');
    for(const event of ['goal_selected','step_view','question_interacted','step_time'])assert(bodies.some(b=>b.payload.name===event),'Missing event '+event);
    assert(responses.length>0&&responses.every(s=>s===200),'Collector rejected requests: '+responses.join(','));
    assert.deepEqual(errors,[]);
    const unauthorized=await fetch('https://my-diet.ir/v1/admin/web-analytics');assert.equal(unauthorized.status,401);
    const login=await fetch('https://my-diet.ir/v1/auth/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:credentials.adminUsername,password:credentials.adminPassword})});
    assert.equal(login.status,201);const session=await login.json();
    const headers={Authorization:'Bearer '+session.accessToken};
    const response=await fetch('https://my-diet.ir/v1/admin/web-analytics?days=7',{headers});assert.equal(response.status,200);
    const report=await response.json();assert(!report.sources.some(s=>s.source==='tracking_qa'),'QA traffic leaked into reporting');
    assert.equal((await fetch('https://my-diet.ir/v1/admin/web-analytics?days=999',{headers})).status,400);
    await page.goto('https://my-diet.ir/admin/?v=tracking-2#web-analytics');
    await page.locator('[name=username]').fill(credentials.adminUsername);
    await page.locator('#login-password').fill(credentials.adminPassword);
    await page.locator('#login-form [type=submit]').click();
    await page.locator('#panel').waitFor({state:'visible'});
    await page.getByText('آخرین مرحلهٔ نشست‌های غیرفعال',{exact:true}).waitFor();
    await page.screenshot({path:'screenshots/admin-demo-analytics.png',fullPage:true});
    assert.equal((await fetch('https://my-diet.ir/v1/admin/web-analytics?days=7')).status,401,'Authenticated report leaked through cache');
    assert.deepEqual(errors,[]);
    console.log('PASS: demo navigation/back, event delivery, private-data stripping, active time, admin authentication, QA exclusion, report rendering');
    console.log('Captured QA requests: '+bodies.length+'; live report visits: '+report.summary.visits);
    await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
