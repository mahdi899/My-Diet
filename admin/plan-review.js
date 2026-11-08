/* Live doctor review of an AI-drafted week, built on the real three-option contract.
   Every meal has: primary, ai_alternative, specialist_alternative. A plan can only be published
   once all three exist and are approved by the doctor. Dishes come from the Iranian catalogue,
   so calories and ingredients are computed by the server, never typed by hand. */
(() => {
  const { element: e } = WorkspaceUI;
  const KINDS = [
    ['primary', 'گزینهٔ اصلی'],
    ['ai_alternative', 'جایگزین هوش مصنوعی'],
    ['specialist_alternative', 'جایگزین متخصص'],
  ];
  const MEAL_FA = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده', snack1: 'میان‌وعده', snack2: 'میان‌وعده' };
  const DAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const TRACK_FA = { weight_loss: 'کاهش وزن', weight_gain: 'افزایش وزن', pregnancy: 'بارداری', detox: 'پاکسازی' };
  const BUDGET_FA = { low: 'اقتصادی', medium: 'متوسط', open: 'بدون محدودیت' };
  const DIET_FA = { omnivore: 'همه‌چیزخوار', vegetarian: 'گیاه‌خوار', vegan: 'وگان' };
  const STATUS_FA = { drafted: 'پیش‌نویس ساخته شد', skipped: 'AI رد شد', failed: 'ناموفق' };
  const SKIP_FA = {
    high_risk: 'پرونده پرخطر است؛ هفته خالی برای متخصص باقی ماند',
    kill_switch: 'کلید اضطراری AI روشن بود',
    cost_cap: 'سقف هزینهٔ AI پر شده بود',
    monthly_cap: 'سقف ماهانهٔ AI پر شده بود',
    user_quota: 'سهمیهٔ روزانهٔ این کاربر پر شده بود',
    invalid_draft: 'خروجی مدل قابل استفاده نبود',
    budget_blocked: 'سقف هزینهٔ یک درخواست رد شد',
  };
  const fa = value => new Intl.NumberFormat('fa-IR').format(value);
  const usd = micros => '$' + (Number(micros) / 1e6).toFixed(4);
  const clone = value => structuredClone(value);
  const primaryOf = meal => (meal.options || []).find(o => o.kind === 'primary');

  function chip(text, tone) {
    return e('span', text, 'pr-chip' + (tone ? ' ' + tone : ''));
  }
  function stat(label, value) {
    const box = e('div', null, 'pr-stat');
    box.append(e('small', label), e('strong', value ?? '—'));
    return box;
  }

  function open({ session, requestId, onBack }) {
    const root = e('div', null, 'pr-root');
    const toast = e('p', null, 'pr-toast');
    toast.setAttribute('role', 'status');
    let request = null;
    let days = [];
    let dirty = false;
    let busy = false;
    let activeDay = 0;
    let poll = null;
    let dead = false;

    const say = (text, bad) => { toast.textContent = text || ''; toast.className = 'pr-toast' + (bad ? ' bad' : ''); };
    const lock = () => String(request.version.lockVersion);

    async function load() {
      request = await session.api('specialist/requests/' + encodeURIComponent(requestId));
      days = clone(request.version?.days || []);
      dirty = false;
      if (request.status === 'generating') watch();
      render();
    }

    function watch() {
      clearInterval(poll);
      poll = setInterval(async () => {
        if (dead || !root.isConnected) return clearInterval(poll);
        try {
          const fresh = await session.api('specialist/requests/' + encodeURIComponent(requestId));
          if (fresh.status !== 'generating') {
            clearInterval(poll);
            await load();
            say('پیش‌نویس تازه آماده شد.');
          }
        } catch { /* transient; the next tick retries */ }
      }, 2500);
    }

    // ---- checks ---------------------------------------------------------------------------------
    const emptyDays = () => days.filter(day => !day.meals.length).length;
    const mealsOf = () => days.flatMap(day => day.meals);
    /** Meals the AI left without the doctor's own option. Publishing needs all three kinds. */
    const missingSpecialist = () => mealsOf().filter(meal => !(meal.options || []).some(o => o.kind === 'specialist_alternative')).length;
    const withoutPrimary = () => days.reduce((sum, day) => sum + day.meals.filter(meal => !primaryOf(meal)).length, 0);
    function missing() {
      let count = 0;
      for (const day of days) {
        for (const meal of day.meals) {
          for (const [kind] of KINDS) {
            const option = (meal.options || []).find(o => o.kind === kind);
            if (!option || !option.approved) count += 1;
          }
        }
      }
      return count;
    }
    const dayKcal = day => day.meals.reduce((sum, meal) => sum + (primaryOf(meal)?.calories ?? meal.calories ?? 0), 0);

    // ---- editing --------------------------------------------------------------------------------
    function setOption(meal, option) {
      const list = (meal.options || []).filter(o => o.kind !== option.kind);
      list.push(option);
      list.sort((a, b) => KINDS.findIndex(k => k[0] === a.kind) - KINDS.findIndex(k => k[0] === b.kind));
      meal.options = list;
      if (option.kind === 'primary') {
        meal.title = option.title;
        meal.calories = option.calories;
        meal.items = option.ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit }));
      }
      dirty = true;
    }

    function picker(meal, kind) {
      const dialog = e('dialog', null, 'modal pr-picker');
      const picks = [];
      const results = e('div', null, 'pr-results');
      const chosen = e('div', null, 'pr-chosen');
      const sum = e('p', null, 'pr-sum');
      const search = e('input');
      search.type = 'search';
      search.placeholder = 'جست‌وجوی غذا: قیمه، آش، کوکو…';
      search.setAttribute('aria-label', 'جست‌وجوی غذا');
      const ok = e('button', 'ثبت این گزینه');
      ok.type = 'button';
      ok.disabled = true;
      const cancel = e('button', 'انصراف', 'secondary');
      cancel.type = 'button';
      const error = e('p', null, 'pr-error');
      error.setAttribute('role', 'alert');

      const paint = () => {
        chosen.replaceChildren();
        for (const pick of picks) {
          const row = e('div', null, 'pr-pick');
          const qty = e('input');
          qty.type = 'number'; qty.min = '0.25'; qty.max = '6'; qty.step = '0.25'; qty.value = String(pick.servings);
          qty.setAttribute('aria-label', 'تعداد وعده ' + pick.food.nameFa);
          qty.oninput = () => { pick.servings = Math.min(6, Math.max(0.25, Number(qty.value) || 1)); total(); };
          const remove = e('button', 'حذف', 'secondary');
          remove.type = 'button';
          remove.onclick = () => { picks.splice(picks.indexOf(pick), 1); paint(); total(); };
          row.append(e('span', pick.food.nameFa + ' — ' + pick.food.servingLabel), qty, remove);
          chosen.append(row);
        }
        total();
      };
      const total = () => {
        const kcal = Math.round(picks.reduce((s, p) => s + p.food.kcal * p.servings, 0));
        sum.textContent = picks.length ? `مجموع: ${fa(kcal)} کیلوکالری` : 'حداقل یک غذا انتخاب کنید.';
        ok.disabled = !picks.length;
      };
      async function find() {
        try {
          const page = await session.api('catalog/foods?limit=12&q=' + encodeURIComponent(search.value.trim()));
          results.replaceChildren();
          if (!page.items.length) results.append(e('p', 'غذایی پیدا نشد.'));
          for (const food of page.items) {
            const button = e('button', null, 'pr-food secondary');
            button.type = 'button';
            button.append(e('strong', food.nameFa), e('small', `${food.servingLabel} · ${fa(food.kcal)} کیلوکالری`));
            button.onclick = () => {
              if (picks.length >= 5 || picks.some(p => p.food.slug === food.slug)) return;
              picks.push({ food, servings: 1 });
              paint();
            };
            results.append(button);
          }
        } catch (err) { error.textContent = err.message; }
      }
      let timer;
      search.oninput = () => { clearTimeout(timer); timer = setTimeout(find, 250); };
      cancel.onclick = () => dialog.close();
      ok.onclick = async () => {
        ok.disabled = true; error.textContent = '';
        try {
          const composed = await session.api('catalog/compose', 'POST', {
            kind, items: picks.map(p => ({ slug: p.food.slug, servings: p.servings })),
          });
          const existing = (meal.options || []).find(o => o.kind === kind);
          setOption(meal, { ...composed.option, optionId: existing?.optionId || composed.option.optionId, approved: true });
          dialog.close();
          render();
        } catch (err) { error.textContent = err.message; ok.disabled = false; }
      };
      dialog.onclose = () => dialog.remove();
      const head = e('header');
      head.append(e('h2', `${MEAL_FA[meal.mealType] || meal.mealType} — ${KINDS.find(k => k[0] === kind)[1]}`));
      const actions = e('div', null, 'actions');
      actions.append(ok, cancel);
      dialog.append(head, search, results, e('h3', 'انتخاب‌شده'), chosen, sum, error, actions);
      document.body.append(dialog);
      dialog.showModal();
      find();
      search.focus();
    }

    // ---- views ----------------------------------------------------------------------------------
    function profileCard() {
      const p = request.profile;
      const card = e('section', null, 'card pr-card');
      card.append(e('h2', 'پروندهٔ تغذیه‌ای'));
      if (!p) { card.append(e('p', 'این کاربر مشخصات تغذیه‌ای ثبت‌شده ندارد.')); return card; }
      const grid = e('div', null, 'pr-stats');
      grid.append(
        stat('مسیر', TRACK_FA[p.track] || p.track),
        stat('جنسیت و سن', `${p.sex === 'male' ? 'مرد' : 'زن'}، ${fa(p.age)} ساله`),
        stat('قد / وزن', `${fa(p.heightCm)} / ${fa(p.weightKg)}`),
        stat('وزن هدف', p.targetWeightKg ? fa(p.targetWeightKg) : '—'),
        stat('BMI', fa(p.bmi)),
        stat('هدف انرژی', fa(p.energy.targetKcal) + ' کیلوکالری'),
        stat('BMR / TDEE', `${fa(p.energy.bmrKcal)} / ${fa(p.energy.tdeeKcal)}`),
        stat('پروتئین / کربو / چربی', `${fa(p.energy.proteinG)} / ${fa(p.energy.carbsG)} / ${fa(p.energy.fatG)} گرم`),
        stat('سبک تغذیه', DIET_FA[p.dietStyle] || p.dietStyle),
        stat('بودجه', BUDGET_FA[p.budget] || p.budget),
      );
      card.append(grid);
      const tags = e('div', null, 'pr-chips');
      for (const flag of request.riskFlags || []) tags.append(chip('هشدار: ' + flag, 'bad'));
      for (const a of p.allergens || []) tags.append(chip('حساسیت: ' + a, 'warn'));
      for (const c of p.conditions || []) tags.append(chip('شرایط: ' + c, 'warn'));
      if (p.safetyTier === 'doctor_only') tags.append(chip('فقط با نظر پزشک', 'bad'));
      if (!tags.children.length) tags.append(chip('هشدار یا حساسیتی ثبت نشده', 'ok'));
      card.append(tags);
      return card;
    }

    function aiCard() {
      const r = request.aiReview;
      const card = e('section', null, 'card pr-card');
      card.append(e('h2', 'گزارش هوش مصنوعی'));
      if (!r) { card.append(e('p', 'برای این درخواست هنوز تولید AI ثبت نشده است.')); return card; }
      const grid = e('div', null, 'pr-stats');
      grid.append(
        stat('وضعیت', STATUS_FA[r.status] || r.status),
        stat('استخر / مدل', `${r.poolCode || '—'} / ${r.model || '—'}`),
        stat('هزینه', usd(r.costMicros)),
        stat('توکن', fa(r.tokens)),
        stat('نوبت تولید', fa(r.attemptNo)),
        stat('پرامپت', r.promptVersion),
      );
      card.append(grid);
      if (r.skippedReason) card.append(e('p', SKIP_FA[r.skippedReason] || r.skippedReason, 'pr-error'));
      if (r.attempts.length) {
        const row = e('div', null, 'pr-chips');
        for (const a of r.attempts) row.append(chip(`${a.model || '?'} · ${a.outcome || '?'}`, a.outcome === 'ok' ? 'ok' : 'warn'));
        card.append(e('h3', 'مسیر مدل‌ها'), row);
      }
      const notes = [];
      for (const w of r.validatorWarnings) notes.push([w.message, 'warn']);
      if (r.critic?.verdict === 'concerns') notes.push(['منتقد AI نگرانی دارد:', 'bad']);
      for (const i of r.critic?.issues || []) notes.push([i.text, i.severity === 'block' ? 'bad' : i.severity === 'warn' ? 'warn' : 'ok']);
      if (r.critic?.verdict === 'unavailable') notes.push(['منتقد AI در دسترس نبود؛ بررسی دستی مهم‌تر است.', 'warn']);
      if (notes.length) {
        const list = e('ul', null, 'pr-notes');
        for (const [text, tone] of notes.slice(0, 30)) list.append(e('li', text, tone));
        card.append(e('h3', 'نکته‌های بررسی خودکار'), list);
      }
      return card;
    }

    function optionBox(meal, kind, label) {
      const option = (meal.options || []).find(o => o.kind === kind);
      const box = e('div', null, 'pr-option' + (option ? '' : ' empty') + (option?.approved ? ' approved' : ''));
      box.append(e('small', label, 'pr-kind'));
      if (!option) {
        box.append(e('p', 'هنوز ثبت نشده'));
      } else {
        box.append(e('strong', option.title));
        box.append(e('span', `${fa(option.calories ?? 0)} کیلوکالری · ${fa(option.preparationMinutes)} دقیقه`, 'pr-meta'));
        box.append(e('span', option.ingredients.slice(0, 5).map(i => i.name).join('، ') + (option.ingredients.length > 5 ? '…' : ''), 'pr-meta'));
        const approve = e('label', null, 'pr-approve');
        const check = e('input');
        check.type = 'checkbox'; check.checked = option.approved;
        check.onchange = () => { option.approved = check.checked; dirty = true; render(); };
        approve.append(check, document.createTextNode(' تأیید متخصص'));
        box.append(approve);
      }
      const pick = e('button', option ? 'تغییر از کاتالوگ' : 'افزودن از کاتالوگ', 'secondary');
      pick.type = 'button';
      pick.disabled = busy;
      pick.onclick = () => picker(meal, kind);
      box.append(pick);
      return box;
    }

    function mealCard(meal, day) {
      const card = e('section', null, 'card pr-meal');
      const head = e('header');
      head.append(e('h3', MEAL_FA[meal.mealType] || meal.mealType), e('span', `${meal.suggestedTime || ''} · ${fa(primaryOf(meal)?.calories ?? meal.calories)} کیلوکالری`, 'pr-meta'));
      if (request.version.status !== 'published') {
        const drop = e('button', 'حذف وعده', 'secondary');
        drop.type = 'button';
        drop.disabled = busy;
        drop.onclick = () => {
          if (primaryOf(meal) && !confirm('این وعده با همهٔ گزینه‌هایش حذف شود؟')) return;
          day.meals.splice(day.meals.indexOf(meal), 1);
          dirty = true;
          render();
        };
        head.append(drop);
      }
      const grid = e('div', null, 'pr-options');
      for (const [kind, label] of KINDS) grid.append(optionBox(meal, kind, label));
      card.append(head, grid);
      if (meal.notes) card.append(e('p', meal.notes, 'pr-meta'));
      return card;
    }

    function dayView() {
      const wrap = e('div');
      const tabs = e('div', null, 'pr-tabs');
      tabs.setAttribute('role', 'tablist');
      days.forEach((day, index) => {
        const tab = e('button', `${DAYS_FA[index] || index + 1}`, 'pr-tab' + (index === activeDay ? ' on' : ''));
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(index === activeDay));
        tab.onclick = () => { activeDay = index; render(); };
        tabs.append(tab);
      });
      wrap.append(tabs);
      const day = days[activeDay];
      if (!day) return wrap;
      const target = request.profile?.energy.targetKcal;
      const total = dayKcal(day);
      const drift = target ? Math.abs(total - target) / target : 0;
      const line = e('p', `مجموع این روز: ${fa(total)} کیلوکالری` + (target ? ` از هدف ${fa(target)}` : ''), 'pr-total' + (drift > 0.15 ? ' bad' : ''));
      const generated = request.aiReview?.dayTotals?.[activeDay];
      wrap.append(line);
      if (generated && !dirty) {
        wrap.append(e('p', `ماکروهای AI: پروتئین ${fa(generated.proteinG)} · کربو ${fa(generated.carbsG)} · چربی ${fa(generated.fatG)} گرم`, 'pr-meta'));
      }
      if (!day.meals.length) wrap.append(e('p', 'برای این روز وعده‌ای نیست. وعده را اضافه کنید و از کاتالوگ غذا بچینید.', 'pr-error'));
      for (const meal of day.meals) wrap.append(mealCard(meal, day));
      if (request.version.status !== 'published') wrap.append(addMealRow(day));
      return wrap;
    }

    const DEFAULT_TIME = { breakfast: '08:00', lunch: '13:30', dinner: '20:00', snack: '16:30' };
    /** A doctor can write a slot by hand, for example when the AI was skipped for a high-risk profile. */
    function addMealRow(day) {
      const row = e('div', null, 'pr-add-meal');
      const kind = e('select');
      kind.setAttribute('aria-label', 'نوع وعده');
      for (const type of ['breakfast', 'lunch', 'dinner', 'snack']) {
        const option = e('option', MEAL_FA[type]);
        option.value = type;
        kind.append(option);
      }
      const add = e('button', 'افزودن وعده', 'secondary');
      add.type = 'button';
      add.disabled = busy || day.meals.length >= 8;
      add.onclick = () => {
        day.meals.push({ mealUid: crypto.randomUUID(), mealType: kind.value, suggestedTime: DEFAULT_TIME[kind.value], title: '', calories: 0, notes: '', items: [], options: [] });
        dirty = true;
        render();
      };
      row.append(kind, add);
      return row;
    }

    async function save() {
      if (withoutPrimary() > 0) { say('هر وعدهٔ تازه باید دست‌کم گزینهٔ اصلی داشته باشد؛ از کاتالوگ اضافه کنید یا وعده را حذف کنید.', true); return; }
      busy = true; say('در حال ذخیره…'); render();
      try {
        await session.api('specialist/requests/' + encodeURIComponent(requestId) + '/draft', 'PUT', { days }, { 'If-Match': lock() });
        await load();
        say('تغییرات ذخیره شد.');
      } catch (err) { say(err.message, true); }
      busy = false; render();
    }
    async function publish() {
      busy = true; say('در حال انتشار…'); render();
      try {
        await session.api('specialist/requests/' + encodeURIComponent(requestId) + '/publish', 'POST', undefined, { 'If-Match': lock() });
        say('برنامه منتشر شد و برای کاربر فعال شد.');
        await load();
      } catch (err) { say(err.message, true); }
      busy = false; render();
    }
    async function regenerate() {
      if (dirty && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return;
      if (!confirm('یک پیش‌نویس تازه با هوش مصنوعی ساخته می‌شود و جایگزین این پیش‌نویس می‌شود. هزینهٔ AI ثبت می‌شود. ادامه؟')) return;
      busy = true; say('درخواست ساخت دوباره ثبت شد…'); render();
      try {
        await session.api('specialist/requests/' + encodeURIComponent(requestId) + '/regenerate', 'POST', undefined, { 'If-Match': lock() });
        request.status = 'generating';
        watch();
      } catch (err) { say(err.message, true); }
      busy = false; render();
    }
    function approveAll() {
      for (const meal of mealsOf()) for (const option of meal.options || []) option.approved = true;
      dirty = true; render();
    }
    /** Adopts the AI alternative as the doctor's option, so a reviewed week can actually be published. */
    function fillSpecialist() {
      let filled = 0;
      for (const meal of mealsOf()) {
        const options = meal.options || [];
        if (options.some(o => o.kind === 'specialist_alternative')) continue;
        const source = options.find(o => o.kind === 'ai_alternative') || options.find(o => o.kind === 'primary');
        if (!source) continue;
        setOption(meal, { ...structuredClone(source), optionId: crypto.randomUUID(), kind: 'specialist_alternative', approved: true });
        filled += 1;
      }
      if (!filled) say('جایگزینی برای کپی کردن پیدا نشد؛ گزینه را از کاتالوگ بسازید.', true);
    }

    function render() {
      root.replaceChildren();
      const bar = e('header', null, 'pr-bar');
      const back = e('button', 'بازگشت به فهرست', 'secondary');
      back.type = 'button';
      back.onclick = () => { if (dirty && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟')) return; dead = true; clearInterval(poll); onBack(); };
      const title = e('h2', `بررسی برنامهٔ ${request.displayName || 'کاربر'}`);
      bar.append(back, title);
      root.append(bar);
      if (request.status === 'generating') {
        const card = e('section', null, 'card pr-card');
        card.append(e('h2', 'در حال ساخت پیش‌نویس تازه…'), e('p', 'هوش مصنوعی در حال نوشتن هفته است؛ صفحه خودکار تازه می‌شود.'));
        root.append(card, toast);
        return;
      }
      root.append(profileCard(), aiCard());
      if (!request.version) {
        root.append(e('section', 'پیش‌نویسی وجود ندارد.', 'card'), toast);
        return;
      }
      const published = request.version.status === 'published';
      const left = missing();
      const actions = e('div', null, 'actions pr-actions');
      const mk = (text, fn, cls, disabled) => {
        const b = e('button', text, cls); b.type = 'button'; b.disabled = busy || !!disabled; b.onclick = fn; actions.append(b); return b;
      };
      const empty = emptyDays();
      const noSpec = missingSpecialist();
      mk('ساخت دوباره با AI', regenerate, 'secondary', published || request.status !== 'in_review');
      mk('تأیید همهٔ گزینه‌ها', approveAll, 'secondary', published);
      const fill = mk('تکمیل گزینهٔ متخصص', fillSpecialist, 'secondary', published || noSpec === 0);
      fill.title = 'گزینهٔ متخصص هر وعده را از روی جایگزین هوش مصنوعی می‌سازد؛ بعد باید ذخیره کنید';
      mk('ذخیره تغییرات', save, '', !dirty);
      mk(published ? 'منتشرشده' : 'انتشار برای کاربر', publish, '', published || dirty || left > 0 || empty > 0 || request.status !== 'in_review');
      root.append(actions);
      if (published) root.append(e('p', 'این نسخه منتشر شده است؛ برای اصلاح، درخواست بازنگری ثبت کنید.', 'pr-meta'));
      else if (dirty) root.append(e('p', 'تغییرات ذخیره‌نشده دارید؛ پیش از انتشار ذخیره کنید.', 'pr-meta'));
      else if (empty > 0) root.append(e('p', `برای ${fa(empty)} روز هنوز وعده‌ای ثبت نشده؛ هر روز حداقل یک وعده لازم است.`, 'pr-meta'));
      else if (noSpec > 0) root.append(e('p', `انتشار خاموش است: ${fa(noSpec)} وعده هنوز گزینهٔ متخصص ندارد. «تکمیل گزینهٔ متخصص» آن را از جایگزین هوش مصنوعی می‌سازد؛ بعد ذخیره کنید. هر وعده را جداگانه هم می‌توانید از کاتالوگ عوض کنید.`, 'pr-meta'));
      else if (left > 0) root.append(e('p', `${fa(left)} گزینه هنوز تأیید نشده. «تأیید همهٔ گزینه‌ها» را بزنید و بعد ذخیره کنید تا انتشار روشن شود.`, 'pr-meta'));
      else if (request.status !== 'in_review') root.append(e('p', 'سؤال بازی مانده است؛ تا بسته شدنش انتشار ممکن نیست.', 'pr-meta'));
      else root.append(e('p', 'همه چیز کامل است؛ می‌توانید منتشر کنید.', 'pr-meta ok'));
      root.append(dayView(), toast);
    }

    load().catch(err => { root.replaceChildren(e('p', err.message, 'pr-error')); });
    root.append(e('p', 'در حال بارگذاری…'));
    return root;
  }

  window.SabzinePlanReview = { open };
})();
