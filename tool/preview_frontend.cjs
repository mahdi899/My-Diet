// Local-only static frontend preview with an optional existing-API proxy.
const http = require('node:http');
const https = require('node:https');
const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { resolve, sep, extname } = require('node:path');
const root = resolve(__dirname,'..');
const apiTarget = new URL(process.env.SABZINE_API_TARGET || 'http://127.0.0.1:3000');
const demoDir = existsSync(resolve(root, 'demo')) ? resolve(root, 'demo') : resolve(root, '..', 'demo');
const mounts = {admin:resolve(root,'admin'),app:resolve(root,'app/build/web'),site:resolve(root,'site'),demo:demoDir};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm'};
http.createServer(async(req,res)=>{
  if(req.url.startsWith('/v1/')){
    const upstream=(apiTarget.protocol==='https:'?https:http).request(new URL(req.url,apiTarget),{
      method:req.method,headers:{...req.headers,host:apiTarget.host},timeout:15000,
    },response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
    upstream.on('timeout',()=>upstream.destroy());
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({detail:'سرور در دسترس نیست. اتصال API را بررسی کنید.'}));});
    req.pipe(upstream);return;
  }
  try{
    const url=new URL(req.url,'http://localhost'),parts=decodeURIComponent(url.pathname).split('/').filter(Boolean),mount=parts.shift();
    if(!mount){res.writeHead(302,{Location:'/app/'}).end();return;}
    if(!mounts[mount]){res.writeHead(404).end();return;}
    if(!parts.length&&!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'}).end();return;}
    const file=resolve(mounts[mount],parts.join('/')||'index.html');
    if(!file.startsWith(mounts[mount]+sep)){res.writeHead(403).end();return;}
    let body=await readFile(file);
    // Keep the standard root-hosted Flutter build usable under this preview mount.
    if(mount==='app' && file===resolve(mounts.app,'index.html')) {
      body=Buffer.from(body.toString('utf8').replace('<base href="/">','<base href="/app/">'));
    }
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.SABZINE_PREVIEW_PORT||8781),'127.0.0.1',()=>console.log('Sabzine frontend preview: http://127.0.0.1:8781/app/ · /admin/ · /admin/specialist.html · /site/ · /demo/'));
