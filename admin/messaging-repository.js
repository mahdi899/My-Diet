/* Phase 7 adapters. No live attachment/revision endpoint is assumed to exist. */
(() => {
  const copy=value=>structuredClone(value);
  const statuses={awaiting_review:'در انتظار بررسی',under_review:'در حال بررسی توسط متخصص',rejected:'رد شده',approved:'تأیید شده'};
  const initialReasons=['غذاها را دوست ندارم','تهیه غذا زمان‌بر است','هزینه غذا بالاست','مواد اولیه موجود نیست','شرایطم تغییر کرده'];
  function reasons(){try{const r=JSON.parse(localStorage.getItem('sabzine.demo.change-reasons'));if(Array.isArray(r)&&r.length&&r.every(x=>typeof x.label==='string'&&typeof x.active==='boolean'))return r;}catch{}return initialReasons.map((label,i)=>({id:'reason-'+i,label,active:true}));}
  function validate(file){
    if(!file||file.size<1||file.size>10*1024*1024)throw new Error('فایل باید بین ۱ بایت و ۱۰ مگابایت باشد.');
    if(!['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/wav','audio/mp4'].includes(file.type.split(';')[0]))throw new Error('نوع فایل پشتیبانی نمی‌شود.');
  }
  function live(session){return {
    demo:false,media:false,revisions:false,
    list:()=>session.api('conversations'),
    async messages(id){const r=await session.api('conversations/'+encodeURIComponent(id)+'/messages');return Array.isArray(r)?{items:r,nextCursor:null}:r;},
    send:(id,body)=>session.api('conversations/'+encodeURIComponent(id)+'/messages','POST',{body}),
    read:id=>session.api('conversations/'+encodeURIComponent(id)+'/read','POST'),
    changes:()=>session.api('specialist/queue?bucket=revisions'),
    detail:id=>session.api('specialist/requests/'+encodeURIComponent(id)),
    get actorId(){return session.actorId;},
  };}
  function sample(){
    const clinical=SabzineClinicalRepository.sample();
    const conversations=[
      {id:'chat-demo',kind:'specialist',title:'کاربر نمونهٔ آموزشی',unreadCount:1,requestId:'change-demo',createdAt:'2026-11-01T07:00:00Z'},
      {id:'chat-demo-2',kind:'specialist',title:'کاربر نمونهٔ دوم',unreadCount:0,requestId:'change-demo-2',createdAt:'2026-11-03T08:00:00Z'},
    ];
    const messages=[{id:'hello',authorId:'sample-patient',body:'سلام، برای تهیه شام زمان کمتری دارم. می‌توانیم درباره برنامه صحبت کنیم؟',createdAt:'2026-11-01T07:01:00Z',status:'sent'}];
    const requests=[
      {id:'change-demo',displayName:'کاربر نمونهٔ آموزشی',planId:'published-demo-v1',status:'awaiting_review',conversationId:'chat-demo',reasons:['تهیه غذا زمان‌بر است'],details:'شام‌های سریع‌تر ترجیح می‌دهم.',createdAt:'2026-11-01T07:05:00Z',history:[{status:'awaiting_review',at:'2026-11-01T07:05:00Z'}],awaitingCustomer:false,rejection:''},
      {id:'change-demo-2',displayName:'کاربر نمونهٔ دوم',planId:'published-demo-v2',status:'awaiting_review',conversationId:'chat-demo-2',reasons:['هزینه غذا بالاست','مواد اولیه موجود نیست'],details:'وعده‌های ارزان‌تر و با مواد در دسترس می‌خواهم.',createdAt:'2026-11-03T08:20:00Z',history:[{status:'awaiting_review',at:'2026-11-03T08:20:00Z'}],awaitingCustomer:false,rejection:''},
    ];
    let failSend=false;
    const find=id=>{const r=requests.find(r=>r.id===id);if(!r)throw new Error('درخواست پیدا نشد.');return r;};
    const transition=(r,status,body)=>{r.status=status;r.history.push({status,at:new Date().toISOString(),body});};
    const addSystem=body=>messages.push({id:crypto.randomUUID(),kind:'system',body,createdAt:new Date().toISOString(),status:'sent'});
    return {
      demo:true,media:true,revisions:true,actorId:'demo-specialist',clinical,
      async list(){return copy(conversations);},
      async messages(_id,cursor){const end=cursor?Number(cursor):messages.length,start=Math.max(0,end-30);return {items:copy(messages.slice(start,end)),nextCursor:start?String(start):null};},
      async read(){conversations[0].unreadCount=0;},
      async send(_id,body,attachment,{signal,onProgress}={}){
        if(!attachment&&(!body.trim()||body.length>2000))throw new Error('پیام باید بین ۱ تا ۲۰۰۰ کاراکتر باشد.');
        if(attachment)validate(attachment);
        for(let i=1;i<=4;i++){await new Promise(r=>setTimeout(r,70));if(signal?.aborted)throw new DOMException('ثبت لغو شد','AbortError');onProgress?.(i/4);}
        if(failSend){failSend=false;throw new Error('خطای ارسال در سناریوی نمونه');}
        const m={id:crypto.randomUUID(),body,authorId:'demo-specialist',createdAt:new Date().toISOString(),status:'sent',kind:attachment?(attachment.type.startsWith('image/')?'photo':'voice'):'text',attachment};messages.push(m);return copy(m);
      },
      async changes(){return copy(requests);},async detail(id){return copy(find(id));},
      async start(id){const r=find(id);if(r.status!=='awaiting_review')throw new Error('این درخواست قبلاً بررسی شده است.');transition(r,'under_review');return copy(r);},
      async reject(id,explanation){const r=find(id);if(r.status!=='under_review'||!explanation.trim())throw new Error('بررسی را شروع و دلیل رد را بنویسید.');r.rejection=explanation.trim();r.awaitingCustomer=false;transition(r,'rejected',r.rejection);addSystem('درخواست تغییر برنامه رد شد: '+r.rejection);return copy(r);},
      async clarify(id,prompt){const r=find(id);if(r.status!=='under_review'||!prompt.trim())throw new Error('بررسی را شروع و سؤال را بنویسید.');r.awaitingCustomer=true;r.clarification=prompt.trim();r.history.push({status:r.status,at:new Date().toISOString(),body:'در انتظار پاسخ کاربر: '+prompt});messages.push({id:crypto.randomUUID(),authorId:'demo-specialist',body:prompt,createdAt:new Date().toISOString(),status:'sent'});return copy(r);},
      async answer(id){const r=find(id);r.awaitingCustomer=false;r.history.push({status:r.status,at:new Date().toISOString(),body:'پاسخ نمونه کاربر: شام زیر ۲۰ دقیقه ترجیح می‌دهم.'});await clinical.answer();return copy(r);},
      replacement(id){const r=find(id);if(r.status!=='under_review'||r.awaitingCustomer)throw new Error('ابتدا بررسی را شروع کنید و پاسخ لازم را بگیرید.');return {...clinical,
        async publish(request){if(r.status!=='under_review'||r.awaitingCustomer)throw new Error('درخواست هنوز قابل تأیید نیست.');
          // State changes follow successful publication, never precede it.
          const result=await clinical.publish(request);transition(r,'approved');addSystem('برنامه جدید در پنل شما قرار گرفت.');return result;},
      };},
      setFailSend(value){failSend=value;},
    };
  }
  globalThis.SabzineMessagingRepository={live,sample,statuses,reasons,validate};
})();
