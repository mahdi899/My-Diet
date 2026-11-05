const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(path.join(process.env.TEMP,'mydiet-browser-check/node_modules/playwright-core'));
const c=JSON.parse(fs.readFileSync('backend/.env.local-admin.json','utf8'));
const id=crypto.randomUUID(),origin='https://my-diet.ir';
const ssh=sql=>execFileSync('ssh',['-o','BatchMode=yes','-i','C:/Users/PC/.ssh/id_ed25519','root@87.107.190.112',sql],{encoding:'utf8'});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const login=await fetch(origin+'/v1/auth/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.adminUsername,password:c.adminPassword})});assert.equal(login.status,201);const token=(await login.json()).accessToken;
  const report=async()=>{const r=await fetch(origin+'/v1/admin/web-analytics?days=7',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);return r.json();};
  const baseline=await report();assert.equal(typeof baseline.activeSessions,'number');assert.equal(baseline.journeys,undefined);
  if(baseline.goals.length)assert(Math.abs(baseline.goals.reduce((n,r)=>n+r.percent,0)-100)<0.5);
  const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'});
  await context.route('**/insights/api/send',async route=>{const data=route.request().postDataJSON();data.payload.tag='integration-live-check';await route.continue({postData:JSON.stringify(data)});});
  const visitor=await context.newPage();await visitor.goto(origin+'/demo/?utm_source=integration_live_check');await visitor.waitForFunction(()=>!!window.umami);await visitor.waitForTimeout(2000);
  const during=await report();assert(during.activeSessions>=1,'Foreground session not active');
  await context.close();await new Promise(r=>setTimeout(r,3000));
  const ended=await report();assert(ended.activeSessions<during.activeSessions,'Closed session did not leave active count');
  const body={id,phone:'09120000099',goal:'weight_loss',answers:Array.from({length:27},()=>({question:'Integration check',answer:'private fixture'}))};
  for(let i=0;i<2;i++){const r=await fetch(origin+'/v1/demo/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,201);assert.equal((await r.json()).phoneVerified,false);}
  const stored=ssh(`docker exec sabzine-postgres psql -U sabzine -d sabzine -Atc "select count(*) from demo_lead_submissions where id='${id}' and phone_encrypted like 'enc1:%' and answers_encrypted like 'enc1:%' and phone_verified=false"`);assert.equal(stored.trim(),'1');
  const admin=await browser.newPage();await admin.goto(origin+'/admin/?v=live-3#web-analytics');await admin.locator('[name=username]').fill(c.adminUsername);await admin.locator('#login-password').fill(c.adminPassword);await admin.locator('#login-form button[type=submit]').click();await admin.getByText('ریزش کاربران بر اساس صفحه و سؤال',{exact:true}).waitFor();
  const status=admin.getByRole('status').filter({hasText:'نشست فعال اکنون'});const first=await status.textContent();await admin.waitForTimeout(6000);assert.notEqual(await status.textContent(),first,'Report did not refresh automatically');
  await admin.screenshot({path:'screenshots/admin-demo-analytics.png',fullPage:false});
  console.log('PASS: click percentages, aggregate-only report, active session increase/decrease, encrypted idempotent lead save, automatic live updates');
 }finally{
  await browser.close();
  ssh(`docker exec sabzine-postgres psql -U sabzine -d umami -c "delete from event_data where website_event_id in(select event_id from website_event where tag='integration-live-check');delete from website_event where tag='integration-live-check';"`);
  ssh(`docker exec sabzine-postgres psql -U sabzine -d sabzine -c "delete from demo_lead_submissions where id='${id}';"`);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
