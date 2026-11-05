/* Live Umami reports, fetched through the authenticated admin API. */
const trackingGoals = {weight_loss:'لاغری',weight_gain:'افزایش وزن',pregnancy:'بارداری و شیردهی',detox:'سلامت و پاکسازی'};
function trackingStepLabel(step) {
  const names={intro:'شروع',goals:'انتخاب هدف',quiz:'شروع پرسش‌نامه',preparing:'آماده‌سازی برنامه',plans:'انتخاب برنامه',contact:'ثبت شماره',payment:'پرداخت'};
  if (names[step]) return names[step];
  const parts=String(step||'').split(':');
  return parts[0]==='question' ? `سؤال ${number(parts[2])} · ${trackingGoals[parts[1]]||parts[1]}` : step;
}
async function webAnalyticsPage() {
  const root=element('div',null,'report-stack'), filters=element('div',null,'card tracking-filters');
  const label=element('label','بازهٔ گزارش'), range=element('select');
  for(const [value,text] of [[1,'۲۴ ساعت اخیر'],[7,'۷ روز اخیر'],[30,'۳۰ روز اخیر'],[90,'۹۰ روز اخیر']]) {
    const option=element('option',text); option.value=value; range.append(option);
  }
  range.value='7'; label.append(range); filters.append(label,element('p','زمان‌ها فقط هنگام نمایش صفحه و فعالیت کاربر محاسبه می‌شوند.')); root.append(filters);
  const content=element('div',null,'report-stack'); root.append(content);
  let generation=0;
  async function paint() {
    const ticket=++generation;
    content.replaceChildren(skeleton()); content.setAttribute('aria-busy','true');
    try {
      const report=await api('admin/web-analytics?days='+range.value);
      if(ticket!==generation)return;
      const stack=element('div',null,'report-stack'), cards=element('div',null,'metrics-grid');
      const stats=report.summary, rate=stats.visits ? Math.round(stats.completed/stats.visits*1000)/10 : 0;
      for(const [label,value,note] of [['بازدیدکنندگان',stats.visitors,'شناسه‌های ناشناس در بازهٔ انتخاب‌شده'],['نشست‌ها',stats.visits,'دفعات مراجعه به دمو'],['تکمیل پرسش‌نامه',stats.completed,'نشست‌هایی که پرسش‌نامه را کامل کردند'],['نرخ تکمیل',rate+'٪',number(stats.pageviews)+' بازدید صفحه']]) {
        const card=element('section',null,'card metric-card'); card.append(element('p',label),element('div',typeof value==='number'?number(value):value,'metric-value'),element('p',note,'metric-foot')); cards.append(card);
      }
      stack.append(cards);
      if(!stats.visits)stack.append(infoNote('هنوز داده‌ای در این بازه ثبت نشده است. آمار فقط از زمان فعال‌سازی رهگیری جمع‌آوری می‌شود.'));
      const table=(rows,title,description,columns)=>listPanel(rows,{title,description,columns,pageSize:10,iconName:'history',emptyTitle:'داده‌ای ثبت نشده',emptyDescription:'پس از فعالیت کاربران، گزارش این بخش تکمیل می‌شود.'});
      stack.append(table(report.goals,'انتخاب دستهٔ رژیم','تعداد کلیک‌ها و نشست‌های مستقل برای هر هدف.',[{label:'هدف',render:r=>trackingGoals[r.goal]||r.goal},{label:'کلیک',render:r=>number(r.clicks)},{label:'نشست',render:r=>number(r.visits)}]));
      stack.append(table(report.stages,'مکث در هر مرحله','میانگین زمان فعال هر نشست؛ زمان تب پنهان و بی‌فعالیتی طولانی محاسبه نمی‌شود.',[{label:'مرحله',render:r=>trackingStepLabel(r.step)},{label:'نمایش',render:r=>number(r.views)},{label:'نشست',render:r=>number(r.visits)},{label:'میانگین مکث',render:r=>number(r.averageSeconds)+' ثانیه'},{label:'زمان کل',render:r=>number(r.totalSeconds)+' ثانیه'}]));
      stack.append(table(report.exits,'آخرین مرحلهٔ نشست‌های غیرفعال','آخرین مرحلهٔ مشاهده‌شده پس از ۳۰ دقیقه بی‌فعالیتی؛ این مقدار تشخیص قطعی بستن مرورگر نیست.',[{label:'آخرین مرحله',render:r=>trackingStepLabel(r.step)},{label:'نشست',render:r=>number(r.visits)}]));
      stack.append(table(report.sources,'کانال‌های ورودی','تفکیک بر اساس UTM و دامنهٔ ارجاع؛ مستقیم یعنی منبع قابل تشخیص نیست.',[{label:'منبع',render:r=>r.source==='direct'?'مستقیم / نامشخص':r.source},{label:'کمپین',render:r=>r.campaign||'—'},{label:'نشست',render:r=>number(r.visits)}]));
      stack.append(table(report.journeys,'مسیرهای اخیر','۳۰ نشست اخیر با شناسهٔ ناشناس؛ ترتیب مراحل شامل بازگشت‌های کاربر نیز هست.',[{label:'نشست',render:r=>r.id.slice(0,8)},{label:'مسیر',render:r=>r.path.split(' → ').map(trackingStepLabel).join(' ← '),className:'cell-body'},{label:'آخرین فعالیت',render:r=>formatDate(r.last_seen)}]));
      stack.append(table(report.daily,'روند روزانه','تاریخ‌ها بر اساس منطقهٔ زمانی تهران هستند.',[{label:'روز',key:'day'},{label:'نشست',render:r=>number(r.visits)},{label:'بازدید صفحه',render:r=>number(r.pageviews)}]));
      stack.append(infoNote('نام، شمارهٔ تلفن، مقادیر پاسخ‌ها و متن پزشکی در گزارش رهگیری جمع‌آوری نمی‌شوند. ثبت تعامل سؤال، فقط وقوع تعامل را نشان می‌دهد.'));
      content.replaceChildren(stack);
    } catch(error) {if(ticket===generation)content.replaceChildren(emptyState('گزارش دریافت نشد',error.message,'error',button('تلاش دوباره',paint,{secondary:true})));}
    finally {if(ticket===generation)content.removeAttribute('aria-busy');}
  }
  range.addEventListener('change',()=>void paint()); await paint(); return root;
}
