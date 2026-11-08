/* AI centre: providers and keys, model pools with fallback, budget and usage, prompt versions, draft quality.
   Keys are write-only: the server never returns them, only a hint of the last characters. */
const SabzineAi = (() => {
  const usd = micros => {
    const value = (micros || 0) / 1e6;
    const text = '$' + value.toFixed(value !== 0 && Math.abs(value) < 0.1 ? 4 : 2);
    return element('span', text, 'ltr');
  };
  const toMicros = text => {
    const value = Number(String(text).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) throw new Error('مبلغ معتبر نیست');
    return Math.round(value * 1e6);
  };
  const kindNames = { openrouter: 'OpenRouter', openai_compatible: 'سازگار با OpenAI' };
  const strategyNames = { priority: 'به ترتیب اولویت', cost_first: 'ارزان‌ترین اول', weighted: 'وزنی (پخش بار)' };
  const reasonNames = { high_risk: 'پرونده پرخطر', kill_switch: 'کلید توقف اضطراری', cost_cap: 'سقف هزینهٔ روزانه', monthly_cap: 'سقف هزینهٔ ماهانه', user_quota: 'سهمیهٔ روزانهٔ کاربر', invalid_draft: 'خروجی مدل قابل‌استفاده نبود', budget_blocked: 'سقف هزینهٔ درخواست' };
const poolTitles = { plan_draft: 'پیش‌نویس برنامهٔ غذایی', plan_critic: 'بازبینی فرهنگی و بالینی' };
  const outcomeNames = { ok: 'موفق', rate_limited: 'محدودیت نرخ', auth_failed: 'کلید/اعتبار', rejected: 'رد شد', timeout: 'مهلت تمام شد', invalid_json: 'JSON نامعتبر', invalid_plan: 'برنامهٔ نامعتبر', outcome_unknown: 'نامشخص', budget_blocked: 'سقف هزینه' };

  const row = (...nodes) => { const r = element('div', null, 'ai-row'); r.append(...nodes.filter(Boolean)); return r; };
  const optional = input => { input.required = false; return input; };
  const mono = (text, tone) => element('span', text, 'mono' + (tone ? ' ' + tone : ''));

  function addSelectOptions(select, options, selected) {
    for (const [value, label] of options) { const option = Object.assign(element('option', label), { value }); if (value === selected) option.selected = true; select.append(option); }
  }

  // ------------------------------------------------------------------ providers

  function providerModal(existing) {
    openModal(existing ? 'ویرایش سرویس' : 'افزودن سرویس هوش مصنوعی', (body, dialog) => {
      const form = element('form');
      const kind = field(form, 'kind', 'نوع سرویس', 'select');
      addSelectOptions(kind, Object.entries(kindNames), existing?.kind || 'openrouter');
      if (existing) kind.disabled = true;
      field(form, 'name', 'نام نمایشی', 'text', existing?.name || '');
      const url = optional(field(form, 'baseUrl', 'نشانی API (برای OpenRouter خالی بگذارید)', 'url', existing?.baseUrl || ''));
      url.dir = 'ltr'; url.placeholder = 'https://openrouter.ai/api/v1';
      const key = optional(field(form, 'apiKey', existing ? 'کلید API جدید (خالی = بدون تغییر)' : 'کلید API', 'password'));
      key.dir = 'ltr'; key.autocomplete = 'off'; key.placeholder = 'sk-or-v1-…'; key.required = !existing && false;
      help(key, 'کلید رمزگذاری و ذخیره می‌شود و دیگر نمایش داده نخواهد شد. فقط چند نویسهٔ آخر برای شناسایی دیده می‌شود.');
      optional(field(form, 'httpReferer', 'نشانی سایت (HTTP-Referer، اختیاری)', 'text', existing?.httpReferer || '')).dir = 'ltr';
      optional(field(form, 'appTitle', 'نام برنامه برای OpenRouter (اختیاری)', 'text', existing?.appTitle || 'سبزینه'));
      if (existing) {
        const active = field(form, 'active', 'وضعیت', 'select'); addSelectOptions(active, [['true', 'فعال'], ['false', 'غیرفعال']], String(existing.active));
      }
      form.append(formFooter('ذخیره', 'check', dialog)); body.append(form);
      onForm(form, async data => {
        const payload = { name: data.name };
        if (!existing) payload.kind = data.kind;
        if (data.baseUrl) payload.baseUrl = data.baseUrl;
        if (data.apiKey) payload.apiKey = data.apiKey;
        if (data.httpReferer || existing) payload.httpReferer = data.httpReferer || '';
        if (data.appTitle || existing) payload.appTitle = data.appTitle || '';
        if (existing) payload.active = data.active === 'true';
        if (existing && !data.baseUrl) delete payload.baseUrl;
        await api(existing ? 'admin/ai/providers/' + existing.id : 'admin/ai/providers', existing ? 'PUT' : 'POST', payload);
        dialog.close(); notice(existing ? 'سرویس به‌روزرسانی شد' : 'سرویس افزوده شد'); await load();
      });
    }, { iconName: 'key' });
  }

  function testModal(provider, defaultModel) {
    openModal('آزمایش اتصال «' + provider.name + '»', (body, dialog) => {
      const form = element('form');
      const model = field(form, 'model', 'مدل برای آزمایش', 'text', defaultModel || 'openai/gpt-4o-mini'); model.dir = 'ltr';
      const out = element('div', null, 'ai-test-result'); out.setAttribute('aria-live', 'polite');
      form.append(formFooter('ارسال یک درخواست کوتاه', 'send', dialog), out); body.append(infoNote('یک درخواست بسیار کوتاه می‌فرستیم تا درستی کلید، نشانی و مدل مشخص شود. هزینهٔ آن در دفتر مصرف ثبت می‌شود.'), form);
      onForm(form, async data => {
        out.replaceChildren(element('p', 'در حال آزمایش…'));
        const result = await api('admin/ai/providers/' + provider.id + '/test', 'POST', { model: data.model });
        out.replaceChildren(result.ok
          ? infoNote(`اتصال برقرار است. پاسخ‌دهنده: ${result.answeredBy} · ${number(result.latencyMs)} میلی‌ثانیه · هزینه ${(result.costMicros / 1e6).toFixed(5)} دلار`)
          : infoNote(`ناموفق: ${outcomeNames[result.outcome] || result.outcome} (${result.errorCode || '—'})`, 'warn'));
      });
    }, { iconName: 'send' });
  }

  function providersPanel(providers, onChange) {
    const panel = element('section', null, 'card');
    panel.append(sectionHead('سرویس‌ها و کلیدها', 'هر سرویس یک نشانی و یک کلید دارد؛ مدل‌ها را در استخرها به آن‌ها وصل می‌کنید.', button('افزودن سرویس', () => providerModal(), { iconName: 'plus' })));
    if (!providers.length) { panel.append(emptyState('هنوز سرویسی ثبت نشده', 'یک حساب OpenRouter یا هر سرویس سازگار با OpenAI اضافه کنید.', 'key', button('افزودن سرویس', () => providerModal(), { iconName: 'plus' }))); return panel; }
    for (const provider of providers) {
      const info = element('div'); info.append(element('strong', provider.name), element('small', provider.baseUrl, 'ltr'));
      const status = element('div', null, 'ai-provider-status');
      status.append(badge(provider.active ? 'active' : 'suspended', provider.active ? 'فعال' : 'غیرفعال'), element('span', kindNames[provider.kind], 'badge badge-neutral'),
        provider.hasKey ? element('span', 'کلید ' + provider.keyHint, 'badge badge-success ltr') : element('span', 'بدون کلید', 'badge badge-danger'));
      const actions = element('div', null, 'cell-actions');
      actions.append(
        button('آزمایش', () => testModal(provider), { secondary: true, iconName: 'send' }),
        button('ویرایش', () => providerModal(provider), { secondary: true, iconName: 'sliders' }),
        button('حذف', () => confirmAction('حذف سرویس', 'سرویس «' + provider.name + '» حذف می‌شود. اگر در استخری استفاده شود، حذف انجام نمی‌شود.', 'حذف سرویس', async () => { await api('admin/ai/providers/' + provider.id, 'DELETE'); notice('سرویس حذف شد'); }), { secondary: true, iconName: 'trash', className: 'danger' }),
      );
      panel.append(row(info, status, actions));
    }
    return panel;
  }

  // ------------------------------------------------------------------ pools

  function memberModal(providers, onAdd) {
    openModal('افزودن مدل به استخر', (body, dialog) => {
      const form = element('form');
      const provider = field(form, 'providerId', 'سرویس', 'select');
      addSelectOptions(provider, providers.map(p => [p.id, p.name + ' · ' + kindNames[p.kind]]));
      const model = field(form, 'model', 'شناسهٔ مدل (مثلاً google/gemini-2.5-flash)', 'text'); model.dir = 'ltr';
      const list = element('datalist'); list.id = 'ai-model-list'; model.setAttribute('list', list.id);
      const priceIn = field(form, 'priceIn', 'قیمت ورودی (دلار برای هر یک میلیون توکن)', 'number'); const priceOut = field(form, 'priceOut', 'قیمت خروجی (دلار برای هر یک میلیون توکن)', 'number');
      for (const input of [priceIn, priceOut]) { input.step = '0.0001'; input.min = '0'; input.value = '0'; input.dir = 'ltr'; }
      help(priceIn, 'اگر OpenRouter هزینهٔ واقعی را برگرداند همان ثبت می‌شود؛ این قیمت‌ها فقط برای پیش‌بینی سقف هزینه و انتخاب «ارزان‌ترین اول» است.');
      const weight = field(form, 'weight', 'وزن (برای راهبرد وزنی)', 'number'); weight.min = '1'; weight.max = '100'; weight.value = '1';
      const catalog = {};
      const fetchCatalog = button('دریافت فهرست زندهٔ مدل‌ها', async () => {
        const result = await api(`admin/ai/providers/${provider.value}/models?limit=500`);
        list.replaceChildren(); for (const item of result.items) { catalog[item.id] = item; list.append(Object.assign(element('option'), { value: item.id, label: item.name })); }
        notice(number(result.total) + ' مدل دریافت شد؛ در کادر مدل جستجو کنید.');
      }, { secondary: true, iconName: 'search' });
      model.oninput = () => { const hit = catalog[model.value]; if (hit) { priceIn.value = (hit.priceInMicrosPerM / 1e6).toFixed(4); priceOut.value = (hit.priceOutMicrosPerM / 1e6).toFixed(4); } };
      form.append(list, fetchCatalog, formFooter('افزودن', 'plus', dialog)); body.append(form);
      onForm(form, async data => {
        onAdd({ providerId: data.providerId, model: data.model.trim(), weight: Number(data.weight), enabled: true, priceInMicrosPerM: toMicros(data.priceIn), priceOutMicrosPerM: toMicros(data.priceOut) });
        dialog.close();
      });
    }, { iconName: 'sparkles' });
  }

  function healthCell(member) {
    const wrap = element('div', null, 'ai-health');
    if (member.cooldownUntil && new Date(member.cooldownUntil) > new Date()) {
      wrap.append(badge('failed', 'در استراحت تا ' + formatDate(member.cooldownUntil)));
    } else if (member.consecutiveFailures > 0) wrap.append(badge('pending', number(member.consecutiveFailures) + ' خطای پیاپی'));
    else wrap.append(badge('active', 'سالم'));
    wrap.append(element('small', `موفق ${number(member.totalOk)} · ناموفق ${number(member.totalFail)}${member.lastErrorCode ? ' · ' + member.lastErrorCode : ''}`));
    return wrap;
  }

  function poolCard(pool, providers) {
    const card = element('section', null, 'card');
    let members = pool.members.map(member => ({ ...member }));
    let dirty = false;
    const settings = element('form', null, 'ai-pool-settings');
    const strategy = field(settings, 'strategy', 'راهبرد انتخاب', 'select'); addSelectOptions(strategy, Object.entries(strategyNames), pool.strategy);
    const temperature = field(settings, 'temperature', 'دما', 'number'); temperature.step = '0.05'; temperature.min = '0'; temperature.max = '2'; temperature.value = pool.temperature;
    const maxTokens = field(settings, 'maxTokens', 'سقف توکن خروجی', 'number'); maxTokens.min = '200'; maxTokens.max = '32000'; maxTokens.value = pool.maxTokens;
    const timeoutS = field(settings, 'timeoutS', 'مهلت هر تلاش (ثانیه)', 'number'); timeoutS.min = '5'; timeoutS.max = '300'; timeoutS.value = Math.round(pool.timeoutMs / 1000);
    const attempts = field(settings, 'maxAttempts', 'حداکثر تلاش', 'number'); attempts.min = '1'; attempts.max = '10'; attempts.value = pool.maxAttempts;
    const enabled = field(settings, 'enabled', 'وضعیت', 'select'); addSelectOptions(enabled, [['true', 'فعال'], ['false', 'غیرفعال']], String(pool.enabled));
    settings.append(formFooter('ذخیرهٔ تنظیمات استخر', 'check'));
    onForm(settings, async data => {
      await api('admin/ai/pools/' + pool.code, 'PUT', { strategy: data.strategy, temperature: Number(data.temperature), maxTokens: Number(data.maxTokens), timeoutMs: Number(data.timeoutS) * 1000, maxAttempts: Number(data.maxAttempts), enabled: data.enabled === 'true' });
      notice('تنظیمات استخر ذخیره شد'); await load();
    });
    const list = element('div', null, 'ai-members');
    const save = button('ذخیرهٔ ترتیب و مدل‌ها', async () => {
      await api(`admin/ai/pools/${pool.code}/members`, 'PUT', { members: members.map(m => ({ providerId: m.providerId, model: m.model, weight: m.weight, enabled: m.enabled, priceInMicrosPerM: Math.round(m.priceInMicrosPerM), priceOutMicrosPerM: Math.round(m.priceOutMicrosPerM) })) });
      notice('مدل‌های استخر ذخیره شد'); await load();
    }, { iconName: 'check' });
    const renderMembers = () => {
      list.replaceChildren();
      save.disabled = !dirty;
      if (!members.length) { list.append(emptyState('این استخر مدلی ندارد', 'بدون مدل، پیش‌نویس برنامه ساخته نمی‌شود و درخواست‌ها برای متخصص خالی می‌ماند.', 'sparkles')); return; }
      members.forEach((member, index) => {
        const info = element('div'); info.append(element('strong', member.model, 'ltr'), element('small', member.providerName + ` · ورودی $${(member.priceInMicrosPerM / 1e6).toFixed(3)} · خروجی $${(member.priceOutMicrosPerM / 1e6).toFixed(3)} در هر میلیون توکن`));
        const rank = element('span', number(index + 1), 'ai-rank');
        const actions = element('div', null, 'cell-actions');
        const move = (delta) => { const to = index + delta; if (to < 0 || to >= members.length) return; [members[index], members[to]] = [members[to], members[index]]; dirty = true; renderMembers(); };
        actions.append(
          button('', () => move(-1), { secondary: true, iconName: 'chevron-right', className: 'icon-button ai-up' }),
          button('', () => move(1), { secondary: true, iconName: 'chevron-left', className: 'icon-button ai-down' }),
          button(member.enabled ? 'غیرفعال' : 'فعال', () => { member.enabled = !member.enabled; dirty = true; renderMembers(); }, { secondary: true }),
          button('', () => { members.splice(index, 1); dirty = true; renderMembers(); }, { secondary: true, iconName: 'trash', className: 'danger icon-button' }),
        );
        if (member.id) actions.append(button('پاک‌کردن خطا', async () => { await api('admin/ai/members/' + member.id + '/reset-health', 'POST'); notice('وضعیت سلامت بازنشانی شد'); await load(); }, { secondary: true }));
        const line = row(rank, info, healthCell(member), actions); if (!member.enabled) line.classList.add('is-off'); list.append(line);
      });
    };
    renderMembers();
    const result = element('div', null, 'ai-test-result'); result.setAttribute('aria-live', 'polite');
    const test = button('آزمایش استخر', async () => {
      result.replaceChildren(element('p', 'در حال آزمایش زنجیرهٔ مدل‌ها…'));
      const out = await api(`admin/ai/pools/${pool.code}/test`, 'POST');
      const chain = (out.chain || []).map(a => `${a.model} → ${outcomeNames[a.outcome] || a.outcome}`).join('  ›  ');
      result.replaceChildren(infoNote((out.ok ? 'استخر پاسخ داد. ' : 'استخر پاسخی نگرفت. ') + (chain || out.errorCode || ''), out.ok ? '' : 'warn'));
    }, { secondary: true, iconName: 'send' });
    const tools = element('div', null, 'actions');
    tools.append(button('افزودن مدل', () => { if (!providers.length) { notice('ابتدا یک سرویس اضافه کنید', 'error'); return; } memberModal(providers, m => { members.push({ ...m, providerName: providers.find(p => p.id === m.providerId)?.name || '—', consecutiveFailures: 0, totalOk: 0, totalFail: 0 }); dirty = true; renderMembers(); }); }, { secondary: true, iconName: 'plus' }), save, test);
    card.append(sectionHead(poolTitles[pool.code] || pool.title, 'کد استخر: ' + pool.code + ' · اگر مدل اول خطا بدهد، مدل بعدی صدا زده می‌شود.'), settings, list, tools, result);
    return card;
  }

  async function modelsTab() {
    const [providers, pools] = await Promise.all([api('admin/ai/providers'), api('admin/ai/pools')]);
    const view = element('div', null, 'report-stack');
    view.append(providersPanel(providers.items), ...pools.items.map(pool => poolCard(pool, providers.items)));
    return view;
  }

  // ------------------------------------------------------------------ budget & usage

  async function budgetTab() {
    const status = await api('admin/ai/usage');
    const view = element('div', null, 'report-stack');
    const alertText = { ok: ['سالم', 'success'], warning: ['نزدیک سقف (بیش از ۸۰٪)', 'warning'], blocked: ['سقف پر شده؛ پیش‌نویس‌ها دستی می‌شوند', 'danger'], killed: ['کلید توقف روشن است', 'danger'] }[status.alert];
    const cards = element('div', null, 'metrics-grid');
    for (const [label, node, note, tone] of [
      ['مصرف امروز', usd(status.todayMicros), status.controls.dailyCapMicros != null ? 'سقف: $' + (status.controls.dailyCapMicros / 1e6).toFixed(2) : 'بدون سقف روزانه', 'green'],
      ['مصرف ۳۰ روز اخیر', usd(status.monthMicros), status.controls.monthlyCapMicros != null ? 'سقف: $' + (status.controls.monthlyCapMicros / 1e6).toFixed(2) : 'بدون سقف ماهانه', 'amber'],
      ['درصد سقف روزانه', element('span', status.dailyShare == null ? '—' : number(Math.round(status.dailyShare * 100)) + '٪'), 'امروز، به وقت تهران', 'blue'],
      ['وضعیت', element('span', alertText[0]), 'کلید توقف و سقف‌ها را پایین‌تر تنظیم کنید', 'rose'],
    ]) {
      const card = element('section', null, 'card metric-card'), top = element('div', null, 'metric-top'), value = element('div', null, 'metric-value');
      top.append(element('p', label), iconTile('wallet', tone)); value.append(node); card.append(top, value, element('div', note, 'metric-foot')); cards.append(card);
    }
    view.append(cards);

    const form = element('form'); const card = element('section', null, 'card form-card');
    card.append(sectionHead('سقف‌ها و کلید توقف', 'مبلغ‌ها به دلار آمریکا. خالی‌گذاشتن یعنی بدون سقف.', iconTile('shield')));
    const money = (name, label, value) => { const input = optional(field(form, name, label, 'number', value == null ? '' : (value / 1e6).toString())); input.step = '0.01'; input.min = '0'; input.dir = 'ltr'; return input; };
    const daily = money('daily', 'سقف هزینهٔ روزانه', status.controls.dailyCapMicros);
    const monthly = money('monthly', 'سقف هزینهٔ ماهانه', status.controls.monthlyCapMicros);
    const perRequest = money('perRequest', 'سقف هزینهٔ هر درخواست برنامه', status.controls.perRequestCapMicros);
    const quota = field(form, 'quota', 'حداکثر پیش‌نویس AI برای هر کاربر در روز', 'number', String(status.controls.perUserDailyDrafts)); quota.min = '1'; quota.max = '100';
    const kill = field(form, 'kill', 'کلید توقف اضطراری', 'select'); addSelectOptions(kill, [['false', 'خاموش (AI فعال)'], ['true', 'روشن (همه به متخصص می‌روند)']], String(status.controls.killSwitch));
    form.append(infoNote('وقتی سقفی پر شود یا کلید توقف روشن باشد، درخواست‌های تازه بدون پیش‌نویس به متخصص می‌رسند و مسیر پرداخت و درمان قطع نمی‌شود. هشدار ۸۰٪ یک بار در روز در «تاریخچه فعالیت» ثبت می‌شود.'), formFooter('ذخیره', 'check'));
    onForm(form, async data => {
      const cap = text => text === '' ? null : toMicros(text);
      await api('admin/ai/budget', 'PUT', { dailyCapMicros: cap(data.daily), monthlyCapMicros: cap(data.monthly), perRequestCapMicros: cap(data.perRequest), perUserDailyDrafts: Number(data.quota), killSwitch: data.kill === 'true' });
      notice('سقف‌ها ذخیره شد'); await load();
    });
    void daily; void monthly; void perRequest;
    card.append(form); view.append(card);

    view.append(listPanel(status.byModel, { title: 'مصرف به تفکیک مدل (۳۰ روز)', description: 'تعداد فراخوانی، موفقیت، توکن و هزینهٔ واقعی', pageSize: 8, search: false, iconName: 'sparkles', emptyTitle: 'هنوز مصرفی ثبت نشده', columns: [
      { label: 'مدل', render: r => mono(r.model) }, { label: 'فراخوانی', render: r => number(r.calls) }, { label: 'موفق', render: r => number(r.ok) }, { label: 'توکن', render: r => number(r.tokens) }, { label: 'هزینه', render: r => usd(r.costMicros) },
    ] }));
    view.append(listPanel(status.daily.slice().reverse(), { title: 'هزینهٔ روزانه', pageSize: 10, search: false, iconName: 'calendar', emptyTitle: 'هنوز مصرفی ثبت نشده', columns: [
      { label: 'روز', render: r => r.day }, { label: 'فراخوانی', render: r => number(r.calls) }, { label: 'هزینه', render: r => usd(r.costMicros) },
    ] }));
    const ledger = await api('admin/ai/ledger?limit=60');
    view.append(listPanel(ledger.items, { title: 'آخرین فراخوانی‌ها', description: 'هر تلاش یک ردیف دارد؛ ردیف‌های ناموفق هم تا زمان شکست ثبت می‌شوند.', pageSize: 10, iconName: 'history', emptyTitle: 'فراخوانی‌ای ثبت نشده', columns: [
      { label: 'زمان', render: r => formatDate(r.createdAt), className: 'cell-nowrap' }, { label: 'مدل', render: r => mono(r.model) }, { label: 'کار', key: 'task' }, { label: 'نتیجه', render: r => badge(r.outcome === 'ok' ? 'completed' : 'failed', outcomeNames[r.outcome] || r.outcome) },
      { label: 'توکن', render: r => number(r.tokensIn + r.tokensOut) }, { label: 'هزینه', render: r => usd(r.costMicros) }, { label: 'تأخیر', render: r => number(r.latencyMs) + ' ms' },
    ] }));
    return view;
  }

  // ------------------------------------------------------------------ prompts

  function promptModal(key, base) {
    openModal('نسخهٔ جدید پرامپت «' + key + '»', (body, dialog) => {
      const form = element('form');
      const system = field(form, 'systemPrompt', 'پرامپت سیستم', 'textarea', base?.systemPrompt || ''); system.rows = 14;
      const user = field(form, 'userTemplate', 'قالب پیام کاربر (جاگذارها مانند {{profile}} حفظ شوند)', 'textarea', base?.userTemplate || ''); user.rows = 12; user.dir = 'ltr';
      optional(field(form, 'notes', 'یادداشت تغییر', 'text', ''));
      form.append(infoNote('نسخه‌ها هرگز بازنویسی نمی‌شوند؛ هر پیش‌نویس با نسخهٔ دقیق پرامپتش ثبت می‌شود. نسخهٔ تازه تا فعال‌سازی اثری ندارد.'), formFooter('ذخیره به‌عنوان پیش‌نویس', 'check', dialog)); body.append(form);
      onForm(form, async data => { await api('admin/ai/prompts/' + key, 'POST', { systemPrompt: data.systemPrompt, userTemplate: data.userTemplate, notes: data.notes }); dialog.close(); notice('نسخهٔ جدید ذخیره شد'); await load(); });
    }, { iconName: 'clipboard' });
  }

  async function promptsTab() {
    const result = await api('admin/ai/prompts');
    const view = element('div', null, 'report-stack');
    for (const key of ['plan_draft', 'plan_critic']) {
      const versions = result.items.filter(item => item.key === key);
      const active = versions.find(item => item.status === 'active');
      const card = element('section', null, 'card');
      card.append(sectionHead(key === 'plan_draft' ? 'پرامپت پیش‌نویس برنامه' : 'پرامپت بازبین', 'فعال: نسخهٔ ' + (active ? number(active.version) : '—'), button('نسخهٔ جدید', () => promptModal(key, active), { iconName: 'plus' })));
      for (const version of versions) {
        const info = element('div'); info.append(element('strong', 'نسخهٔ ' + number(version.version)), element('small', `${formatDate(version.createdAt)}${version.notes ? ' · ' + version.notes : ''}`));
        const actions = element('div', null, 'cell-actions');
        actions.append(button('مشاهده', () => openModal('نسخهٔ ' + number(version.version) + ' — ' + key, body => { const pre = element('pre', version.systemPrompt, 'ai-prompt'); const tpl = element('pre', version.userTemplate, 'ai-prompt ltr'); body.append(element('h3', 'پرامپت سیستم'), pre, element('h3', 'قالب پیام'), tpl); }, { iconName: 'clipboard' }), { secondary: true }));
        if (version.status !== 'active') actions.append(button('فعال‌سازی', async () => { await api(`admin/ai/prompts/${key}/${version.version}/activate`, 'POST'); notice('نسخه فعال شد'); await load(); }, { iconName: 'check' }));
        card.append(row(info, badge(version.status === 'active' ? 'active' : version.status === 'draft' ? 'draft' : 'suspended', version.status === 'active' ? 'فعال' : version.status === 'draft' ? 'پیش‌نویس' : 'بازنشسته'), actions));
      }
      view.append(card);
    }
    return view;
  }

  // ------------------------------------------------------------------ quality

  async function qualityTab() {
    const result = await api('admin/ai/generations?limit=100');
    const view = element('div', null, 'report-stack');
    const t = result.totals;
    const cards = element('div', null, 'metrics-grid');
    for (const [label, value, note, tone] of [
      ['پیش‌نویس موفق (۳۰ روز)', number(t.drafted), `از ${number(t.total)} درخواست`, 'green'],
      ['شکست یا دستی', number(t.failed + t.skipped), `${number(t.failed)} شکست · ${number(t.skipped)} ردشده با سقف/ریسک`, 'rose'],
      ['میانگین هزینه', '$' + (t.avgCostMicros / 1e6).toFixed(3), 'برای هر پیش‌نویس موفق', 'amber'],
      ['میانگین زمان', number(Math.round(t.avgLatencyMs / 1000)) + ' ثانیه', 'از ارسال تا پیش‌نویس', 'blue'],
    ]) {
      const card = element('section', null, 'card metric-card'), top = element('div', null, 'metric-top');
      top.append(element('p', label), iconTile('sparkles', tone)); card.append(top, element('div', value, 'metric-value'), element('div', note, 'metric-foot')); cards.append(card);
    }
    view.append(cards, infoNote('«هشدار اعتبارسنج» یعنی پیش‌نویس از نظر ایمنی درست بوده ولی از نظر انرژی، پروتئین یا تنوع باید به آن نگاه شود. بازبین (critic) نظر مشورتی می‌دهد و هرگز پیش‌نویس را رد نمی‌کند.'));
    view.append(listPanel(result.items, { title: 'آخرین پیش‌نویس‌ها', pageSize: 12, iconName: 'sparkles', emptyTitle: 'هنوز پیش‌نویسی ساخته نشده', columns: [
      { label: 'زمان', render: r => formatDate(r.createdAt), className: 'cell-nowrap' }, { label: 'درخواست', render: r => shortId(r.requestId) },
      { label: 'وضعیت', render: r => badge(r.status === 'drafted' ? 'completed' : r.status === 'failed' ? 'failed' : 'pending', r.status === 'drafted' ? 'پیش‌نویس شد' : r.status === 'failed' ? 'شکست' : 'دستی') },
      { label: 'علت', render: r => (r.reason && (reasonNames[r.reason] || r.reason)) || '—' }, { label: 'مدل', render: r => mono(r.model || '—') },
      { label: 'تلاش', render: r => r.attempts ? `${number(r.attempts)} (${number(r.failedAttempts)} ناموفق)` : '—' },
      { label: 'هشدار اعتبارسنج', render: r => number(r.validatorWarnings) }, { label: 'بازبین', render: r => r.critic === 'ok' ? 'تأیید' : r.critic === 'concerns' ? 'نگرانی' : r.critic === 'unavailable' ? 'در دسترس نبود' : '—' },
      { label: 'هزینه', render: r => usd(r.costMicros) }, { label: 'پرامپت', render: r => r.promptVersion || '—' },
    ] }));
    return view;
  }

  // ------------------------------------------------------------------ shell

  async function page() {
    const tabs = [['models', 'سرویس‌ها و استخرها', modelsTab], ['budget', 'هزینه و بودجه', budgetTab], ['prompts', 'پرامپت‌ها', promptsTab], ['quality', 'کیفیت پیش‌نویس‌ها', qualityTab]];
    const root = element('div', null, 'ai-center');
    const bar = element('div', null, 'ai-tabs'); bar.setAttribute('role', 'tablist');
    const body = element('div', null, 'ai-tab-body');
    const selected = sessionStorage.getItem('ai-tab') || 'models';
    const show = async key => {
      sessionStorage.setItem('ai-tab', key);
      bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tab === key; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
      body.replaceChildren(skeleton());
      try { body.replaceChildren(await tabs.find(t => t[0] === key)[2]()); }
      catch (error) { body.replaceChildren(emptyState('خطا در دریافت اطلاعات', error.message, 'error', button('تلاش دوباره', () => show(key), { secondary: true }))); }
    };
    for (const [key, label] of tabs) { const b = element('button', label, 'ai-tab'); b.type = 'button'; b.dataset.tab = key; b.setAttribute('role', 'tab'); b.onclick = () => show(key); bar.append(b); }
    root.append(bar, body);
    await show(tabs.some(t => t[0] === selected) ? selected : 'models');
    return root;
  }

  return { page };
})();
