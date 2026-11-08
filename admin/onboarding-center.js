/* Onboarding data: profiles with filters and audited detail, the demo-to-plan funnel, and demo leads. */
const SabzineOnboarding = (() => {
  const trackNames = { weight_loss: 'کاهش وزن', weight_gain: 'افزایش وزن', pregnancy: 'بارداری و شیردهی', detox: 'پاکسازی و تعادل' };
  const tierNames = { ai_ok: 'مناسب پیش‌نویس AI', doctor_only: 'فقط پزشک' };
  const sourceNames = { app: 'اپلیکیشن', demo: 'دموی وب' };
  const dietNames = { omnivore: 'همه‌چیزخوار', vegetarian: 'گیاه‌خوار', vegan: 'وگان' };
  const flagNames = { diabetes: 'دیابت', pregnancy: 'بارداری', eating_disorder: 'اختلال خوردن', kidney: 'کلیه', thyroid: 'تیروئید', underweight: 'کم‌وزنی', minor: 'زیر ۱۸ سال', rapid_loss: 'کاهش وزن سریع', heart: 'قلب' };
  const label = (map, key) => map[key] || key;
  const stat = (name, value, note, tone = 'green') => {
    const card = element('section', null, 'card metric-card'), top = element('div', null, 'metric-top');
    top.append(element('p', name), iconTile('users', tone)); card.append(top, element('div', number(value), 'metric-value'), element('div', note, 'metric-foot')); return card;
  };
  const pairs = (obj) => {
    const dl = element('dl', null, 'ob-pairs');
    for (const [k, v] of obj) { if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue; dl.append(element('dt', k), element('dd', Array.isArray(v) ? v.join('، ') : String(v))); }
    return dl;
  };

  function detailModal(userId) {
    openModal('پروندهٔ تغذیه‌ای', async (body) => {
      body.append(skeleton());
      try {
        const d = await api('admin/onboarding/profiles/' + userId);
        const p = d.profile;
        const view = element('div', null, 'ob-detail');
        view.append(infoNote('مشاهدهٔ این اطلاعات در تاریخچهٔ فعالیت ثبت شد. شمارهٔ تماس و پاسخ‌های متنی فقط برای بررسی بالینی هستند.'));
        view.append(element('h3', d.name || 'بدون نام'), pairs([['تلفن', d.phone], ['هدف', label(trackNames, p.track)], ['منبع', label(sourceNames, p.source)], ['سطح ایمنی', label(tierNames, p.safetyTier)], ['دلایل ایمنی', (p.safetyReasons || []).map(r => label(flagNames, r))]]));
        view.append(element('h3', 'بدن و انرژی'), pairs([['جنسیت', p.sex === 'male' ? 'مرد' : 'زن'], ['سن', p.age], ['قد', p.heightCm + ' سانتی‌متر'], ['وزن', p.weightKg + ' کیلوگرم'], ['وزن هدف', p.targetWeightKg ? p.targetWeightKg + ' کیلوگرم' : null], ['BMI', p.bmi], ['BMR', p.bmrKcal + ' کیلوکالری'], ['TDEE', p.tdeeKcal + ' کیلوکالری'], ['هدف روزانه', p.targetKcal + ' کیلوکالری'], ['درشت‌مغذی‌ها', `پروتئین ${p.proteinG} · کربوهیدرات ${p.carbsG} · چربی ${p.fatG} گرم`]]));
        view.append(element('h3', 'تغذیه'), pairs([['سبک', label(dietNames, p.dietStyle)], ['تعداد وعده', p.mealsPerDay], ['بودجه', p.budget], ['منطقه', p.region], ['آلرژی‌ها', p.allergens], ['بیماری‌ها', p.conditions], ['پرچم‌های خطر', (p.riskFlags || []).map(r => label(flagNames, r))]]));
        if (d.submission) {
          const answers = Object.entries(d.submission.answers || {}).filter(([, v]) => typeof v === 'string' && v.trim());
          if (answers.length) view.append(element('h3', 'پاسخ‌های متنی کاربر'), pairs(answers));
        }
        view.append(element('h3', 'درخواست‌های برنامه'), pairs(d.planRequests.map(r => [formatDate(r.created_at), r.status])));
        body.replaceChildren(view);
      } catch (error) { body.replaceChildren(emptyState('خطا', error.message, 'error')); }
    }, { iconName: 'users' });
  }

  async function profilesTab() {
    const view = element('div', null, 'report-stack');
    const filters = { track: '', tier: '', source: '', allergen: '', q: '' };
    const bar = element('form', null, 'ob-filters');
    const select = (name, title, options) => { const s = element('select'); s.setAttribute('aria-label', title); s.append(Object.assign(element('option', title), { value: '' })); for (const [v, l] of options) s.append(Object.assign(element('option', l), { value: v })); s.onchange = () => { filters[name] = s.value; void reload(); }; bar.append(s); };
    select('track', 'همهٔ اهداف', Object.entries(trackNames)); select('tier', 'همهٔ سطوح ایمنی', Object.entries(tierNames)); select('source', 'همهٔ منابع', Object.entries(sourceNames));
    select('allergen', 'همهٔ آلرژی‌ها', [['gluten', 'گلوتن'], ['dairy', 'لبنیات'], ['nuts', 'آجیل'], ['egg', 'تخم‌مرغ'], ['seafood', 'غذای دریایی'], ['soy', 'سویا'], ['sesame', 'کنجد']]);
    const search = searchField('جستجوی نام کاربر…'); let timer; search.input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { filters.q = search.input.value.trim(); void reload(); }, 300); }; bar.append(search.wrap);
    bar.onsubmit = e => e.preventDefault();
    const holder = element('div');
    let items = [], cursor = null;
    const draw = () => {
      holder.replaceChildren(listPanel(items, { title: 'پروفایل‌های تغذیه‌ای', description: number(items.length) + ' پروفایل بارگذاری شد', search: false, pageSize: 15, iconName: 'users', emptyTitle: 'پروفایلی پیدا نشد', emptyDescription: 'پس از تکمیل ثبت‌نام، پروفایل کاربران اینجا دیده می‌شود.', columns: [
        { label: 'کاربر', render: r => personCell(r.name, r.phone) }, { label: 'هدف', render: r => label(trackNames, r.track) }, { label: 'منبع', render: r => label(sourceNames, r.source) },
        { label: 'سن/BMI', render: r => `${number(r.age)} · ${r.bmi != null ? number(Math.round(r.bmi * 10) / 10) : '—'}` }, { label: 'کالری هدف', render: r => number(r.targetKcal) },
        { label: 'ایمنی', render: r => badge(r.safetyTier === 'ai_ok' ? 'completed' : 'pending', label(tierNames, r.safetyTier)) },
        { label: 'ریسک‌ها', render: r => (r.riskFlags || []).map(f => label(flagNames, f)).join('، ') || '—' }, { label: 'رضایت', render: r => r.consented ? 'ثبت‌شده' : '—' },
        { label: 'به‌روزرسانی', render: r => formatDate(r.updatedAt), className: 'cell-nowrap' }, { label: '', render: r => button('جزئیات', () => detailModal(r.userId), { secondary: true, iconName: 'chevron-left' }) },
      ] }));
      if (cursor) holder.append(button('بارگذاری بیشتر', async () => { await fetchPage(true); draw(); }, { secondary: true, iconName: 'plus' }));
    };
    const fetchPage = async (append) => {
      const params = new URLSearchParams({ limit: '50' }); for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v); if (append && cursor) params.set('cursor', cursor);
      const result = await api('admin/onboarding/profiles?' + params); items = append ? items.concat(result.items) : result.items; cursor = result.nextCursor;
    };
    const reload = async () => { try { await fetchPage(false); draw(); } catch (error) { notice(error.message, 'error'); } };
    await fetchPage(false); draw(); view.append(bar, holder); return view;
  }

  async function funnelTab() {
    const data = await api('admin/onboarding/funnel');
    const s = data.stages;
    const view = element('div', null, 'report-stack');
    // [label, value, index of the stage the rate is measured against]. Open drafts are people still filling in the form, so they are not a step between demo and profile.
    const stages = [['سرنخ دمو', s.demoLeads, null], ['تلفن تأییدشده', s.demoVerified, 0], ['ورود به اپ', s.demoClaimed, 1], ['در حال تکمیل (پیش‌نویس باز)', s.drafts, null], ['پروفایل کامل', s.profiles, null], ['رضایت‌نامه', s.consented, 4], ['درخواست برنامه', s.requests, 5], ['برنامهٔ منتشرشده', s.published, 6]];
    const max = Math.max(1, ...stages.map(x => x[1]));
    const card = element('section', null, 'card'); card.append(sectionHead('قیف از دموی وب تا برنامهٔ تأییدشده', 'هر مرحله شمارش یکتا از دیتابیس است.', button('تازه‌سازی نمودار روزانه', async () => { await api('admin/onboarding/funnel/refresh', 'POST'); notice('به‌روز شد'); await load(); }, { secondary: true, iconName: 'history' })));
    stages.forEach(([name, value, from]) => {
      const bar = element('div', null, 'ob-bar'); const fill = element('span', null, 'ob-bar-fill'); fill.style.inlineSize = Math.max(2, Math.round(value / max * 100)) + '%';
      const prev = from == null ? null : stages[from][1]; const rate = prev ? ` · ${number(Math.round(value / prev * 100))}٪ از مرحلهٔ قبل` : '';
      const track = element('div', null, 'ob-bar-track'); track.append(fill);
      bar.append(element('strong', name), track, element('span', number(value) + rate)); card.append(bar);
    });
    view.append(card, stat('فقط پزشک', s.doctorOnly, 'پروفایل‌هایی که پیش‌نویس AI ندارند و مستقیم به پزشک می‌روند', 'rose'));
    view.append(listPanel(data.daily, { title: 'ثبت‌نام روزانه', pageSize: 10, search: false, iconName: 'calendar', emptyTitle: 'دادهٔ روزانه‌ای نیست', emptyDescription: 'پس از تازه‌سازی نمودار، آمار روزانه اینجا دیده می‌شود.', columns: [
      { label: 'روز', key: 'day' }, { label: 'هدف', render: r => label(trackNames, r.track) }, { label: 'منبع', render: r => label(sourceNames, r.source) }, { label: 'پروفایل', render: r => number(r.profiles) }, { label: 'میانگین BMI', render: r => r.avg_bmi != null ? number(Math.round(r.avg_bmi * 10) / 10) : '—' }, { label: 'فقط پزشک', render: r => number(r.doctor_only) },
    ] }));
    return view;
  }

  async function leadsTab() {
    const data = await api('admin/onboarding/demo-leads?limit=100');
    return listPanel(data.items, { title: 'سرنخ‌های دموی وب', description: 'کاربرانی که در دمو پرسش‌نامه را پر کرده‌اند. با ورود با همان شماره، پاسخ‌ها خودکار به اپ منتقل می‌شود.', pageSize: 12, iconName: 'users', emptyTitle: 'هنوز سرنخی ثبت نشده', columns: [
      { label: 'تلفن', render: r => element('span', r.phone, 'ltr') }, { label: 'هدف', render: r => label(trackNames, r.goal) }, { label: 'تأیید تلفن', render: r => r.phoneVerified ? badge('verified', 'تأییدشده') : badge('pending', 'تأییدنشده') },
      { label: 'انتقال به اپ', render: r => r.claimedUserId ? badge('completed', 'وارد اپ شد') : badge('pending', 'منتظر ورود') }, { label: 'زمان ثبت', render: r => formatDate(r.createdAt), className: 'cell-nowrap' },
    ] });
  }

  async function page() {
    const tabs = [['profiles', 'پروفایل‌ها', profilesTab], ['funnel', 'قیف ثبت‌نام', funnelTab], ['leads', 'سرنخ‌های دمو', leadsTab]];
    const root = element('div', null, 'ai-center'); const bar = element('div', null, 'ai-tabs'); bar.setAttribute('role', 'tablist'); const body = element('div', null, 'ai-tab-body');
    const show = async key => {
      sessionStorage.setItem('ob-tab', key); bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tab === key; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
      body.replaceChildren(skeleton());
      try { body.replaceChildren(await tabs.find(t => t[0] === key)[2]()); } catch (error) { body.replaceChildren(emptyState('خطا در دریافت اطلاعات', error.message, 'error', button('تلاش دوباره', () => show(key), { secondary: true }))); }
    };
    for (const [key, name] of tabs) { const b = element('button', name, 'ai-tab'); b.type = 'button'; b.dataset.tab = key; b.setAttribute('role', 'tab'); b.onclick = () => show(key); bar.append(b); }
    root.append(bar, body); const saved = sessionStorage.getItem('ob-tab'); await show(tabs.some(t => t[0] === saved) ? saved : 'profiles'); return root;
  }
  return { page };
})();
