// API-only production smoke test; creates and removes its own isolated fixture.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const config=JSON.parse(fs.readFileSync('backend/.env.local-admin.json','utf8'));
const origin='https://my-diet.ir',slug='qa-'+crypto.randomUUID();
let id;
(async()=>{
  const login=await fetch(origin+'/v1/auth/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:config.adminUsername,password:config.adminPassword})});
  assert.equal(login.status,201);const token=(await login.json()).accessToken;
  const api=(path,method='GET',body)=>fetch(origin+'/v1/admin/campaign-links'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  try {
    assert.equal((await fetch(origin+'/v1/admin/campaign-links')).status,401);
    assert.equal((await api('','POST',{name:'QA',slug:'../bad',source:'telegram'})).status,400);
    const created=await api('','POST',{name:'آزمایش خودکار لینک',slug,source:'telegram'});assert.equal(created.status,201);id=(await created.json()).id;
    assert.match(id,/^[a-f0-9-]{36}$/);
    assert.equal((await api('','POST',{name:'QA duplicate',slug,source:'telegram'})).status,409);
    const open=()=>fetch(origin+'/go/'+slug,{redirect:'manual'});
    const first=await open();assert.equal(first.status,302);assert.match(first.headers.get('location'),/\/demo\/\?utm_source=telegram&utm_medium=campaign&utm_campaign=qa-/);assert.match(first.headers.get('cache-control'),/no-store/);
    assert.equal((await api('/'+id,'PATCH',{active:false})).status,200);
    for(let i=0;i<3;i++){const stopped=await open();assert.equal(stopped.status,410);assert.equal(stopped.headers.get('location'),null);assert.match(stopped.headers.get('cache-control'),/no-store/);}
    assert.equal((await api('/'+id,'PATCH',{active:true})).status,200);assert.equal((await open()).status,302);
    await fetch(origin+'/go/'+slug,{method:'HEAD',redirect:'manual'});
    const row=(await (await api('')).json()).find(r=>r.id===id);assert.equal(Number(row.opens),2);
    assert.equal((await fetch(origin+'/go/missing-'+slug,{redirect:'manual'})).status,410);
    console.log('PASS: admin authorization, validation, unique suffix, attributed redirect, immediate public disable after warm redirect, reactivation, HEAD count, no-store');
  } finally {
    if(id&&/^[a-f0-9-]{36}$/.test(id))execFileSync('ssh',['-o','BatchMode=yes','-i','C:/Users/PC/.ssh/id_ed25519','root@87.107.190.112',`docker exec sabzine-postgres psql -U sabzine -d sabzine -c "delete from demo_campaign_links where id='${id}';"`],{stdio:'pipe'});
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
