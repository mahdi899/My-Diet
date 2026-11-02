(() => {
  const {element:e,date}=WorkspaceUI;
  let active=null;
  const button=(label,action,disabled=false)=>{const b=e('button',label,'secondary');b.type='button';b.onclick=action;b.disabled=disabled;return b;};
  function leave(){if(active?.dirty&&!confirm('پیام یا رسانهٔ ارسال‌نشده کنار گذاشته شود؟'))return false;reset();return true;}
  function reset(){active?.dispose();active=null;}
  function chat({repository,session,conversationId}){
    reset();
    const root=e('section',null,'messaging-workspace'),list=e('aside',null,'conversation-list'),room=e('section',null,'conversation-room');root.append(list,room);
    let alive=true,selected=null,sequence=0,cursor=null,messages=[],pending=[],attachment=null,recording=null,stream=null,timer=null,seconds=0,discardRecording=false,voiceStarting=false;
    const urls=new Set(),uploads=new Set();
    const valid=()=>alive&&session.active;
    const alert=e('p',null,'chat-error');alert.setAttribute('role','alert');
    const title=e('h2','گفتگو با کاربر'),note=e('p',repository.demo?'نسخه نمایشی • هیچ پیامی به بیمار واقعی ارسال نمی‌شود.':'ارسال متنی متصل است؛ دریافت پیام با تازه‌سازی انجام می‌شود.','chat-note');
    const timeline=e('div',null,'chat-timeline');timeline.setAttribute('aria-label','پیام‌ها');
    const preview=e('div',null,'attachment-preview');preview.hidden=true;
    const compose=e('form',null,'chat-compose'),input=e('textarea');input.rows=2;input.maxLength=2000;input.placeholder='پیام شما…';input.setAttribute('aria-label','متن پیام');
    const send=button('ارسال پیام',()=>{}),pick=button('عکس',()=>file.click()),record=button('ضبط ویس',startRecording),cancelRecord=button('لغو ضبط',()=>stopRecording(true));cancelRecord.hidden=true;
    const file=e('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    compose.append(input,pick,record,cancelRecord,send,file);room.append(title,note,alert,timeline,preview,compose);
    const url=blob=>{const value=URL.createObjectURL(blob);urls.add(value);return value;};
    const revoke=()=>{for(const u of urls)URL.revokeObjectURL(u);urls.clear();};
    const fail=error=>{if(valid())alert.textContent=error.message||String(error);};
    function updateSend(){send.disabled=!selected||!!recording||voiceStarting||(!repository.media&&!!attachment);pick.disabled=!!recording;}
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
      }catch(error){if(expected===sequence)fail(error);}
    }
    async function open(row){if((input.value.trim()||attachment||recording)&&!confirm('پیش‌نویس این گفتگو کنار گذاشته شود؟'))return;
      stopRecording(true);selected=row;input.value='';attachment=null;pending=[];messages=[];title.textContent=row.title||'ارتباط با کاربر';
      list.querySelectorAll('[data-conversation]').forEach(b=>b.classList.toggle('active',b.dataset.conversation===row.id));await refresh();updateSend();
    }
    async function submit(retry){if(!selected||recording||voiceStarting||(!repository.media&&attachment))return;
      const id=selected.id,m=retry||{id:'pending-'+crypto.randomUUID(),authorId:repository.actorId,body:input.value.trim(),attachment,kind:attachment?(attachment.type.startsWith('image/')?'photo':'voice'):'text',createdAt:new Date().toISOString()};
      if(!m.body&&!m.attachment)return;if(m.body.length>2000)return fail(new Error('پیام حداکثر ۲۰۰۰ کاراکتر است.'));
      if(!retry){pending.push(m);input.value='';attachment=null;}m.status='pending';m.controller=new AbortController();uploads.add(m.controller);renderMessages();alert.textContent='';
      try{const saved=await repository.send(id,m.body,m.attachment,{signal:m.controller.signal,onProgress:value=>{m.progress=value;if(valid()&&selected?.id===id)renderMessages();}});
        Object.assign(m,{...saved,status:saved.status||'sent'});
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
        recording.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;recording=null;record.textContent='ضبط ویس';record.onclick=startRecording;cancelRecord.hidden=true;
          if(valid()&&!discardRecording&&chunks.length){try{const base=mime.split(';')[0];attachment=new File(chunks,'voice.'+(base==='audio/mp4'?'m4a':base==='audio/ogg'?'ogg':'webm'),{type:base});SabzineMessagingRepository.validate(attachment);previewMedia();}catch(error){attachment=null;fail(error);}}
          updateSend();};
        recording.start();cancelRecord.hidden=false;record.textContent='توقف و پیش‌نمایش · ۰ ثانیه';record.onclick=()=>stopRecording(false);
        timer=setInterval(()=>{seconds++;record.textContent='توقف و پیش‌نمایش · '+seconds.toLocaleString('fa-IR')+' ثانیه';if(seconds>=120)stopRecording(false);},1000);
      }catch(error){stream?.getTracks().forEach(t=>t.stop());stream=null;fail(new Error(error.name==='NotAllowedError'?'اجازه میکروفن داده نشد؛ از تنظیمات مرورگر فعال کنید.':error.message));}
      finally{voiceStarting=false;if(valid()){record.disabled=false;updateSend();}}
    }
    function stopRecording(discard){discardRecording=discard;clearInterval(timer);if(recording?.state==='recording')recording.stop();}
    active={get dirty(){return !!input.value.trim()||!!attachment||!!recording||voiceStarting;},dispose(){alive=false;stopRecording(true);stream?.getTracks().forEach(t=>t.stop());for(const c of uploads)c.abort();revoke();document.querySelectorAll('.media-viewer').forEach(d=>d.remove());}};
    list.append(e('h2','صندوق گفتگوها'),button('تازه‌سازی پیام‌ها',()=>refresh()));
    if(repository.demo)list.append(button('خطای ارسال بعدی (نمونه)',()=>repository.setFailSend(true)));
    repository.list().then(rows=>{if(!valid())return;for(const row of rows){const label=(row.title||(row.kind==='support'?'پشتیبانی':'گفتگو با کاربر'))+(Number.isInteger(row.unreadCount)&&row.unreadCount>0?' · '+row.unreadCount.toLocaleString('fa-IR')+' خوانده‌نشده':'');const b=button(label,()=>open(row));b.dataset.conversation=row.id;list.append(b);}
      if(rows.length)open(rows.find(r=>r.id===conversationId)||rows[0]);else list.append(e('p','هنوز گفتگویی ندارید.'));}).catch(fail);
    updateSend();return root;
  }
  function changes({repository,session,onChat,onEditor}){
    reset();let alive=true,rows=[],filter='all',selected=null,loading=false;
    const root=e('section'),alert=e('p',null,'chat-error'),queue=e('div'),detail=e('section',null,'change-detail'),filters=e('div',null,'change-filters');alert.setAttribute('role','alert');
    root.append(e('p',repository.demo?'نسخه نمایشی جداگانه • برنامه و پیام واقعی تغییر نمی‌کنند.':'درخواست‌های اختصاص‌یافته از API فعلی دریافت می‌شوند. شروع بررسی، رد با توضیح و تأیید درخواست به قرارداد جدید سرور نیاز دارند.','chat-note'),alert,filters,queue,detail);detail.hidden=true;
    const valid=()=>alive&&session.active;
    const fail=error=>{if(valid())alert.textContent=error.message;};
    async function perform(action){if(loading)return;loading=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);alert.textContent='';try{await action();}catch(error){fail(error);}finally{loading=false;if(valid()){drawQueue();drawDetail();}}}
    function drawQueue(){filters.replaceChildren();for(const [key,label]of [['all','همه'],...Object.entries(SabzineMessagingRepository.statuses)]){const b=button(label,()=>{filter=key;drawQueue();});b.classList.toggle('active',filter===key);filters.append(b);}
      queue.replaceChildren();const visible=rows.filter(r=>filter==='all'||r.status===filter);if(!visible.length)queue.append(e('p','درخواستی در این وضعیت ندارید.'));
      queue.append(WorkspaceUI.table(visible,[['کاربر',r=>r.displayName||'نام ارائه نشده'],['وضعیت',r=>SabzineMessagingRepository.statuses[r.status]||r.status],['ثبت',r=>date(r.createdAt)],['رسیدگی',r=>button('جزئیات درخواست',()=>perform(async()=>{const result=await repository.detail(r.id);if(valid()){selected={...r,...result};drawDetail();}}))]]));
    }
    function drawDetail(){detail.replaceChildren();detail.hidden=!selected;if(!selected)return;const r=selected;
      detail.append(e('h2','درخواست '+r.id),e('p',r.displayName||'کاربر'),e('p',SabzineMessagingRepository.statuses[r.status]||r.status),e('strong',(r.reasons||[]).join('، ')||'دلایل از API ارائه نشده'),e('p',r.details||''));
      if(r.awaitingCustomer)detail.append(e('p','در انتظار پاسخ کاربر: '+r.clarification,'workspace-note'));
      if(r.rejection)detail.append(e('p','دلیل رد: '+r.rejection));
      const history=e('ol',null,'change-history');for(const h of r.history||[])history.append(e('li',(SabzineMessagingRepository.statuses[h.status]||h.status)+' · '+date(h.at)+(h.body?' · '+h.body:'')));detail.append(e('h3','تاریخچه وضعیت'),history);
      if(!r.history?.length)history.append(e('li','تاریخچه وضعیت از API ارائه نشده است.'));
      const actions=e('div',null,'change-actions');actions.append(button('گفتگو با کاربر',()=>onChat(repository,r.conversationId),!r.conversationId));
      const update=async result=>{selected=result;rows=await repository.changes();};
      actions.append(button('شروع بررسی',()=>perform(async()=>update(await repository.start(r.id))),!repository.revisions||r.status!=='awaiting_review'));
      actions.append(button('ویرایش و تأیید برنامه جایگزین',()=>perform(async()=>{
        const repo=repository.demo?repository.replacement(r.id):SabzineClinicalRepository.live(session),request=await repo.get(r.id);if(valid())onEditor(repo,request);
      }),repository.revisions?(r.status!=='under_review'||r.awaitingCustomer):!r.version));detail.append(actions);
      if(repository.revisions&&r.status==='under_review'){
        const form=e('form'),label=e('label','توضیح رد یا سؤال از کاربر'),input=e('textarea');input.maxLength=2000;input.required=true;input.setAttribute('aria-label','توضیح رد یا سؤال از کاربر');label.append(input);form.append(label);
        form.onsubmit=event=>event.preventDefault();
        form.append(button('رد درخواست با توضیح',()=>{if(!input.value.trim())return fail(new Error('دلیل رد الزامی است.'));perform(async()=>update(await repository.reject(r.id,input.value)));}),button('درخواست توضیح از کاربر',()=>{if(!input.value.trim())return fail(new Error('سؤال را بنویسید.'));perform(async()=>update(await repository.clarify(r.id,input.value)));}));
        if(repository.demo&&r.awaitingCustomer)form.append(button('شبیه‌سازی پاسخ کاربر',()=>perform(async()=>update(await repository.answer(r.id)))));
        detail.append(form);
      }
    }
    active={dirty:false,dispose(){alive=false;}};
    repository.changes().then(result=>{if(valid()){rows=result;drawQueue();}}).catch(fail);return root;
  }
  function reasonsConfig(){
    const root=e('section',null,'card reason-config');let rows=SabzineMessagingRepository.reasons();const list=e('div'),error=e('p',null,'chat-error');error.setAttribute('role','alert');
    root.append(e('h2','دلایل تغییر برنامه'),e('p','پیکربندی نمونه در همین مرورگر؛ انتشار برای کاربران به API تنظیمات مدیر نیاز دارد.','workspace-note'),error,list);
    function draw(){list.replaceChildren();for(const [i,row]of rows.entries()){
      const line=e('div',null,'change-actions'),label=e('label',row.label),check=e('input');check.type='checkbox';check.checked=row.active;check.setAttribute('aria-label','فعال بودن '+row.label);check.onchange=()=>{row.active=check.checked;};label.prepend(check);
      line.append(label,button('بالاتر',()=>{[rows[i-1],rows[i]]=[rows[i],rows[i-1]];draw();},i===0),button('حذف دلیل',()=>{rows.splice(i,1);draw();}));list.append(line);
    }}
    const input=e('input');input.maxLength=120;input.setAttribute('aria-label','دلیل جدید');input.placeholder='دلیل جدید';
    root.append(input,button('افزودن دلیل',()=>{const label=input.value.trim();if(!label||rows.some(r=>r.label===label)){error.textContent='دلیل خالی یا تکراری مجاز نیست.';return;}rows.push({id:crypto.randomUUID(),label,active:true});input.value='';error.textContent='';draw();}),button('ذخیره پیکربندی نمونه',()=>{
      if(!rows.some(r=>r.active)){error.textContent='حداقل یک دلیل فعال لازم است.';return;}
      try{localStorage.setItem('sabzine.demo.change-reasons',JSON.stringify(rows));error.textContent='در همین مرورگر ذخیره شد؛ روی سرور منتشر نشده است.';}catch{error.textContent='ذخیره مرورگر ممکن نیست.';}
    }));draw();return root;
  }
  globalThis.SabzineMessaging={chat,changes,reasonsConfig,leave,reset,get open(){return !!active;}};
})();
