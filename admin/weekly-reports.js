/* Explicit frontend fixtures, not real patients, live AI or server reports. */
(() => {
  const { element, date } = WorkspaceUI;
  const samples = [
    { id:'sample-01', patient:'کاربر نمونه الف', week:'2026-10-24T00:00:00+03:30',end:'2026-10-30T23:59:59+03:30',generated:'2026-10-31T09:00:00+03:30',version:2,status:'ready',expected:28,recorded:24,adherent:20,
      previous:{recorded:18,adherent:15,expected:28},favorites:['عدسی','مرغ و برنج'],disliked:['سوپ جو'],reasons:[['زمان آماده‌سازی',3],['گران بودن',1]],
      preparation:'دو وعده برای محل کار زمان‌بر بوده است.',budget:'تهیهٔ بعضی مواد برای کاربر گران بوده است.',availability:'برخی سبزیجات در دسترس نبوده است.',portion:'مناسب',service:'خوب',
      weights:['۲ آبان: ۷۲ کیلوگرم','۸ آبان: ۷۱٫۶ کیلوگرم'],health:'تغییر جدیدی در نمونه گزارش نشده؛ این به معنی نبود بیماری نیست.',suggestions:['وعده‌های سریع‌تر برای محل کار بررسی شوند.','جایگزین اقتصادی‌تر با بررسی متخصص در نظر گرفته شود.']},
    { id:'sample-02',patient:'کاربر نمونه الف',week:'2026-10-17T00:00:00+03:30',end:'2026-10-23T23:59:59+03:30',generated:'2026-10-24T09:00:00+03:30',version:1,status:'partial',expected:28,recorded:18,adherent:15,
      previous:null,favorites:['نان و پنیر'],disliked:[],reasons:[['مواد اولیه موجود نیست',2]],preparation:'اطلاعات کامل نیست',budget:'بازخورد ثبت نشده',availability:'بازخورد ثبت نشده',portion:'ثبت نشده',service:'ثبت نشده',weights:[],health:'اطلاعات تغییرات سلامت ارائه نشده',suggestions:['قبل از نتیجه‌گیری، بازخورد هفته دریافت شود.']},
    { id:'sample-03',patient:'کاربر نمونه ب',week:'2026-10-24T00:00:00+03:30',end:'2026-10-30T23:59:59+03:30',generated:null,version:1,status:'pending',expected:28,recorded:0,adherent:0,previous:null},
    { id:'sample-04',patient:'کاربر نمونه ب',week:'2026-10-17T00:00:00+03:30',end:'2026-10-23T23:59:59+03:30',generated:null,version:1,status:'failed',expected:28,recorded:0,adherent:0,previous:null},
  ];
  const labels={ready:'آماده',partial:'داده ناقص',pending:'در انتظار آماده‌سازی',failed:'آماده‌سازی ناموفق'};
  const number = value => new Intl.NumberFormat('fa-IR').format(value);
  const ratio=(count,total)=> total>0 ? `${number(count)} از ${number(total)} (${number(Math.round(100*count/total))}٪)` : 'قابل محاسبه نیست';
  const stat=(value,label)=>{const node=element('div',null,'report-stat');node.append(element('strong',value),element('span',label));return node;};
  const block=(title,lines)=>{const section=element('section',null,'report-block');section.append(element('h3',title));
    const filled=lines.filter(([,value])=>value);if(!filled.length){section.append(element('p','موردی ثبت نشده.','report-empty'));return section;}
    const wrap=element('div',null,'report-table-wrap'),table=element('table',null,'report-table'),head=element('tr'),body=element('tbody'),thead=element('thead');
    head.append(element('th','موضوع'),element('th','جزئیات'));thead.append(head);table.append(thead,body);
    for(const [label,value] of filled){const row=element('tr');row.append(element('td',label),element('td',value));body.append(row);}
    wrap.append(table);section.append(wrap);return section;};
  const digits=value=>String(value).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace('٫','.');
  const weightTable=items=>{
    let previous=null;
    const rows=(items||[]).map(item=>{
      const parts=String(item).split(':');
      const when=parts.length>1?parts[0].trim():item;
      const amount=parts.length>1?parts.slice(1).join(':').trim():'—';
      const kilos=Number(digits(amount).replace(/[^\d.]/g,''));
      let change='—';
      if(previous!=null&&Number.isFinite(kilos)){const delta=Math.round((kilos-previous)*10)/10;change=(delta>0?'+':'')+number(delta)+' کیلوگرم';}
      if(Number.isFinite(kilos))previous=kilos;
      return [when,amount,change];
    });
    const section=element('section',null,'report-block');section.append(element('h3','تغییر وزن'));
    if(!rows.length){section.append(element('p','وزنی ثبت نشده.','report-empty'));return section;}
    const wrap=element('div',null,'report-table-wrap'),table=element('table',null,'report-table'),head=element('tr'),body=element('tbody'),thead=element('thead');
    for(const header of ['تاریخ','وزن','تغییر'])head.append(element('th',header));
    thead.append(head);table.append(thead,body);
    for(const cells of rows){const row=element('tr');for(const cell of cells)row.append(element('td',cell));body.append(row);}
    wrap.append(table);section.append(wrap);return section;
  };
  async function render(session, onChat) {
    const view=element('section',null,'weekly-screen');
    let people=[...new Set(samples.map(r=>r.patient))].map(name=>({name}));
    if(session?.active){
      try{
        const queue=await session.api('specialist/queue');
        const seen=new Set(),fromQueue=[];
        for(const row of queue){const name=(row.displayName||'').trim();if(!name||seen.has(name))continue;seen.add(name);fromQueue.push({name,requestId:row.id});}
        if(fromQueue.length)people=fromQueue;
      }catch{/* keep the sample list when the queue cannot be read */}
    }
    function showList(){
      view.replaceChildren();
      if(!people.length){view.append(element('p','هنوز کاربری نیست.','report-empty'));return;}
      const list=element('div',null,'weekly-users');
      for(const person of people){
        const open=element('button',null,'weekly-user');open.type='button';open.onclick=()=>showReport(person);
        open.append(element('strong',person.name),element('span','‹','weekly-chevron'));list.append(open);
      }
      view.append(list);
    }
    function showReport(person){
      const weeks=samples.filter(r=>r.patient===person.name);
      view.replaceChildren();
      const sheet=element('article',null,'weekly-report'),actions=element('div',null,'report-actions');
      const back=element('button','فهرست','secondary');back.type='button';back.onclick=showList;
      actions.append(back);
      sheet.append(actions,element('h2',person.name));
      if(!weeks.length){sheet.append(element('p','برای این کاربر هنوز گزارش هفته ثبت نشده.','report-empty'));view.append(sheet);return;}
      const picks=element('div',null,'week-switch'),body=element('div');
      function draw(id){
        const report=weeks.find(r=>r.id===id)||weeks[0];
        for(const button of picks.querySelectorAll('button'))button.classList.toggle('active',button.dataset.id===report.id);
        body.replaceChildren(element('p',`${date(report.week)} تا ${date(report.end)} · ${labels[report.status]}`,'report-meta'));
        if(['pending','failed'].includes(report.status)){body.append(element('p',report.status==='failed'?'گزارش این هفته آماده نشده.':'گزارش این هفته هنوز آماده نیست.','report-empty'));return;}
        const stats=element('div',null,'report-stats');
        stats.append(stat(ratio(report.recorded,report.expected),'ثبت وعده'),stat(ratio(report.adherent,report.expected),'طبق برنامه'),stat(report.previous?ratio(report.previous.adherent,report.previous.expected):'—','رعایت هفتهٔ قبل'));
        body.append(stats,
          block('غذا',[['غذاهای محبوب',report.favorites?.join('، ')],['غذاهای نامطلوب',report.disliked?.join('، ')],['جایگزینی',report.reasons?.map(([label,count])=>`${label} ${number(count)} بار`).join('، ')]]),
          block('تجربهٔ هفته',[['آماده‌سازی',report.preparation],['هزینه',report.budget],['مواد',report.availability],['مقدار وعده',report.portion],['ارتباط',report.service]]),
          weightTable(report.weights),
          block('پیگیری',[['سلامت',report.health],['پیشنهاد',report.suggestions?.join('، ')]]),
        );
      }
      if(weeks.length>1){
        for(const report of weeks){const pick=element('button',date(report.week),'secondary');pick.type='button';pick.dataset.id=report.id;pick.onclick=()=>draw(report.id);picks.append(pick);}
        sheet.append(picks);
      }
      sheet.append(body);view.append(sheet);draw(weeks[0].id);
    }
    showList();return view;
  }
  window.SabzineWeeklyReports={render};
})();
