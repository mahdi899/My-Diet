/* Phase 6 clinical UI. Every action is routed through its explicit live/demo adapter. */
(() => {
  const {element:e,date}=WorkspaceUI, {copy}=SabzineClinicalRepository;
  const week=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const slots={breakfast:'صبحانه',lunch:'ناهار',dinner:'شام',snack:'میان‌وعده'};
  let active=null;
  const text=value=>value==null?'ارائه نشده':Array.isArray(value)?(value.length?value.join('، '):'هیچ موردی گزارش نشده'):typeof value==='number'?new Intl.NumberFormat('fa-IR').format(value):String(value);
  const button=(label,action,secondary=true)=>{const b=e('button',label,secondary?'secondary':'');b.type='button';b.onclick=action;return b;};
  const section=(title)=>{const card=e('section',null,'card');card.append(e('h2',title));return card;};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function planIssues(request,days) {
    const result=[];
    if(!Number.isInteger(request.version?.lockVersion))result.push('نسخهٔ قفل ویرایش دریافت نشده است.');
    if(request.version?.status!=='draft')result.push('برای انتشار باید پیش‌نویس ذخیره‌شده داشته باشی.');
    if(days.length!==7)result.push('برنامه باید دقیقاً هفت روز داشته باشد.');
    const ids=[];
    days.forEach((d,i)=>{
      if(!d.meals?.length)result.push(`${week[i]}: وعده‌ای ثبت نشده`);
      if((d.meals?.length||0)>12)result.push(`${week[i]}: بیش از ۱۲ وعده`);
      for(const m of d.meals||[]) {
        ids.push(m.mealUid);
        for(const issue of SabzineMealQuality.check(m))result.push(`${week[i]} · ${m.title||'بدون نام'}: ${issue}`);
        if(!slots[m.mealType] || !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.suggestedTime||''))result.push(`${week[i]}: نوع یا ساعت وعده معتبر نیست`);
        for(const food of [m,...(m.alternatives||[]).map(a=>a.meal||{})]) {
          if(!food.portion?.trim())result.push(`${food.title||m.title}: سهم غذا ثبت نشده`);
          if(!Number.isInteger(food.calories)||food.calories<=0||food.calories>5000)result.push(`${food.title}: کالری صحیح ۱ تا ۵۰۰۰ وارد کن`);
          if(!Number.isFinite(food.preparationMinutes)||food.preparationMinutes<0||food.preparationMinutes>1440)result.push(`${food.title}: زمان آماده‌سازی معتبر نیست`);
          if(food.items?.some(i=>!Number.isFinite(i.quantity)||i.quantity<=0))result.push(`${food.title}: مقدار مواد باید مثبت و معتبر باشد`);
        }
      }
    });
    if(ids.some(id=>!id)||new Set(ids).size!==ids.length)result.push('شناسه وعده‌ها نامعتبر یا تکراری است.');
    if((request.questions||[]).some(q=>q.required&&!['acknowledged','withdrawn'].includes(q.status)))result.push('پاسخ لازم کاربر باید دریافت و توسط متخصص بررسی شود.');
    if(request.status!=='in_review')result.push('وضعیت درخواست برای انتشار آماده نیست.');
    return [...new Set(result)];
  }
  function readableMeal(meal){return [
    'غذا: '+text(meal.title),'وعده: '+text(slots[meal.mealType]),'ساعت: '+text(meal.suggestedTime),'سهم: '+text(meal.portion),
    'کالری: '+text(meal.calories),'زمان آماده‌سازی: '+text(meal.preparationMinutes),'مبنای وزن: '+text(meal.quantityBasis),'روش آماده‌سازی: '+text(meal.instructions),'یادداشت: '+text(meal.notes),
    'مواد اولیه:',...(meal.items||[]).map(i=>text(i.name)+': '+text(i.quantity)+' '+text(i.unit)+' · '+text(i.basis)),
    ...(meal.alternatives||[]).map(a=>(a.source==='ai'?'جایگزین AI: ':'جایگزین متخصص: ')+text(a.meal?.title)+' · '+(a.approved?'تأییدشده':'تأییدنشده')+'\n'+readableMeal(a.meal||{}))
  ].join('\n');}
  function start({repository,request,session,onBack}) {
    reset();
    const root=e('div',null,'clinical-workspace');
    let state=copy(request),days=copy(request.version?.days||[]),baseline=copy(days),dirty=false,busy=false,alive=true,needsRefresh=false,dayIndex=0,tab='patient',message='',failure='',questionDraft='';
    const demo=repository.demo;
    let publishedSnapshot=copy(state.published||(state.version?.status==='published'?{days:state.version.days,versionNumber:state.version.versionNumber}:null));
    async function refreshContext(){const updated=await repository.get(state.id);if(!valid())return;if(dirty&&(updated.version?.lockVersion!==state.version?.lockVersion||!equal(updated.version?.days,state.version?.days)))throw Object.assign(new Error('پیش‌نویس روی سرور تغییر کرده؛ نسخهٔ محلی حفظ شد.'),{status:409});state=updated;if(!dirty){days=copy(updated.version?.days||[]);baseline=copy(days);}}
    const valid=()=>alive&&session.active;
    const lock = ()=>{for(const control of root.querySelectorAll('button,input,textarea,select'))control.disabled=busy;};
    function mutate(change,invalidate) {if(busy)return;change();if(invalidate)for(const a of invalidate.alternatives||[]){a.approved=false;a.reviewedBy=null;a.reviewedAt=null;}dirty=!equal(days,baseline);render();}
    function field(parent,label,value,onChange,{type='text',max=1500}={}) {
      const wrapper=e('label',label),input=e(type==='textarea'?'textarea':'input');
      if(type!=='textarea')input.type=type;
      if(type==='number'){input.min='0';input.step='any';}else if(type!=='time')input.maxLength=max;
      input.value=value??'';input.setAttribute('aria-label',label);
      input.oninput=()=>{onChange(type==='number'?(input.value===''?null:Number(input.value)):input.value);dirty=!equal(days,baseline);updateGate();};
      wrapper.append(input);parent.append(wrapper);return input;
    }
    function invalidateMeal(meal){for(const a of meal.alternatives||[]){a.approved=false;a.reviewedBy=null;a.reviewedAt=null;}}
    function recipeForm(meal,prefix,onEdit) {
      const form=e('div',null,'clinical-grid');
      const put=(label,key,options)=>field(form,`${prefix}${label}`,meal[key],value=>{meal[key]=value;onEdit();},options);
      put('نام غذا','title',{max:120});put('سهم غذا','portion');put('کالری سهم','calories',{type:'number'});
      put('زمان آماده‌سازی (دقیقه)','preparationMinutes',{type:'number'});put('مبنای مقدار خام یا پخته','quantityBasis');
      put('روش آماده‌سازی','instructions',{type:'textarea'});put('یادداشت','notes',{type:'textarea',max:500});
      return form;
    }
    function ingredients(food,prefix,onEdit) {
      const group=e('section');group.append(e('h4','مواد اولیه و مقدارها'));
      for(const [i,item] of (food.items||[]).entries()) {
        const row=e('div',null,'clinical-grid ingredient-editor');
        field(row,`${prefix}نام ماده ${i+1}`,item.name,v=>{item.name=v;onEdit();},{max:120});
        field(row,`${prefix}مقدار ماده ${i+1}`,item.quantity,v=>{item.quantity=v;onEdit();},{type:'number'});
        field(row,`${prefix}واحد ماده ${i+1}`,item.unit,v=>{item.unit=v;onEdit();},{max:16});
        field(row,`${prefix}مبنای ماده ${i+1}`,item.basis,v=>{item.basis=v;onEdit();});
        row.append(button('حذف ماده',()=>mutate(()=>{food.items.splice(i,1);onEdit();})));group.append(row);
      }
      group.append(button('افزودن ماده',()=>mutate(()=>{(food.items||=[]).push({name:'',quantity:null,unit:'',basis:''});onEdit();})));return group;
    }
    function patientView() {
      const patient=state.patient||{},card=section('پروندهٔ کاربر'),list=e('dl',null,'definition-list');
      for(const [label,value] of [['نام',patient.name??state.displayName],['سن',patient.age],['قد (سانتی‌متر)',patient.height],['وزن فعلی (کیلوگرم)',patient.currentWeight],['وزن هدف',patient.targetWeight],['هدف',patient.goal],['بیماری‌ها',patient.conditions],['آلرژی‌ها',patient.allergies],['داروها',patient.medications],['اطلاعات بارداری',patient.pregnancy?Object.entries(patient.pregnancy).map(([key,value])=>({status:'وضعیت',week:'هفتهٔ بارداری',prePregnancyWeight:'وزن پیش از بارداری',babies:'تعداد جنین'}[key]||'اطلاعات تکمیلی')+': '+text(value)).join('، '):null]])list.append(e('dt',label),e('dd',text(value)));
      card.append(list,e('p',demo?'اطلاعات این پرونده کاملاً نمونه است.':'فقط اطلاعات دریافت‌شده از API نشان داده می‌شود. دادهٔ ارائه‌نشده به معنی نداشتن بیماری نیست.'));
      const result=e('div');result.append(card);
      for(const [title,rows] of [['پرسش‌نامه',patient.questionnaire],['تاریخچه وزن',patient.weights],['جایگزینی‌ها',patient.substitutions],['بازخوردهای هفتگی خصوصی',patient.feedback]]) {
        const group=section(title);
        if(!rows?.length)group.append(e('p','اطلاعات ارائه نشده است.'));
        for(const row of rows||[])group.append(e('p',Array.isArray(row)?row.map(text).join(' · '):text(row)));
        result.append(group);
      }
      const consumption=section('خلاصهٔ ثبت وعده و رعایت برنامه');
      consumption.append(e('p',patient.consumption?`ثبت‌شده: ${patient.consumption.recorded} از ${patient.consumption.total} · طبق برنامه: ${patient.consumption.adherent} از ${patient.consumption.total}`:'اطلاعات مصرف ارائه نشده است.'));result.append(consumption);
      const history=section('برنامهٔ فعلی و نسخه‌های قبلی');
      if(state.published?.days)history.append(e('p',`نسخه منتشرشده ${state.published.versionNumber??'ثبت نشده'} · برنامه قبلی تا انتشار موفق جایگزین حفظ می‌شود.`));
      if(state.version)history.append(e('p',`نسخهٔ دریافت‌شده: ${state.version.status==='published'?'منتشرشده':'پیش‌نویس'} · بازبینی ${state.version.lockVersion??'ارائه نشده'}`));
      history.append(button('دریافت تاریخچهٔ برنامه‌ها',()=>perform(async()=>{
        if(!state.userId){message='شناسهٔ کاربر از API ارائه نشده؛ تاریخچه قابل دریافت نیست.';return;}
        const versions=await repository.versions(state.userId);if(!valid())return;
        state.history=versions;
      })));
      for(const version of state.history||[]){const entry=e('details');entry.append(e('summary',`نسخه ${version.versionNumber} · ${date(version.weekStart)} · ${version.status==='published'?'منتشرشده':'آرشیو'}`));if(version.days){for(const [i,day]of version.days.entries()){entry.append(e('h4',week[i]));for(const meal of day.meals||[])entry.append(e('pre',readableMeal(meal)));}}else entry.append(e('p','فقط مشخصات نسخه دریافت شده؛ محتوای برنامه از API ارائه نشده است.'));history.append(entry);}
      result.append(history);return result;
    }
    function mealEditor(meal,index) {
      const card=section(`${slots[meal.mealType]||'وعده'} · ${meal.title||'وعده جدید'}`);
      const prefix=`وعده ${index+1} · `,change=()=>invalidateMeal(meal);
      const type=e('label','نوع وعده'),select=e('select');select.setAttribute('aria-label',`${prefix}نوع وعده`);
      for(const [key,label] of Object.entries(slots)){const option=e('option',label);option.value=key;select.append(option);}select.value=meal.mealType;
      select.onchange=()=>mutate(()=>{meal.mealType=select.value;change();});type.append(select);card.append(type);
      field(card,`${prefix}ساعت`,meal.suggestedTime,v=>{meal.suggestedTime=v;change();},{type:'time'});
      card.append(recipeForm(meal,prefix,change),ingredients(meal,prefix,change));
      for(const [source,label] of [['ai','جایگزین هوش مصنوعی'],['specialist','جایگزین متخصص']]) {
        const group=e('details',null,'alternative-editor'),heading=e('summary',label);group.append(heading);
        const alternative=(meal.alternatives||[]).find(a=>a.source===source);
        if(!alternative) {
          group.append(e('p','جایگزین ثبت نشده؛ از روی غذای اصلی به‌صورت خودکار ساخته نمی‌شود.'));
          if(source==='specialist')group.append(button('ساخت جایگزین متخصص',()=>mutate(()=>{(meal.alternatives||=[]).push({id:crypto.randomUUID(),source,approved:false,meal:emptyMeal()});})));
          else if(demo)group.append(button('افزودن پیش‌نویس خالی AI در نمونه',()=>mutate(()=>{(meal.alternatives||=[]).push({id:crypto.randomUUID(),source,approved:false,meal:emptyMeal()});})));
        } else {
          const onEdit=()=>{alternative.approved=false;alternative.reviewedBy=null;alternative.reviewedAt=null;};
          const approval=e('p');approval.dataset.approvalId=alternative.id;group.append(approval,recipeForm(alternative.meal,`${prefix}${label} · `,onEdit),ingredients(alternative.meal,`${prefix}${label} · `,onEdit));
          group.append(button('جزئیات این جایگزین را بررسی و تأیید کردم',()=>mutate(()=>{
            const candidate=alternative.meal;
            if(!candidate.portion?.trim()||!Number.isInteger(candidate.calories)||candidate.calories<=0||candidate.calories>5000||!Number.isFinite(candidate.preparationMinutes)||candidate.preparationMinutes<0||!candidate.instructions?.trim()||!candidate.quantityBasis?.trim()||!candidate.title?.trim()||!candidate.items?.length||candidate.items.some(i=>!i.name?.trim()||!Number.isFinite(i.quantity)||i.quantity<=0||!i.unit?.trim())) {failure='ابتدا همهٔ جزئیات این جایگزین را کامل کن.';return;}
            alternative.approved=true;alternative.reviewedBy=demo?'demo-specialist':'unconfirmed-local';alternative.reviewedAt=new Date().toISOString();
          })));
          group.append(button('حذف جایگزین',()=>mutate(()=>{meal.alternatives=meal.alternatives.filter(a=>a!==alternative);})));
        }
        card.append(group);
      }
      card.append(button('حذف وعده',()=>{if(confirm('این وعده از پیش‌نویس حذف شود؟'))mutate(()=>days[dayIndex].meals.splice(index,1));}));
      return card;
    }
    const emptyMeal=()=>({mealUid:crypto.randomUUID(),mealType:'dinner',suggestedTime:'',title:'',calories:null,portion:'',preparationMinutes:null,instructions:'',quantityBasis:'',notes:'',items:[],alternatives:[]});
    function editorView() {
      const view=e('div');
      if(!state.version) {view.append(e('p','پیش‌نویسی برای این درخواست دریافت نشده است.'));return view;}
      const tabs=e('div',null,'section-tabs');
      week.forEach((label,i)=>{const b=button(label,()=>{dayIndex=i;render();});b.setAttribute('aria-pressed',String(dayIndex===i));tabs.append(b);});view.append(tabs);
      if(!days[dayIndex])view.append(button('ایجاد روز خالی',()=>mutate(()=>{while(days.length<7)days.push({meals:[]});})));
      for(const [index,meal] of (days[dayIndex]?.meals||[]).entries())view.append(mealEditor(meal,index));
      if(days[dayIndex])view.append(button('افزودن وعده',()=>mutate(()=>days[dayIndex].meals.push(emptyMeal()))));
      return view;
    }
    function comparisonView() {
      const view=section('مقایسهٔ پیش‌نویس و نسخهٔ منتشرشده');
      const published=publishedSnapshot?.days;
      if(!published){view.append(e('p','نسخهٔ منتشرشده برای مقایسه از API ارائه نشده است؛ آن را از روی پیش‌نویس حدس نمی‌زنیم.'));return view;}
      for(let i=0;i<7;i++) {
        const group=e('details');group.append(e('summary',week[i]));
        const old=new Map((published[i]?.meals||[]).map(m=>[m.mealUid,m]));
        for(const meal of days[i]?.meals||[]) {
          const previous=old.get(meal.mealUid);old.delete(meal.mealUid);
          group.append(e('h3',`${previous?(equal(previous,meal)?'بدون تغییر':'ویرایش‌شده'):'افزوده‌شده'}: ${meal.title||'بدون نام'}`));
          const grid=e('div',null,'clinical-grid');
          for(const [label,value] of [['منتشرشده',previous],['پیش‌نویس',meal]]) {const block=e('section');block.append(e('h4',label),e('pre',value?readableMeal(value):'وجود ندارد'));grid.append(block);}group.append(grid);
        }
        for(const removed of old.values()){const details=e('details');details.append(e('summary',`حذف‌شده: ${removed.title}`),e('pre',readableMeal(removed)));group.append(details);}view.append(group);
      }
      return view;
    }
    function questionsView() {
      const view=section('اطلاعات بیشتر و پاسخ کاربر');
      for(const q of state.questions||[]) {
        const card=e('section',null,'card');card.append(e('h3',q.prompt),e('p',`وضعیت: ${{open:'در انتظار پاسخ کاربر',answered:'پاسخ دریافت شده؛ نیازمند بررسی',acknowledged:'بررسی‌شده',withdrawn:'پس گرفته شده'}[q.status]||'نامشخص'}`));
        for(const answer of q.answers||[])card.append(e('p',answer.body));
        if(q.status==='answered'&&q.answers?.length)card.append(button('پاسخ را خواندم و بررسی کردم',()=>perform(async()=>{await repository.acknowledge(q.id);if(valid())await refreshContext();})));
        view.append(card);
      }
      const prompt=e('textarea');prompt.maxLength=500;prompt.value=questionDraft;prompt.oninput=()=>{questionDraft=prompt.value;};prompt.setAttribute('aria-label','سؤال ضروری از کاربر');view.append(prompt,button('ارسال سؤال ضروری',()=>{
        if(dirty){failure='پیش از ارسال سؤال، پیش‌نویس را ذخیره کن تا اطلاعاتت از دست نرود.';render();return;}
        if(!prompt.value.trim()){failure='سؤال را بنویس.';render();return;}
        perform(async()=>{await repository.ask(state,prompt.value.trim());if(valid()){await refreshContext();questionDraft='';}});
      }));
      if(demo)view.append(button('شبیه‌سازی پاسخ کاربر در نمونه',()=>perform(async()=>{await repository.answer();if(valid())await refreshContext();})));return view;
    }
    async function perform(action) {
      if(busy||!valid())return;busy=true;failure='';message='در حال انجام…';lock();updateGate();
      try {await action();if(!valid())return;if(message==='در حال انجام…')message=demo?'عملیات فقط در سناریوی نمونه انجام شد.':'پاسخ عملیات از سرور دریافت شد.';}
      catch(error){if(valid()){if(!demo)needsRefresh=true;failure=error.status===409?'نسخه یا وضعیت درخواست تغییر کرده است. پیش‌نویس محلی حفظ شد؛ پیش از ادامه تازه‌سازی کن.':error.message;} }
      finally{busy=false;if(valid())render();}
    }
    function updateGate() {
      const gate=root.querySelector('[data-gate]'),publish=root.querySelector('[data-publish]');
      if(!gate||!publish)return;
      const issues=planIssues(state,days);
      gate.replaceChildren(e('h3','بررسی پیش از انتشار'));
      for(const issue of issues.slice(0,30))gate.append(e('p',issue));
      if(issues.length>30)gate.append(e('p',`${issues.length-30} مورد دیگر باید تکمیل شود.`));
      if(dirty)gate.append(e('p','تغییرات هنوز ذخیره نشده‌اند.'));
      if(needsRefresh)gate.append(e('p','پس از خطای عملیات، پیش از انتشار پرونده را تازه‌سازی کن.'));
      for(const label of root.querySelectorAll('[data-approval-id]')){const alt=days.flatMap(d=>d.meals||[]).flatMap(m=>m.alternatives||[]).find(a=>a.id===label.dataset.approvalId);label.textContent=alt?.approved?(demo?'تأیید در نمونه ثبت شده':alt.reviewedBy==='unconfirmed-local'?'تأیید محلی؛ منتظر ثبت و تأیید سرور':'تأیید دریافت‌شده از سرور'):'نیازمند بررسی متخصص';}
      if(!demo&&!state.capabilities?.completeMealEditor)gate.append(e('p','پشتیبانی کامل جزئیات و جایگزین‌ها در API فعلی اعلام نشده؛ انتشار این نسخه مسدود است.'));
      publish.disabled=busy||dirty||needsRefresh||issues.length>0||(!demo&&days.some(d=>d.meals.some(m=>(m.alternatives||[]).some(a=>a.reviewedBy==='unconfirmed-local'))))||(!demo&&!state.capabilities?.completeMealEditor);
      const saved=root.querySelector('[data-dirty]');if(saved)saved.textContent=dirty?'تغییرات ذخیره‌نشده':'بدون تغییر ذخیره‌نشده';
    }
    function render() {
      if(!valid())return;
      root.replaceChildren();
      const top=section(demo?'پرونده و ویرایش برنامه · نمونهٔ آموزشی':'پرونده و ویرایش برنامه');
      top.append(e('p',demo?'اطلاعات ساختگی است؛ ذخیره و انتشار فقط در حافظهٔ این نمونه انجام می‌شود.':'اطلاعات از API حساب متخصص دریافت شده است. فیلدهای ارائه‌نشده خالی می‌مانند.'));
      if(!demo&&!state.capabilities?.completeMealEditor)top.append(e('p','نسخهٔ فعلی سرور فقط فیلدهای پایهٔ پیش‌نویس را ذخیره می‌کند؛ جزئیات جدید و جایگزین‌ها نیازمند پشتیبانی سرور هستند. رابط کامل در نمونهٔ جداگانه قابل بررسی است.'));
      const actions=e('div',null,'actions');actions.append(button('بازگشت به فهرست',()=>{if(leave())onBack();}));
      actions.append(button('تازه‌سازی پرونده',async()=>{if(dirty&&!confirm('تغییرات ذخیره‌نشده کنار گذاشته شوند؟'))return;await perform(async()=>{const updated=await repository.get(state.id);if(!valid())return;state=updated;days=copy(state.version?.days||[]);baseline=copy(days);dirty=false;needsRefresh=false;});}));
      top.append(actions,e('p',state.displayName||'نام ارائه نشده'),e('p','شروع هفتهٔ برنامه: '+(state.weekStart?date(state.weekStart):'از سرور ارائه نشده')));const dirtyLabel=e('p');dirtyLabel.dataset.dirty='';top.append(dirtyLabel);root.append(top);
      if(failure){const alert=e('p',failure,'clinical-error');alert.setAttribute('role','alert');root.append(alert);}
      if(message){const info=e('p',message);info.setAttribute('role','status');root.append(info);}
      const navigation=e('div',null,'section-tabs');
      for(const [key,label] of [['patient','پرونده کاربر'],['editor','ویرایش برنامه'],['compare','مقایسه نسخه‌ها'],['questions','اطلاعات بیشتر']]){const b=button(label,()=>{tab=key;render();});b.setAttribute('aria-pressed',String(tab===key));navigation.append(b);}root.append(navigation);
      root.append(tab==='patient'?patientView():tab==='editor'?editorView():tab==='compare'?comparisonView():questionsView());
      if(state.version){
        const controls=section('ذخیره و انتشار'),gate=e('section');gate.dataset.gate='';controls.append(gate);
        controls.append(button('ذخیره پیش‌نویس',()=>perform(async()=>{
          if(days.length!==7){throw new Error('هفت روز برنامه را کامل کن.');}
          const updated=await repository.save(state,days);if(!valid())return;
          state=updated;days=copy(updated.version.days);baseline=copy(days);dirty=false;
        })));
        const publish=button(demo?'تأیید و انتشار نمونه':'تأیید و انتشار برنامه',async()=>{
          if(busy||dirty||needsRefresh||planIssues(state,days).length||(!demo&&!state.capabilities?.completeMealEditor)||(!demo&&days.some(d=>d.meals.some(m=>(m.alternatives||[]).some(a=>a.reviewedBy==='unconfirmed-local')))))return;
          if(!confirm(demo?'این برنامه فقط در نمونه منتشر شود؟':'این نسخهٔ بررسی‌شده برای کاربر منتشر شود؟'))return;
          await perform(async()=>{await repository.publish(state);if(!valid())return;state=await repository.get(state.id);if(valid()&&state.version?.status==='published')publishedSnapshot=copy(state.published||{days:state.version.days,versionNumber:state.version.versionNumber});});
        },false);publish.dataset.publish='';controls.append(publish);root.append(controls);
      }
      if(demo){const scenario=section('سناریوهای نمونه');for(const [value,label] of [['normal','موفق'],['save','خطای ذخیره'],['publish','خطای انتشار']])scenario.append(button(label,()=>{repository.setFailures(value==='save',value==='publish');message=`سناریو: ${label}`;render();}));root.append(scenario);}
      lock();updateGate();
    }
    active={get dirty(){return dirty;},dispose(){alive=false;root.replaceChildren();}};
    render();return root;
  }
  function leave(){if(active?.dirty&&!confirm('پیش‌نویس ذخیره نشده است. از این بخش خارج شوی؟'))return false;reset();return true;}
  function reset(){active?.dispose();active=null;}
  addEventListener('beforeunload',event=>{if(active?.dirty){event.preventDefault();event.returnValue='';}});
  window.SabzineClinical={start,leave,reset,planIssues,get dirty(){return !!active?.dirty;},get open(){return !!active;}};
})();
