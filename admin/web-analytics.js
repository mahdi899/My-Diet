/* Live Umami reports, fetched through the authenticated admin API. */
const trackingGoals = {weight_loss:'لاغری',weight_gain:'افزایش وزن',pregnancy:'بارداری و شیردهی',detox:'سلامت و پاکسازی'};
function trackingStepLabel(step) {
  const names={intro:'شروع',goals:'انتخاب هدف',quiz:'شروع پرسش‌نامه',preparing:'آماده‌سازی برنامه',specialists:'انتخاب پزشک',otp:'وارد کردن کد تأیید',payment_gateway:'پرداخت آنلاین',payment_transfer:'کارت‌به‌کارت',payment_success:'پرداخت تأیید شد',plans:'انتخاب برنامه',contact:'ثبت شماره',payment:'پرداخت'};
  if (names[step]) return names[step];
  const parts=String(step||'').split(':');
  return parts[0]==='question' ? `سؤال ${number(parts[2])} · ${trackingGoals[parts[1]]||parts[1]}` : step;
}
function localPhone(phone) {
  if (!phone) return '—';
  const value = String(phone);
  return value.startsWith('+98') ? '0' + value.slice(3) : value;
}
async function liveTrackingPanel(onCampaignChange) {
  const links = await api('admin/campaign-links');
  const panel = element('section', null, 'card tracking-live');
  const controls = element('div', null, 'tracking-filters');
  const label = element('label', 'لینک ورودی');
  const select = element('select');
  select.append(Object.assign(element('option', 'همهٔ لینک‌ها و ورودهای مستقیم'), { value: '' }));
  for (const link of links) {
    select.append(Object.assign(element('option', link.name + ' · /go/' + link.slug), { value: link.slug }));
  }
  const selectedLink = element('p', 'همهٔ ورودی‌ها');
  selectedLink.dir = 'auto';
  const status = element('p', 'در حال دریافت نشست‌های فعال…');
  label.append(select);
  controls.append(label, selectedLink, status);
  panel.append(sectionHead('کاربران آنلاین آنبوردینگ', 'موقعیت هر نشست فعال، با بررسی هر ثانیه'), controls);

  const result = element('section', null, 'card tracking-live');
  const resultStatus = element('p', 'در حال دریافت نتیجهٔ نشست‌ها…', 'tracking-results-status');
  const rangeTools = element('div', null, 'tracking-results-tools');
  const rangeLabel = element('label', 'بازهٔ زمانی');
  const preset = element('select');
  preset.setAttribute('aria-label', 'بازهٔ زمانی نتیجهٔ نشست‌ها');
  for (const [value, text] of [['24h', '۲۴ ساعت اخیر'], ['7d', '۷ روز اخیر'], ['30d', '۳۰ روز اخیر'], ['custom', 'بازهٔ دلخواه']]) {
    preset.append(Object.assign(element('option', text), { value }));
  }
  preset.value = '24h';
  const fromField = SabzineJalali.dateTimeField('شروع بازه، به وقت تهران');
  const toField = SabzineJalali.dateTimeField('پایان بازه، به وقت تهران');
  const fromLabel = element('label', 'از');
  const toLabel = element('label', 'تا');
  fromLabel.append(fromField.wrap);
  toLabel.append(toField.wrap);
  const customRange = element('div', null, 'tracking-range');
  customRange.hidden = true;
  customRange.setAttribute('role', 'group');
  customRange.setAttribute('aria-label', 'بازهٔ دلخواه به وقت تهران');
  customRange.append(fromLabel, toLabel, element('span', 'وقت تهران', 'tracking-range-note'));
  rangeLabel.append(preset);
  rangeTools.append(rangeLabel, customRange);
  const resultHead = sectionHead('نتیجهٔ نشست‌ها · آخرین محل ترک',
    'حداکثر ۲۰۰ نشست در بازهٔ انتخاب‌شده، برای لینک انتخاب‌شده. پس از ۲ دقیقه بدون رویداد نمایش داده می‌شود.',
    rangeTools);
  resultHead.classList.add('tracking-results-head');
  result.append(resultHead, resultStatus);

  function addTable(container, accessibleName, stepLabel) {
    const wrapper = element('div', null, 'tracking-live-table');
    const table = element('table');
    table.setAttribute('aria-label', accessibleName);
    const header = element('tr');
    for (const title of ['نشست', 'لینک ورودی', 'صفحه', stepLabel, 'شماره تلفن', 'آخرین فعالیت']) {
      const th = element('th', title);
      th.scope = 'col';
      header.append(th);
    }
    const head = element('thead'), body = element('tbody');
    head.append(header);
    table.append(head, body);
    wrapper.append(table);
    container.append(wrapper);
    return body;
  }
  const liveBody = addTable(panel, 'موقعیت زنده کاربران آنبوردینگ', 'مرحلهٔ فعلی');
  const resultBody = addTable(result, 'آخرین محل ترک نشست‌ها', 'آخرین مرحله');
  const root = element('div', null, 'report-stack');
  root.append(panel, result);

  const pages = {
    '/onboarding/': 'شروع', '/onboarding': 'شروع', '/onboarding/index.html': 'شروع',
    '/onboarding/goals.html': 'اهداف', '/onboarding/goals': 'اهداف',
    '/onboarding/quiz.html': 'پرسش‌نامه', '/onboarding/quiz': 'پرسش‌نامه',
    '/onboarding/payment.html': 'پرداخت', '/onboarding/payment': 'پرداخت',
  };
  const names = new Map(links.map(link => [link.slug, link.name]));
  const zone = { timeStyle: 'medium', timeZone: 'Asia/Tehran' };
  const liveTime = new Intl.DateTimeFormat('fa-IR', zone);
  const resultTime = new Intl.DateTimeFormat('fa-IR', { ...zone, dateStyle: 'short' });
  let selectionVersion = 0;

  function departureRange() {
    if (preset.value !== 'custom') return { ok: true, within: preset.value };
    const start = fromField.date();
    const end = toField.date();
    if (!start || !end) return { ok: false, message: 'شروع و پایان بازه را مشخص کنید.' };
    if (start > end) return { ok: false, message: 'شروع بازه باید قبل از پایان آن باشد.' };
    if (end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) return { ok: false, message: 'بازهٔ زمانی حداکثر ۹۰ روز است.' };
    if (end.getTime() > Date.now() + 60 * 1000) return { ok: false, message: 'پایان بازه نمی‌تواند در آینده باشد.' };
    return { ok: true, from: start.toISOString(), to: new Date(end.getTime() + 60 * 1000).toISOString() };
  }
  function fillCustomRange() {
    const now = new Date();
    if (!fromField.date()) fromField.setDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    if (!toField.date()) toField.setDate(now);
  }
  function startPolling(path, body, message, time, interval, emptyText, countLabel, rangeFor) {
    let previous = null, latestRequest = 0, localVersion = 0;
    async function refresh() {
      const selection = selectionVersion;
      const local = localVersion;
      const request = ++latestRequest;
      const params = new URLSearchParams();
      if (select.value) params.set('campaign', select.value);
      if (rangeFor) {
        const range = rangeFor();
        if (!range.ok) {
          if (selection === selectionVersion && local === localVersion && request === latestRequest) {
            message.textContent = range.message;
            const row = element('tr'), cell = element('td', range.message);
            cell.colSpan = 6;
            row.append(cell);
            body.replaceChildren(row);
          }
          return;
        }
        if (range.within) params.set('within', range.within);
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      }
      const query = params.toString();
      try {
        const { sessions } = await api('admin/web-analytics/' + path + (query ? '?' + query : ''));
        if (selection !== selectionVersion || local !== localVersion || request !== latestRequest) return;
        message.textContent = number(sessions.length) + ' ' + countLabel;
        const signature = JSON.stringify(sessions);
        if (signature === previous) return;
        previous = signature;
        if (!sessions.length) {
          const row = element('tr'), cell = element('td', emptyText);
          cell.colSpan = 6;
          row.append(cell);
          body.replaceChildren(row);
          return;
        }
        body.replaceChildren(...sessions.map(session => {
          const row = element('tr');
          const id = element('td', session.id.slice(0, 8));
          id.dir = 'ltr';
          const phone = element('td', localPhone(session.phone));
          if (session.phone) phone.dir = 'ltr';
          row.append(id, element('td', names.get(session.campaign) || session.campaign || 'مستقیم / نامشخص'),
            element('td', pages[session.page] || session.page),
            element('td', trackingStepLabel(session.step) || '—'),
            phone,
            element('td', time.format(new Date(session.lastSeen))));
          return row;
        }));
      } catch (error) {
        if (selection === selectionVersion && local === localVersion && request === latestRequest) {
          message.textContent = error instanceof Error && error.message ? error.message : 'دریافت اطلاعات ممکن نشد؛ دوباره بررسی می‌شود.';
        }
      }
    }
    function invalidate() {
      localVersion++;
      previous = null;
      body.replaceChildren();
      message.textContent = 'در حال دریافت…';
      void refresh();
    }
    select.addEventListener('change', invalidate);
    const poll = async () => {
      if (!root.isConnected) return;
      if (!document.hidden) await refresh();
      setTimeout(poll, interval);
    };
    setTimeout(poll, interval);
    void refresh();
    return invalidate;
  }

  select.addEventListener('change', () => {
    selectionVersion++;
    selectedLink.textContent = select.value ? location.origin + '/go/' + select.value : 'همهٔ ورودی‌ها';
    if (onCampaignChange) onCampaignChange(select.value);
  });
  startPolling('live', liveBody, status, liveTime, 1000, 'نشست فعالی برای این انتخاب وجود ندارد.', 'نشست فعال');
  const reloadDepartures = startPolling('departures', resultBody, resultStatus, resultTime, 10000, 'نشستی در این بازه ثبت نشده است.', 'نشست در نتیجه', departureRange);
  preset.addEventListener('change', () => {
    const custom = preset.value === 'custom';
    customRange.hidden = !custom;
    if (custom) fillCustomRange();
    reloadDepartures();
  });
  fromField.onChange = reloadDepartures;
  toField.onChange = reloadDepartures;
  return root;
}

async function webAnalyticsPage() {
  const root=element('div',null,'report-stack'), filters=element('div',null,'card tracking-filters');
  const label=element('label','بازهٔ گزارش'), range=element('select');
  for(const [value,text] of [[1,'۲۴ ساعت اخیر'],[7,'۷ روز اخیر'],[30,'۳۰ روز اخیر'],[90,'۹۰ روز اخیر']]) {
    const option=element('option',text); option.value=value; range.append(option);
  }
  const reset = button('ریست داده‌ها', () => confirmAction(
    'ریست گزارش رهگیری',
    'گزارش از همین لحظه دوباره شروع می‌شود. رویدادهای قبلی در گزارش نمایش داده نمی‌شوند.',
    'ریست گزارش',
    async () => { await api('admin/web-analytics/reset', 'POST', {}); notice('گزارش رهگیری ریست شد'); },
  ), { secondary: true, iconName: 'history' });
  const history = element('details', null, 'card tracking-history');
  const historySummary = element('summary', 'گزارش تاریخی همهٔ ورودی‌ها');
  history.append(historySummary);
  let campaign = '';
  const live = await liveTrackingPanel(slug => {
    campaign = slug || '';
    historySummary.textContent = campaign ? 'گزارش تاریخی لینک انتخاب‌شده' : 'گزارش تاریخی همهٔ ورودی‌ها';
    if (history.open) void paint();
  });
  root.append(live, history);
  range.value='7'; label.append(range); filters.append(label,reset); history.append(filters);
  const content=element('div',null,'report-stack'); history.append(content);
  let generation=0;
  async function paint() {
    const ticket=++generation;
    if(!content.childElementCount)content.replaceChildren(skeleton());
    content.setAttribute('aria-busy','true');
    try {
      const params=new URLSearchParams({days:range.value});
      if(campaign)params.set('campaign',campaign);
      const report=await api('admin/web-analytics?'+params.toString());
      if(ticket!==generation)return;
      if(content.contains(document.activeElement))return;
      const stack=element('div',null,'report-stack'), cards=element('div',null,'metrics-grid');
      const stats=report.summary, rate=stats.visits ? Math.round(stats.completed/stats.visits*1000)/10 : 0;
      for(const [label,value,note] of [['بازدیدکنندگان',stats.visitors,'شناسه‌های ناشناس در بازهٔ انتخاب‌شده'],['نشست‌ها',stats.visits,'دفعات مراجعه به دمو'],['تکمیل پرسش‌نامه',stats.completed,'نشست‌هایی که پرسش‌نامه را کامل کردند'],['نرخ تکمیل',rate+'٪',number(stats.pageviews)+' بازدید صفحه']]) {
        const card=element('section',null,'card metric-card'); card.append(element('p',label),element('div',typeof value==='number'?number(value):value,'metric-value'),element('p',note,'metric-foot')); cards.append(card);
      }
      stack.append(cards);
      if (report.resetAt) stack.append(infoNote('آخرین ریست: ' + new Date(report.resetAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })));
      if(!stats.visits)stack.append(infoNote('هنوز داده‌ای در این بازه ثبت نشده است. آمار فقط از زمان فعال‌سازی رهگیری جمع‌آوری می‌شود.'));
      const table=(rows,title,description,columns)=>listPanel(rows,{title,description,columns,pageSize:10,iconName:'history',emptyTitle:'داده‌ای ثبت نشده',emptyDescription:'پس از فعالیت کاربران، گزارش این بخش تکمیل می‌شود.'});
      const maximum=Math.max(0,...report.goals.map(r=>r.clicks));
      stack.append(table(report.goals,'انتخاب دستهٔ رژیم','درصد از مجموع کلیک‌های انتخاب هدف در بازهٔ انتخاب‌شده.',[{label:'هدف',render:r=>(trackingGoals[r.goal]||r.goal)+(r.clicks===maximum?' · بیشترین کلیک':'')},{label:'درصد کلیک',render:r=>number(r.percent)+'٪'},{label:'کلیک',render:r=>number(r.clicks)},{label:'نشست',render:r=>number(r.visits)}]));
      stack.append(table(report.exits,'ریزش کاربران بر اساس صفحه و سؤال','هر مسیر مستقل پس از ۲ دقیقه بی‌فعالیتی؛ مسیرهای ثبت شماره حذف می‌شوند. شروع مسیر جدید، ریزش قبلی را حذف نمی‌کند. سؤال نمایش‌داده‌شدهٔ آخر محاسبه می‌شود؛ بستن مرورگر قطعی نیست.',[{label:'صفحه / سؤال',render:r=>trackingStepLabel(r.step)},{label:'مسیر ریزش‌کرده',render:r=>number(r.visits)},{label:'سهم از ریزش‌ها',render:r=>number(r.percent)+'٪'}]));
      stack.append(table(report.sources,'کانال‌های ورودی','تفکیک بر اساس UTM و دامنهٔ ارجاع؛ مستقیم یعنی منبع قابل تشخیص نیست.',[{label:'منبع',render:r=>r.source==='direct'?'مستقیم / نامشخص':r.source},{label:'کمپین',render:r=>r.campaign||'—'},{label:'نشست',render:r=>number(r.visits)}]));
      content.replaceChildren(stack);
    } catch (error) {
      if (ticket === generation) content.replaceChildren(emptyState('گزارش دریافت نشد', error.message, 'error', button('تلاش دوباره', paint, { secondary: true })));
    } finally {
      if (ticket === generation) content.removeAttribute('aria-busy');
    }
  }
  range.addEventListener('change', () => void paint());
  history.addEventListener('toggle', () => { if (history.open) void paint(); });
  return root;
}
