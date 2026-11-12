import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

type TrackingPayload = {url:string;referrer?:string;data?:Record<string,unknown>};
type TrackingWindow = {
  MYDIET_TRACKING:{websiteId:string};
  umami?:{track:(name:unknown,data:Record<string,unknown>)=>Promise<void>};
  mydietBeforeSend:(type:string,payload:TrackingPayload)=>false|(TrackingPayload&{data:Record<string,unknown>});
  demoTracking?:unknown;
};

const source=readFileSync(new URL('../../../onboarding/tracking.js',import.meta.url),'utf8');
function browser(disabled=false) {
  let now=0;
  const events: Array<{name:unknown;data:Record<string,unknown>}> = [];
  const listeners: Record<string,(e?:unknown)=>void>={};
  let tick=()=>{};
  const window={MYDIET_TRACKING:{websiteId:'00000000-0000-4000-8000-000000000001'}} as TrackingWindow;
  const document={hidden:false,addEventListener:(type:string,fn:()=>void)=>{listeners[type]=fn;},createElement:()=>({dataset:{}}),head:{append:(script:{onload:()=>void})=>{
    window.umami={track:(name:unknown,data:Record<string,unknown>)=>{events.push({name,data});return Promise.resolve();}};script.onload();
  }}};
  const storage=new Map<string,string>();
  vm.runInNewContext(source,{window,document,navigator:{doNotTrack:disabled?'1':'0'},crypto:{randomUUID},sessionStorage:{getItem:(key:string)=>storage.get(key),setItem:(key:string,value:string)=>storage.set(key,value)},localStorage:{getItem:()=>null},location:{pathname:'/onboarding/quiz.html',origin:'https://my-diet.ir'},URL,URLSearchParams,performance:{now:()=>now},setInterval:(fn:()=>void)=>{tick=fn;},addEventListener:(type:string,fn:()=>void)=>{listeners[type]=fn;}});
  return {window,document,events,listeners,tick:()=>tick(),time:(n:number)=>{now=n;}};
}
test('tracking strips arbitrary URL, referrer and answer values',()=>{
  const b=browser();
  const safe=b.window.mydietBeforeSend('event',{url:'/onboarding/quiz.html?goal=weight_loss&utm_source=telegram&phone=09120000000&answer=medical',referrer:'https://example.com/private?token=secret',data:{step:'question:weight_loss:3',goal:'weight_loss',question:3,answer:'medical',phone:'09120000000',activeMs:5000}});
  assert.ok(safe);
  assert.equal(safe.url,'/onboarding/quiz.html?utm_source=telegram&goal=weight_loss');
  assert.equal(safe.referrer,'https://example.com');
  assert.deepEqual(Object.keys(safe.data).sort(),['activeMs','goal','question','step']);
  assert.equal(b.window.mydietBeforeSend('error',{url:'/onboarding/'}),false);
});
test('hidden time and prolonged inactivity are excluded from active duration',()=>{
  const b=browser();b.time(10000);b.tick();
  b.document.hidden=true;b.listeners.visibilitychange();b.time(20000);b.tick();
  b.document.hidden=false;b.listeners.visibilitychange();
  for(let n=30000;n<=100000;n+=10000){b.time(n);b.tick();}
  const ms=b.events.filter(e=>e.name==='step_time').reduce((sum,e)=>sum+Number(e.data.activeMs),0);
  assert.equal(ms,70000);
});
test('DNT disables the tracker without touching the page',()=>{
  const b=browser(true);assert.equal(b.window.demoTracking,undefined);assert.equal(b.events.length,0);
});
test('the path id is readable and the phone never enters the event',()=>{
  const b=browser();
  const tracking=b.window.demoTracking as {journeyId:()=>string;registered:()=>void};
  assert.match(tracking.journeyId(),/^[0-9a-f-]{36}$/i);
  tracking.registered();
  const registered=b.events.filter(event=>event.name==='phone_registered');
  assert.equal(registered.length>0,true);
  assert.equal(registered.at(-1)?.data.phone,undefined);
  assert.equal(registered.at(-1)?.data.journey,tracking.journeyId());
});
