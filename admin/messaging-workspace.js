(() => {
  const {element:e,date}=WorkspaceUI;
  let active=null;
  const button=(label,action,disabled=false)=>{const b=e('button',label,'secondary');b.type='button';b.onclick=action;b.disabled=disabled;return b;};
  function leave(){if(active?.dirty&&!confirm('پیام یا رسانهٔ ارسال‌نشده کنار گذاشته شود؟'))return false;reset();return true;}
  function reset(){active?.dispose();active=null;}
  function chat({repository,session,conversationId}){
    reset();
    const root=e('section',null,'messaging-workspace'),list=e('aside',null,'conversation-list'),room=e('section',null,'conversation-room');root.append(list,room);
    let alive=true,selected=null,sequence=0,cursor=null,messages=[],pending=[],attachment=null,recording=null,stream=null,timer=null,seconds=0,discardRecording=false,voiceStarting=false,submitting=false;
    const urls=new Set(),uploads=new Set();
    const valid=()=>alive&&session.active;
    const alert=e('p',null,'chat-error');alert.setAttribute('role','alert');
    const title=e('h2','گفتگو با کاربر'),note=e('p',repository.demo?'نسخه نمایشی • هیچ پیامی به بیمار واقعی ارسال نمی‌شود.':'ارسال متنی متصل است؛ دریافت پیام با تازه‌سازی انجام می‌شود.','chat-note');
    const timeline=e('div',null,'chat-timeline');timeline.setAttribute('aria-label','پیام‌ها');
    const preview=e('div',null,'attachment-preview');preview.hidden=true;
    const compose=e('form',null,'chat-compose'),bar=e('div',null,'composer-bar'),input=e('textarea');input.rows=1;input.maxLength=2000;input.placeholder='پیام';input.setAttribute('aria-label','متن پیام');
    const iconButton=(name,label,action)=>{const b=e('button',null,'composer-icon');b.type='button';b.setAttribute('aria-label',label);b.append(icon(name));b.onclick=action;return b;};
    const send=iconButton('send','ارسال پیام',()=>{}),pick=iconButton('image','عکس',()=>file.click()),record=iconButton('mic','ضبط ویس',startRecording),cancelRecord=iconButton('close','لغو ضبط',()=>stopRecording(true));cancelRecord.hidden=true;send.classList.add('send');
    const timerLabel=e('span','','composer-timer');timerLabel.hidden=true;
    const file=e('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    bar.append(input,timerLabel,pick,record,cancelRecord,send);compose.append(bar,file);room.append(title,note,alert,timeline,preview,compose);
    const url=blob=>{const value=URL.createObjectURL(blob);urls.add(value);return value;};
    const revoke=()=>{for(const u of urls)URL.revokeObjectURL(u);urls.clear();};
    const fail=error=>{if(valid())alert.textContent=error.message||String(error);};
    function updateSend(){send.disabled=submitting||!selected||!!recording||voiceStarting||(!repository.media&&!!attachment);pick.disabled=!!recording||submitting;input.disabled=submitting;}
    function previewMedia(){preview.replaceChildren();preview.hidden=!attachment;if(!attachment){updateSend();return;}
      const media=e(attachment.type.startsWith('image/')?'img':'audio');if(media.tagName==='AUDIO')media.controls=true;else media.alt='پیش‌نمایش عکس انتخابی';media.src=url(attachment);
      preview.append(media,e('p',attachment.name,'chat-note'),button('حذف پیوست',()=>{attachment=null;previewMedia();}));
      if(!repository.media)preview.append(e('p','رسانه فقط پیش‌نمایش است؛ API فعلی ارسال عکس و ویس ندارد.','chat-note'));updateSend();
    }
    file.onchange=()=>{try{if(!file.files[0])return;SabzineMessagingRepository.validate(file.files[0]);attachment=file.files[0];alert.textContent='';previewMedia();}catch(error){fail(error);}finally{file.value='';}};
    function displayMessage(m){
      const mine=m.authorId===repository.actorId,card=e('article',null,'chat-message'+(mine?' mine':'')+(m.kind==='system'?' system':''));
      if(m.attachment){const media=e(m.kind==='photo'?'img':'audio');media.src=url(m.attachment);
        if(m.kind==='photo'){media.alt='عکس ارسالی';media.tabIndex=0;const view=()=>{const dialog=e('dialog',null,'media-viewer'),image=e('img');image.src=media.src;image.alt='نمای بزرگ عکس';dialog.append(button('بستن عکس',()=>dialog.close()),image);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();};media.onclick=view;media.onkeydown=event=>{if(event.key==='Enter')view();};}
        else media.controls=true;card.append(media);
      }
      if(m.body)card.append(e('div',m.body));
      const state=({pending:repository.demo?'ثبت در نمونه':'در حال ارسال',sent:repository.demo?'ثبت‌شده در نمونه':'ارسال‌شده',delivered:'تحویل‌شده',read:'خوانده‌شده',failed:m.cancelled?'لغوشده':'ارسال ناموفق'})[m.status]||'';
      card.append(e('small',date(m.createdAt)+' · '+new Date(m.createdAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})+(mine?' · '+state:'')));
      if(m.status==='pending'&&m.attachment){const p=e('progress',null,'chat-progress');p.max=1;p.value=m.progress||0;card.append(p,button('لغو ثبت نمونه',()=>m.controller.abort()));}
      if(m.status==='failed')card.append(button('تلاش مجدد',()=>submit(m)));
      timeline.append(card);
    }
    function renderMessages(){revoke();timeline.replaceChildren();if(cursor)timeline.append(button('پیام‌های قبلی',()=>refresh(true)));
      if(!messages.length&&!pending.length)timeline.append(e('p','گفتگو را با یک پیام شروع کنید.','chat-note'));
      for(const m of [...messages,...pending])displayMessage(m);previewMedia();
    }
    async function refresh(older=false){if(!selected)return;const expected=++sequence,id=selected.id;alert.textContent='';
      try{const page=await repository.messages(id,older?cursor:null);if(!valid()||expected!==sequence)return;
        messages=older?[...page.items,...messages]:page.items;cursor=page.nextCursor;
        const ids=new Set(messages.map(m=>m.id));pending=pending.filter(m=>!ids.has(m.id));renderMessages();await repository.read(id);
        if(selected)selected.unreadCount=0;rowsBox.querySelector(`[data-conversation="${CSS.escape(id)}"] .unread-badge`)?.remove();
      }catch(error){if(expected===sequence)fail(error);}
    }
    async function open(row){if((input.value.trim()||attachment||recording)&&!confirm('پیش‌نویس این گفتگو کنار گذاشته شود؟'))return;
      stopRecording(true);selected=row;input.value='';attachment=null;pending=[];messages=[];title.textContent=personName(row);
      list.querySelectorAll('[data-conversation]').forEach(b=>b.classList.toggle('active',b.dataset.conversation===row.id));room.scrollIntoView({block:'nearest'});await refresh();updateSend();
    }
    async function submit(retry){if(submitting||!selected||recording||voiceStarting||(!repository.media&&attachment))return;submitting=true;updateSend();try{await deliver(retry);}finally{submitting=false;if(valid())updateSend();}}
    async function deliver(retry){
      const id=selected.id,m=retry||{id:'pending-'+crypto.randomUUID(),authorId:repository.actorId,body:input.value.trim(),attachment,kind:attachment?(attachment.type.startsWith('image/')?'photo':'voice'):'text',createdAt:new Date().toISOString()};
      if(!m.body&&!m.attachment)return;if(m.body.length>2000)return fail(new Error('پیام حداکثر ۲۰۰۰ کاراکتر است.'));
      if(!retry)pending.push(m);m.status='pending';m.controller=new AbortController();uploads.add(m.controller);renderMessages();alert.textContent='';
      try{const saved=await repository.send(id,m.body,m.attachment,{signal:m.controller.signal,onProgress:value=>{m.progress=value;if(valid()&&selected?.id===id)renderMessages();}});
        Object.assign(m,{...saved,status:saved.status||'sent'});
        if(!retry&&m.status!=='failed'){input.value='';attachment=null;previewMedia();}
      }catch(error){m.status='failed';m.cancelled=error.name==='AbortError';if(valid()&&selected?.id===id)fail(new Error(m.cancelled?'ثبت نمونه لغو شد.':error.message+(repository.demo?'':' ممکن است ثبت شده باشد؛ پیش از تلاش مجدد تازه‌سازی کنید.')));}
      finally{uploads.delete(m.controller);if(valid()&&selected?.id===id){renderMessages();timeline.scrollTop=timeline.scrollHeight;}}
    }
    compose.onsubmit=event=>{event.preventDefault();submit();};send.onclick=()=>submit();
    async function startRecording(){if(recording||voiceStarting)return;voiceStarting=true;updateSend();record.disabled=true;
      try{
        if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw new Error('ضبط صدا در این مرورگر ممکن نیست؛ HTTPS یا localhost و مرورگر سازگار لازم است.');
        const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!valid()){media.getTracks().forEach(t=>t.stop());return;}stream=media;
        const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mime)throw new Error('قالب صدای سازگار پیدا نشد.');
        const chunks=[];recording=new MediaRecorder(stream,{mimeType:mime});discardRecording=false;seconds=0;
        recording.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
        recording.onerror=()=>{stopRecording(true);fail(new Error('ضبط صدا متوقف شد.'));};
        recording.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;recording=null;record.onclick=startRecording;cancelRecord.hidden=true;timerLabel.hidden=true;timerLabel.textContent='';
          if(valid()&&!discardRecording&&chunks.length){try{const base=mime.split(';')[0];attachment=new File(chunks,'voice.'+(base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm'),{type:base});SabzineMessagingRepository.validate(attachment);previewMedia();}catch(error){attachment=null;fail(error);}}
          updateSend();};
        recording.start();cancelRecord.hidden=false;timerLabel.hidden=false;timerLabel.textContent='۰ ثانیه';record.onclick=()=>stopRecording(false);
        timer=setInterval(()=>{seconds++;timerLabel.textContent=seconds.toLocaleString('fa-IR')+' ثانیه';if(seconds>=120)stopRecording(false);},1000);
      }catch(error){stream?.getTracks().forEach(t=>t.stop());stream=null;fail(new Error(error.name==='NotAllowedError'?'اجازه میکروفن داده نشد؛ از تنظیمات مرورگر فعال کنید.':error.message));}
      finally{voiceStarting=false;if(valid()){record.disabled=false;updateSend();}}
    }
    function stopRecording(discard){discardRecording=discard;clearInterval(timer);if(recording?.state==='recording')recording.stop();}
    active={get dirty(){return !!input.value.trim()||!!attachment||!!recording||voiceStarting;},dispose(){alive=false;stopRecording(true);stream?.getTracks().forEach(t=>t.stop());for(const c of uploads)c.abort();revoke();document.querySelectorAll('.media-viewer').forEach(d=>d.remove());}};
    const head=e('div',null,'chat-list-head'),rowsBox=e('div',null,'chat-rows');
    const reload=e('button',null,'icon-button');reload.type='button';reload.setAttribute('aria-label','تازه‌سازی پیام‌ها');reload.append(icon('history'));reload.onclick=()=>loadInbox(false);
    head.append(e('h2','گفتگوها'),reload);list.append(head,rowsBox);
    if(repository.demo){const failNext=button('خطای ارسال بعدی (نمونه)',()=>repository.setFailSend(true));failNext.classList.add('chat-tool');list.append(failNext);}
    const names=new Map();
    const personName=row=>row.title||names.get(row.requestId)||(row.kind==='support'?'پشتیبانی':'گفتگو با کاربر');
    function paintInbox(rows){rowsBox.replaceChildren();if(!rows.length){rowsBox.append(e('p','هنوز گفتگویی ندارید.','chat-note'));return;}
      for(const row of rows){const b=e('button',null,'chat-row');b.type='button';b.dataset.conversation=row.id;b.onclick=()=>open(row);
        b.append(e('span',personName(row),'chat-row-name'));
        const count=Number(row.unreadCount);
        if(Number.isInteger(count)&&count>0){const badge=e('span',count.toLocaleString('fa-IR'),'unread-badge');badge.setAttribute('aria-label',count.toLocaleString('fa-IR')+' پیام خوانده‌نشده');b.append(badge);}
        b.classList.toggle('active',selected?.id===row.id);rowsBox.append(b);}
    }
    async function loadInbox(selectFirst){const [rows,queue]=await Promise.all([repository.list(),repository.demo?[]:session.api('specialist/queue').catch(()=>[])]);
      if(!valid())return [];names.clear();for(const item of queue)if(item.id&&item.displayName)names.set(item.id,item.displayName);paintInbox(rows);
      if(selectFirst&&rows.length){const match=conversationId?rows.find(r=>r.id===conversationId):rows[0];if(match)await open(match);}return rows;}
    loadInbox(true).catch(fail);
    updateSend();return root;
  }
  function changes({repository,session,onChat,onEditor}){
    reset();let alive=true,rows=[],filter='all',selected=null,loading=false;
    const root=e('section'),alert=e('p',null,'chat-error'),queue=e('div'),detail=e('section',null,'change-detail'),filters=e('div',null,'change-filters');alert.setAttribute('role','alert');
    const dialog=e('dialog',null,'change-modal'),close=e('button',null,'icon-button');close.type='button';close.setAttribute('aria-label','بستن');close.append(icon('close'));
    const modalError=e('p',null,'chat-error');modalError.setAttribute('role','alert');
    dialog.append(close,modalError,detail);document.body.append(dialog);
    close.onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{selected=null;modalError.textContent='';});
    root.append(e('p',repository.demo?'نسخه نمایشی جداگانه • برنامه و پیام واقعی تغییر نمی‌کنند.':'درخواست‌های اختصاص‌یافته از API فعلی دریافت می‌شوند. شروع بررسی، رد با توضیح و تأیید درخواست به قرارداد جدید سرور نیاز دارند.','chat-note'),alert,filters,queue);
    const valid=()=>alive&&session.active;
    const fail=error=>{if(!valid())return;alert.textContent=error.message;modalError.textContent=error.message;};
    async function perform(action){if(loading)return;loading=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);alert.textContent='';try{await action();}catch(error){fail(error);}finally{loading=false;if(valid()){drawQueue();drawDetail();}}}
    function drawQueue(){filters.replaceChildren();for(const [key,label]of [['all','همه'],...Object.entries(SabzineMessagingRepository.statuses)]){const b=button(label,()=>{filter=key;drawQueue();});b.classList.toggle('active',filter===key);filters.append(b);}
      queue.replaceChildren();const visible=rows.filter(r=>filter==='all'||r.status===filter);if(!visible.length)queue.append(e('p','درخواستی در این وضعیت ندارید.'));
      queue.append(WorkspaceUI.table(visible,[['کاربر',r=>r.displayName||'نام ارائه نشده'],['وضعیت',r=>SabzineMessagingRepository.statuses[r.status]||r.status],['ثبت',r=>date(r.createdAt)],['',r=>iconAction('eye','جزئیات درخواست',()=>perform(async()=>{const result=await repository.detail(r.id);if(valid()){selected={...r,...result};drawDetail();}}))]]));
    }
    function iconAction(name,label,action,disabled=false){const b=e('button',null,'icon-button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.append(icon(name));b.onclick=action;b.disabled=!!disabled;return b;}
    function fact(label,value){if(!value)return null;const row=e('tr');row.append(e('th',label),e('td',value));return row;}
    function drawDetail(){detail.replaceChildren();if(!selected){if(dialog.open)dialog.close();return;}const r=selected;modalError.textContent='';
      const head=e('header',null,'change-head'),who=e('div'),tools=e('div',null,'change-tools');
      who.append(e('h2',r.displayName||'کاربر'),e('p',SabzineMessagingRepository.statuses[r.status]||r.status,'change-status'));
      const update=async result=>{selected=result;rows=await repository.changes();};
      if(repository.revisions&&r.status==='awaiting_review')tools.append(iconAction('check','شروع بررسی',()=>perform(async()=>update(await repository.start(r.id)))));
      const canEdit=repository.revisions?r.status==='under_review'&&!r.awaitingCustomer:!!r.version;
      if(canEdit)tools.append(iconAction('pencil','ویرایش برنامه',()=>perform(async()=>{
        const repo=repository.demo?repository.replacement(r.id):SabzineClinicalRepository.live(session),request=await repo.get(r.id);if(valid()){dialog.close();onEditor(repo,request);}
      })));
      head.append(who,tools);detail.append(head);
      const body=e('tbody'),table=e('table',null,'change-facts');
      for(const row of [fact('دلیل',(r.reasons||[]).join('، ')),fact('توضیح',r.details),fact('منتظر کاربر',r.awaitingCustomer?r.clarification:''),fact('دلیل رد',r.rejection)])if(row)body.append(row);
      if(body.childElementCount){table.append(body);const wrap=e('div',null,'change-table');wrap.append(table);detail.append(wrap);}
      const history=e('ol',null,'change-history');detail.append(e('h3','تاریخچه'),history);
      if(!r.history?.length)history.append(e('li','تاریخچه‌ای ثبت نشده.'));
      for(const h of r.history||[]){const item=e('li');item.append(e('b',SabzineMessagingRepository.statuses[h.status]||h.status),e('small',date(h.at)));if(h.body)item.append(e('span',h.body));history.append(item);}
      if(repository.revisions&&r.status==='under_review'){
        const form=e('form',null,'change-decision'),input=e('textarea');
        input.maxLength=2000;input.rows=3;input.placeholder='دلیل رد، یا سؤالی که می‌خواهید از کاربر بپرسید';input.setAttribute('aria-label','یادداشت برای کاربر');
        const actions=e('div',null,'change-decision-actions');
        const reject=e('button','رد درخواست','secondary'),ask=e('button','سؤال از کاربر','secondary');
        reject.type='button';ask.type='button';
        reject.onclick=()=>{if(!input.value.trim())return fail(new Error('دلیل رد را بنویسید.'));perform(async()=>update(await repository.reject(r.id,input.value)));};
        ask.onclick=()=>{if(!input.value.trim())return fail(new Error('سؤال را بنویسید.'));perform(async()=>update(await repository.clarify(r.id,input.value)));};
        actions.append(ask,reject);
        form.append(input,actions);
        form.onsubmit=event=>event.preventDefault();
        if(repository.demo&&r.awaitingCustomer){const sample=e('button','پاسخ نمونهٔ کاربر','secondary');sample.type='button';sample.onclick=()=>perform(async()=>update(await repository.answer(r.id)));actions.append(sample);}
        detail.append(form);
      }
      if(!dialog.open)dialog.showModal();
    }
    active={dirty:false,dispose(){alive=false;dialog.close();dialog.remove();}};
    repository.changes().then(result=>{if(valid()){rows=result;drawQueue();}}).catch(fail);return root;
  }
  function reasonsConfig(){
    const root=e('section',null,'card reason-config');let rows=SabzineMessagingRepository.reasons();const list=e('div'),error=e('p',null,'chat-error');error.setAttribute('role','alert');
    root.append(e('h2','دلایل تغییر برنامه'),e('p','فاز ۹ · پیکربندی نمونه در همین مرورگر. شناسه و برچسب‌های قبلی حفظ می‌شوند؛ غیرفعال‌سازی گزینه را از پاسخ‌های ثبت‌شده حذف نمی‌کند.','workspace-note'),error,list);
    function draw(){list.replaceChildren();for(const [i,row]of rows.entries()){
      const line=e('div',null,'change-actions'),check=e('input'),name=e('input');check.type='checkbox';check.checked=row.active;check.setAttribute('aria-label','فعال بودن '+row.id);name.value=row.label;name.maxLength=120;name.setAttribute('aria-label','برچسب '+row.id);
      check.onchange=()=>{try{SabzineReports.updateReason(rows,row.id,{active:check.checked});error.textContent='';}catch(err){error.textContent=err.message;}};
      line.append(e('span','شناسه: '+row.id),name,check,button('ثبت برچسب',()=>{try{SabzineReports.updateReason(rows,row.id,{label:name.value});error.textContent='';draw();}catch(err){error.textContent=err.message;}}),button('بالاتر',()=>{[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw();},i===0));
      if(row.historicalLabels?.length)line.append(e('small','برچسب‌های قبلی: '+row.historicalLabels.join('، ')));
      list.append(line);
    }}
    const input=e('input');input.maxLength=120;input.setAttribute('aria-label','دلیل جدید');input.placeholder='دلیل جدید';
    root.append(input,button('افزودن دلیل',()=>{try{SabzineReports.addReason(rows,input.value,crypto.randomUUID());input.value='';error.textContent='';draw();}catch(err){error.textContent=err.message;}}),button('ذخیره پیکربندی نمونه',()=>{
      if(!rows.some(r=>r.active)){error.textContent='حداقل یک دلیل فعال لازم است.';return;}
      try{localStorage.setItem('sabzine.demo.change-reasons',JSON.stringify(rows));error.textContent='در همین مرورگر ذخیره شد؛ روی سرور منتشر نشده است.';}catch{error.textContent='ذخیره مرورگر ممکن نیست.';}
    }));draw();return root;
  }
  globalThis.SabzineMessaging={chat,changes,reasonsConfig,leave,reset,get open(){return !!active;}};
})();
