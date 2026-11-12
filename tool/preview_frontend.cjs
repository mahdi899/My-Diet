// Local-only static frontend preview with an optional existing-API proxy.
const http = require('node:http');
const https = require('node:https');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { resolve, sep, extname } = require('node:path');
const root = resolve(__dirname,'..');
const apiTarget = new URL(process.env.SABZINE_API_TARGET || 'http://127.0.0.1:3000');
const onboardingDir = existsSync(resolve(root, 'onboarding')) ? resolve(root, 'onboarding') : resolve(root, '..', 'onboarding');
const mounts = {admin:resolve(root,'admin'),doctor:resolve(root,'doctor'),app:resolve(root,'app/build/web'),site:resolve(root,'site'),onboarding:onboardingDir};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm'};
http.createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url.startsWith('/local/food-photo')){
    const chunks=[];
    req.on('data',chunk=>{chunks.push(chunk);});
    req.on('end',async()=>{
      try{
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!/^[a-z][a-z0-9_]{1,63}$/.test(body.slug||''))throw new Error('slug');
        const bytes=Buffer.from(String(body.jpeg||'').replace(/^data:image\/jpeg;base64,/,''),'base64');
        if(bytes.length<32||bytes.length>1500000||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('jpeg');
        const dir=resolve(root,'site','assets','foods');
        const file=resolve(dir,body.slug+'.jpg');
        if(!file.startsWith(dir+sep))throw new Error('path');
        await mkdir(dir,{recursive:true});
        await writeFile(file,bytes);
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({image:'/assets/foods/'+body.slug+'.jpg'}));
      }catch{if(!res.headersSent)res.writeHead(400).end('bad photo');}
    });
    return;
  }
  if(req.url.startsWith('/assets/foods/')){
    try{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.split('/').pop()||'');
      if(!/^[a-z0-9_-]+\.jpg$/.test(name))throw new Error('name');
      const file=resolve(root,'site','assets','foods',name);
      const body=await readFile(file);
      res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store'});res.end(body);
    }catch{res.writeHead(404).end();}
    return;
  }
  if(req.url.startsWith('/health/')||req.url.startsWith('/v1/')){
    const upstream=(apiTarget.protocol==='https:'?https:http).request(new URL(req.url,apiTarget),{
      method:req.method,headers:{...req.headers,host:apiTarget.host},timeout:15000,
    },response=>{
      const headers={...response.headers};
      const cookies=headers['set-cookie'];
      if(cookies){
        const list=Array.isArray(cookies)?cookies:[cookies];
        headers['set-cookie']=list.map(c=>c.replace(/;\s*Domain=[^;]*/gi,'').replace(/;\s*Secure/gi,''));
      }
      res.writeHead(response.statusCode,headers);response.pipe(res);
    });
    upstream.on('timeout',()=>upstream.destroy());
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({detail:'سرور در دسترس نیست. اتصال API را بررسی کنید.'}));});
    req.pipe(upstream);return;
  }
  try{
    const url=new URL(req.url,'http://localhost'),parts=decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if(parts[0]==='demo'){const rest=parts.slice(1).join('/');res.writeHead(301,{Location:'/onboarding/'+(rest?rest+(url.pathname.endsWith('/')?'/':''):'')}).end();return;}
    const mount=parts.shift();
    if(!mount){res.writeHead(302,{Location:'/app/'}).end();return;}
    if(!mounts[mount]){res.writeHead(404).end();return;}
    if(!parts.length&&!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'}).end();return;}
    const file=resolve(mounts[mount],parts.join('/')||'index.html');
    if(!file.startsWith(mounts[mount]+sep)){res.writeHead(403).end();return;}
    let body=await readFile(file);
    // Keep the standard root-hosted Flutter build usable under this preview mount.
    if(mount==='app' && file===resolve(mounts.app,'index.html')) {
      let html=body.toString('utf8').replace('<base href="/">','<base href="/app/">');
      if(!html.includes('preview-sw-unregister')) {
        html=html.replace('</head>','<script id="preview-sw-unregister">navigator.serviceWorker?.getRegistrations?.().then((rs)=>rs.forEach((r)=>r.unregister()))</script></head>');
      }
      body=Buffer.from(html);
    }
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.SABZINE_PREVIEW_PORT||8781),'127.0.0.1',()=>console.log('Sabzine frontend preview: http://127.0.0.1:8781/app/ · /admin/ · /doctor/ · /site/ · /onboarding/'));
