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
  function render() {
    const view=element('section'), banner=element('section',null,'card');
    banner.append(element('h2','گزارش‌های هفتگی کاربران'),element('p','حالت نمونهٔ طراحی؛ نام‌ها و آمار آزمایشی هستند و از کاربران واقعی یا سرویس AI دریافت نشده‌اند.'));
    view.append(banner);
    const filters=element('section',null,'card'), patient=element('select'), week=element('select'), content=element('section');
    patient.setAttribute('aria-label','کاربر نمونه');week.setAttribute('aria-label','هفته گزارش');
    for(const name of [...new Set(samples.map(r=>r.patient))]) {const option=element('option',name);option.value=name;patient.append(option);}
    const patientLabel=element('label','کاربر '),weekLabel=element('label','هفته ');patientLabel.append(patient);weekLabel.append(week);filters.append(patientLabel,weekLabel);view.append(filters,content);
    function list(title,values) {
      const section=element('section',null,'card');section.append(element('h3',title));
      if(!values?.length)section.append(element('p','اطلاعات ارائه نشده؛ به معنی «هیچ موردی وجود ندارد» نیست.'));
      else { const ul=element('ul');for(const value of values)ul.append(element('li',value));section.append(ul); }
      return section;
    }
    function show() {
      const report=samples.find(r=>r.id===week.value);content.replaceChildren();
      if(!report){content.append(element('p','گزارشی برای این انتخاب موجود نیست.'));return;}
      const header=element('section',null,'card');header.append(element('h3',`نمونه گزارش AI · نسخه ${number(report.version)}`),element('p',`${date(report.week)} تا ${date(report.end)}`),element('p',`وضعیت: ${labels[report.status]}`),element('p',`زمان تولید: ${report.generated?new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(report.generated)):'هنوز تولید نشده'}`));content.append(header);
      if(['pending','failed'].includes(report.status)) { content.append(element('p',report.status==='failed'?'گزارش نمونه آماده نشده؛ نتیجه‌ای برای تصمیم‌گیری موجود نیست.':'در سناریوی نمونه، گزارش هنوز آماده نشده است.'));return; }
      content.append(list('ثبت وعده و رعایت برنامه',[
        `وعده‌های ثبت‌شده: ${ratio(report.recorded,report.expected)}`,
        `وعده‌های طبق برنامه: ${ratio(report.adherent,report.expected)}`,
        'ثبت «نخوردم» یا غذای متفاوت، رعایت برنامه محسوب نمی‌شود.',
        `پوشش داده: ${ratio(report.recorded,report.expected)}؛ آمار دادهٔ ثبت‌نشده حدس زده نشده است.`,
      ]));
      content.append(list('مقایسه با هفته قبل',report.previous?[
        `ثبت وعده: این هفته ${ratio(report.recorded,report.expected)}؛ هفته قبل ${ratio(report.previous.recorded,report.previous.expected)}`,
        `رعایت برنامه: این هفته ${ratio(report.adherent,report.expected)}؛ هفته قبل ${ratio(report.previous.adherent,report.previous.expected)}`,
      ]:[]));
      content.append(list('غذاهای محبوب',report.favorites),list('غذاهای نامطلوب',report.disliked),list('دلایل جایگزینی',report.reasons.map(([label,count])=>`${label}: ${number(count)} بار`)),
        list('آماده‌سازی، هزینه و دسترسی',[report.preparation,report.budget,report.availability]),list('مقدار وعده و ارتباط با متخصص',[report.portion,report.service]),list('ثبت وزن',report.weights),list('تغییرات اطلاعات سلامت',[report.health]),list('نکات پیشنهادی برای برنامه بعد',[...report.suggestions,'این پیشنهادها نمونه‌اند و نیاز به بررسی متخصص دارند.']));
    }
    function selectPatient() {
      week.replaceChildren();for(const report of samples.filter(r=>r.patient===patient.value)) {const option=element('option',`${date(report.week)} · ${labels[report.status]}`);option.value=report.id;week.append(option);}show();
    }
    patient.onchange=selectPatient;week.onchange=show;selectPatient();return view;
  }
  window.SabzineWeeklyReports={render};
})();
