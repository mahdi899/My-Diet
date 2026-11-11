const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../onboarding/tracking.js'),'utf8');
let sequence=0;
function load(path,storage=new Map()) {
  const events=[],listeners={};
  const url=new URL(path,'https://my-diet.ir');
  const context={location:{pathname:url.pathname,search:url.search,origin:url.origin},navigator:{},
    localStorage:{getItem:()=>null},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`},
    performance:{now:()=>0},setInterval:()=>{},URL,URLSearchParams,
    addEventListener:(name,fn)=>listeners[name]=fn,
    document:{hidden:false,addEventListener:()=>{},createElement:()=>({dataset:{}}),head:{append:()=>{}}},
  };
  context.window=context;context.MYDIET_TRACKING={websiteId:'test'};
  context.umami={track:(name,data)=>events.push({name,data})};
  vm.runInNewContext(source,context);
  return {id:events.find(e=>e.name==='step_view').data.journey,context,listeners};
}
test('navigation shares a path, restarting and separate tabs get independent paths',()=>{
  const storage=new Map();
  const intro=load('/onboarding/',storage),goals=load('/onboarding/goals.html',storage),quiz=load('/onboarding/quiz.html',storage);
  assert.equal(intro.id,goals.id);assert.equal(goals.id,quiz.id);
  assert.notEqual(load('/onboarding/quiz.html',storage).id,quiz.id,'reload resets answers and starts a new path');
  assert.notEqual(load('/onboarding/quiz.html').id,quiz.id,'new tab isolates path');
  const restart=load('/onboarding/goals.html',storage);
  assert.notEqual(restart.id,quiz.id);
  assert.equal(load('/onboarding/quiz.html',storage).id,restart.id);
  intro.listeners.pageshow({persisted:true});
  assert.notEqual(JSON.parse(storage.get('mydiet.analytics.journey')).id,quiz.id);
  quiz.listeners.pageshow({persisted:true});
  assert.equal(JSON.parse(storage.get('mydiet.analytics.journey')).id,quiz.id,'restoring quiz preserves its original path');
  assert.notEqual(load('/onboarding/quiz.html?goal=detox',storage).id,quiz.id,'direct goal change starts a new path');
});
test('privacy filter preserves only the anonymous journey and allowed fields',()=>{
  const {id,context}=load('/onboarding/quiz.html');
  const result=context.mydietBeforeSend('event',{url:'/onboarding/quiz.html?phone=private',data:{journey:id,phone:'private',answer:'private',step:'question:detox:24'}});
  assert.equal(result.data.journey,id);assert.equal(result.data.phone,undefined);
  assert.equal(result.data.answer,undefined);assert.equal(result.url,'/onboarding/quiz.html');
});

test('checkout preserves campaign attribution without exposing order parameters', () => {
  const storage = new Map();
  const intro = load('/onboarding/?utm_campaign=telegram-launch&utm_source=telegram', storage);
  load('/onboarding/goals.html', storage);
  load('/onboarding/quiz.html', storage);
  const payment = load('/onboarding/payment.html?order=private', storage);
  assert.equal(payment.id, intro.id);
  const payload = payment.context.mydietBeforeSend('event', {
    url: '/onboarding/payment.html?order=private',
    data: { step: 'payment_gateway', journey: payment.id },
  });
  assert.equal(payload.url, '/onboarding/payment.html?utm_source=telegram&utm_campaign=telegram-launch');
  assert.equal(payload.data.step, 'payment_gateway');
});
