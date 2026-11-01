/* Adapters for phase 6. The full-feature demonstration never writes to live APIs. */
(() => {
  const copy = value => structuredClone(value);
  const error = (message,status=409) => Object.assign(new Error(message),{status});
  function sameContent(left,right){const clean=value=>{if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!['reviewedBy','reviewedAt'].includes(k)).sort().map(k=>[k,clean(value[k])]));return value;};return JSON.stringify(clean(left))===JSON.stringify(clean(right));}
  function live(session) {
    return {
      demo:false,
      get:id=>session.api('specialist/requests/'+encodeURIComponent(id)),
      async save(request,days) {
        if(!Number.isInteger(request.version?.lockVersion))throw error('نسخهٔ ویرایش از سرور دریافت نشده است.');
        const extended=request.capabilities?.completeMealEditor===true;
        if(!extended) {
          if((request.version.days||[]).some(d=>(d.meals||[]).some(m=>m.alternatives?.length || m.instructions || m.portion || m.preparationMinutes!=null || m.quantityBasis)))throw error('API پشتیبانی کامل را اعلام نکرده؛ ذخیره برای جلوگیری از حذف جزئیات متوقف شد.',422);
          const extras=m=>({portion:m.portion,preparationMinutes:m.preparationMinutes,instructions:m.instructions,quantityBasis:m.quantityBasis,alternatives:m.alternatives});
          const baseline=new Map((request.version.days||[]).flatMap(d=>d.meals||[]).map(m=>[m.mealUid,JSON.stringify(extras(m))]));
          if(days.some(d=>d.meals.some(m=>JSON.stringify(extras(m))!==baseline.get(m.mealUid))))throw error('API فعلی جزئیات کامل و جایگزین‌ها را ذخیره نمی‌کند. برای جلوگیری از حذف داده، ذخیرهٔ این تغییرات متوقف شد. از نمونهٔ جداگانه برای بررسی رابط کامل استفاده کن.',422);
        }
        const body={days:copy(days)};
        if(!extended)body.days=days.map(d=>({meals:d.meals.map(m=>({mealUid:m.mealUid,mealType:m.mealType,suggestedTime:m.suggestedTime,title:m.title,calories:m.calories,notes:m.notes||'',items:m.items.map(i=>({name:i.name,quantity:i.quantity,unit:i.unit}))}))}));
        const result=await session.api('specialist/requests/'+encodeURIComponent(request.id)+'/draft','PUT',body,{'If-Match':String(request.version.lockVersion)});
        const updated=await this.get(request.id);
        if(updated.version?.lockVersion!==result.lockVersion)throw error('ذخیره پاسخ داد اما نسخهٔ بازخوانی‌شده یکسان نیست؛ قبل از انتشار تازه‌سازی کن.');
        if(extended && !sameContent(updated.version.days,days))throw error('همهٔ جزئیات از سرور بازنگشت؛ پیش از انتشار نسخهٔ ذخیره‌شده را بررسی کن.');
        return updated;
      },
      publish:request=>session.api('specialist/requests/'+encodeURIComponent(request.id)+'/publish','POST',undefined,{'If-Match':String(request.version.lockVersion)}),
      ask:(request,prompt)=>session.api('specialist/requests/'+encodeURIComponent(request.id)+'/questions','POST',{prompt,required:true}),
      acknowledge:id=>session.api('specialist/info-questions/'+encodeURIComponent(id)+'/acknowledge','POST'),
      versions:userId=>session.api('specialist/patients/'+encodeURIComponent(userId)+'/plan-versions'),
    };
  }
  function sample() {
    const recipe=(title)=>({mealUid:crypto.randomUUID(),mealType:'lunch',suggestedTime:'13:30',title,calories:600,notes:'نمونهٔ طراحی؛ توصیه پزشکی نیست.',portion:'یک سهم برای همین وعده',preparationMinutes:20,instructions:'مواد آماده را مطابق مقدارهای ثبت‌شده گرم و سرو کن.',quantityBasis:'برنج و مرغ پس از پخت وزن شده‌اند.',items:[{ingredientId:'rice-cooked',name:'برنج پخته',quantity:150,unit:'گرم',basis:'پخته',category:'غلات'},{ingredientId:'chicken-cooked',name:'مرغ پخته',quantity:120,unit:'گرم',basis:'پخته',category:'پروتئین'}]});
    const days=Array.from({length:7},(_,i)=>{
      const meal=recipe('مرغ و برنج نمونه '+new Intl.NumberFormat('fa-IR').format(i+1));
      meal.alternatives=['ai','specialist'].map(source=>({id:crypto.randomUUID(),source,approved:false,reviewedBy:null,reviewedAt:null,meal:recipe(source==='ai'?'جایگزین نمونه AI':'جایگزین نمونه متخصص')}));
      return {meals:[meal]};
    });
    let request={id:'clinical-demo',userId:'sample-patient',weekStart:'2026-10-31',displayName:'کاربر نمونهٔ آموزشی',status:'in_review',capabilities:{completeMealEditor:true},
      version:{status:'draft',lockVersion:1,versionNumber:2,days},
      published:{versionNumber:1,days:days.map(d=>({meals:d.meals.map(m=>({...copy(m),title:'برنامهٔ قبلی نمونه',alternatives:m.alternatives.map(a=>({...copy(a),approved:true,reviewedBy:'demo-specialist',reviewedAt:'2026-10-24T08:00:00Z'}))}))}))},
      questions:[{id:'question-demo',prompt:'آیا داروی جدیدی مصرف می‌کنی؟',required:true,status:'open',answers:[]}],
      patient:{name:'کاربر نمونهٔ آموزشی',age:32,height:165,currentWeight:72,targetWeight:68,goal:'کاهش وزن',conditions:[],allergies:null,medications:null,pregnancy:{status:'باردار نیست'},
        questionnaire:[['سلیقه غذایی','غذای ایرانی'],['سطح فعالیت','متوسط']],weights:[['۲ آبان','۷۲٫۵ کیلوگرم'],['۹ آبان','۷۲ کیلوگرم']],
        consumption:{recorded:24,adherent:20,total:28},substitutions:[['گرانی مواد اولیه','۲ بار'],['زمان آماده‌سازی','۱ بار']],feedback:[['هفتهٔ قبل','غذاهای سریع‌تر و اقتصادی‌تر ترجیح داده شده‌اند.']]}};
    const oldPublished=copy(request.published);
    let failSave=false,failPublish=false;
    return {
      demo:true,async get(){return copy(request);},
      async save(previous,newDays){await new Promise(r=>setTimeout(r,80));if(failSave)throw error('خطای ذخیره در سناریوی نمونه',503);if(previous.version.lockVersion!==request.version.lockVersion)throw error('نسخه تغییر کرده است.');if(request.status==='published'){request.status='in_review';request.version.versionNumber++;}request.version={...request.version,days:copy(newDays),lockVersion:request.version.lockVersion+1,status:'draft'};return copy(request);},
      async publish(previous){if(failPublish)throw error('انتشار نمونه ناموفق بود؛ برنامه قبلی حفظ شد.',503);if(previous.version.lockVersion!==request.version.lockVersion)throw error('نسخه تغییر کرده است.');if(request.questions.some(q=>q.required&&['open','answered'].includes(q.status)))throw error('پاسخ لازم باید بررسی شود.');request.published={versionNumber:request.version.versionNumber,days:copy(request.version.days)};request.version.status='published';request.status='published';return {status:'published'};},
      async ask(_request,prompt){request.questions.push({id:crypto.randomUUID(),prompt,required:true,status:'open',answers:[]});request.status='needs_info';},
      async acknowledge(id){const q=request.questions.find(q=>q.id===id);if(q?.status!=='answered')throw error('پاسخی دریافت نشده است.');q.status='acknowledged';if(!request.questions.some(q=>q.required&&['open','answered'].includes(q.status)))request.status='in_review';},
      async answer(){for(const q of request.questions.filter(q=>q.status==='open')){q.status='answered';q.answers=[{body:'پاسخ آموزشی: اطلاعات دارو را به‌روز کردم.'}];}},
      async versions(){return [{id:'sample-v1',versionNumber:1,status:'published',weekStart:'2026-10-24',days:copy(oldPublished.days)}];},
      setFailures(save,publish){failSave=save;failPublish=publish;},
    };
  }
  window.SabzineClinicalRepository={live,sample,copy};
})();
