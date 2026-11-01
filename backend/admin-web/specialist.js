/* Phase 1: authenticated navigation and existing read APIs. Clinical editors follow in phase 6. */
(() => {
  const $ = id => document.getElementById(id);
  const { element, pending, table, date } = WorkspaceUI;
  const sections = { dashboard: 'داشبورد', patients: 'پرونده کاربران', review: 'برنامه‌های منتظر بررسی',
    changes: 'درخواست‌های تغییر برنامه', conversations: 'گفتگوها', reports: 'گزارش‌های هفتگی', profile: 'پروفایل حرفه‌ای' };
  const status = { in_review:'در انتظار بررسی',response_received:'پاسخ دریافت شده',queued:'در صف',generating:'در حال تولید',awaiting_review:'منتظر بررسی',reviewing:'در حال بررسی',
    awaiting_user:'در انتظار پاسخ کاربر',needs_info:'نیاز به اطلاعات',published:'منتشرشده',cancelled:'لغوشده' };
  const session = SabzineStaff.create({ role: 'specialist', onExpired: () => signedOut('نشست پایان یافته؛ دوباره وارد شوید.') });
  let current = 'dashboard', generation = 0, phone = '', challenge = null;
  const notice = text => { $('message').textContent = text || ''; };
  function signedOut(message = '') {
    generation++; session.clear(); $('panel').hidden = true; $('login').hidden = false;
    $('phone-form').hidden = false; $('code-form').hidden = true; $('totp-form').hidden = true;
    $('content').replaceChildren(); $('login-state').textContent = message;
  }
  function signedIn(data) {
    session.accept(data); $('panel').hidden = false; $('login').hidden = true;
    phone = ''; challenge = null;
    for (const form of document.querySelectorAll('form')) form.reset();
    load();
  }
  const digits = text => text.replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) - (c <= '٩' ? 0x660 : 0x6f0)));
  async function submit(form, action) {
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    $('login-state').textContent = 'در حال بررسی…';
    try { await action(Object.fromEntries(new FormData(form))); $('login-state').textContent = ''; }
    catch (error) { $('login-state').textContent = error.message; }
    finally { for (const button of form.querySelectorAll('button')) button.disabled = false; }
  }
  function complete(data) {
    if (data.totpRequired) {
      challenge = data.totpToken; $('code-form').hidden = true; $('totp-form').hidden = false;
      $('totp-form').querySelector('input').focus();
    } else signedIn(data);
  }
  $('phone-form').onsubmit = event => { event.preventDefault(); submit(event.target, async data => {
    const value = digits(data.phone).trim();
    if (!/^09\d{9}$/.test(value)) throw new Error('شماره تلفن ۱۱ رقمی با ۰۹ وارد کنید.');
    await session.login('auth/otp/request', { phone: value }); phone = value;
    $('phone-form').hidden = true; $('code-form').hidden = false; $('code-form').querySelector('input').focus();
  }); };
  $('code-form').onsubmit = event => { event.preventDefault(); submit(event.target, async data => {
    const code = digits(data.code).trim();
    if (!/^\d{6}$/.test(code)) throw new Error('کد شش‌رقمی را وارد کنید.');
    complete(await session.login('auth/otp/verify', { phone, code, platform:'web', deviceLabel:'Specialist workspace' }));
  }); };
  $('totp-form').onsubmit = event => { event.preventDefault(); submit(event.target, async data => {
    const code = digits(data.code).trim();
    if (!/^\d{6}$/.test(code)) throw new Error('کد شش‌رقمی را وارد کنید.');
    signedIn(await session.login('auth/totp', { code, totpToken:challenge }));
  }); };
  $('change-phone').onclick = () => { $('code-form').reset(); $('code-form').hidden = true; $('phone-form').hidden = false; };
  $('logout').onclick = async () => {
    $('logout').disabled = true;
    try { await session.logout(); signedOut('از حساب خارج شدید.'); }
    catch (error) { notice(error.message); }
    finally { $('logout').disabled = false; }
  };
  function navigate(section) { current = section; location.hash = section; load(); }
  for (const [key, label] of Object.entries(sections)) {
    const button = element('button', label); button.type = 'button'; button.dataset.section = key;
    button.onclick = () => navigate(key); $('nav').append(button);
  }
  $('refresh').onclick = () => load();
  $('today').textContent = date(new Date());
  const queueTable = rows => table(rows, [
    ['نام کاربر', row => row.userName || row.user || row.displayName || 'نام ثبت نشده'],
    ['وضعیت', row => status[row.status] || 'نیازمند بررسی'],
    ['نوع', row => row.kind === 'new_plan' ? 'برنامه جدید' : 'بازنگری برنامه'],
    ['زمان ثبت', row => date(row.createdAt)],
  ]);
  async function render(section) {
    if (section === 'dashboard') {
      const [review, changes, conversations] = await Promise.all([
        session.api('specialist/queue?bucket=awaiting_review'), session.api('specialist/queue?bucket=revisions'), session.api('conversations'),
      ]);
      const view = element('div'), intro = element('section', null, 'intro-card');
      intro.append(element('h2', 'فضایی برای تمرکز روی هر پرونده'), element('p', 'برنامه‌های آماده بررسی و درخواست‌های اصلاح را از میز کار دنبال کنید.'));
      view.append(intro);
      const cards = element('div', null, 'cards');
      for (const [title, count, target] of [['منتظر بررسی', review.length, 'review'], ['درخواست اصلاح', changes.length, 'changes'], ['گفتگوها', conversations.length, 'conversations']]) {
        const card = element('section', null, 'card'), button = element('button', 'مشاهده', 'secondary');
        card.append(element('p', title), element('div', new Intl.NumberFormat('fa-IR').format(count), 'count'));
        button.onclick = () => navigate(target); card.append(button); cards.append(card);
      }
      view.append(cards, element('p', 'تعداد درخواست‌ها مربوط به حداکثر ۱۰۰ مورد برگشتی هر صف است.', 'workspace-note'),
        element('h2', 'برنامه‌های آماده بررسی'), queueTable(review));
      return view;
    }
    if (section === 'review' || section === 'changes') {
      const view = element('div');
      view.append(element('p', 'این فاز فهرست را از سرور نمایش می‌دهد؛ پرونده و ویرایش بالینی در فاز ۶ تکمیل می‌شوند.', 'workspace-note'),
        queueTable(await session.api('specialist/queue?bucket=' + (section === 'review' ? 'awaiting_review' : 'revisions'))));
      return view;
    }
    if (section === 'conversations') {
      const view = element('div');
      view.append(element('p', 'فهرست گفتگوهای حساب شما؛ صفحه پیام‌رسان در فاز ۷ تکمیل می‌شود.', 'workspace-note'),
        table(await session.api('conversations'), [['گفتگو', row => row.kind === 'support' ? 'پشتیبانی' : 'ارتباط با کاربر'], ['زمان ایجاد', row => date(row.createdAt)]]));
      return view;
    }
    if (section === 'profile') {
      const profile = await session.api('specialist/profile'), card = element('section', null, 'card'), list = element('dl', null, 'definition-list');
      card.append(element('h2', 'هویت حرفه‌ای'));
      for (const [label, value] of [['نام', profile.displayName], ['تخصص', profile.credential], ['کد نظام پزشکی', profile.councilNo],
        ['وضعیت تأیید', ({verified:'تأییدشده',pending:'در انتظار تأیید',rejected:'تأیید نشده',suspended:'تعلیق‌شده'})[profile.verificationStatus]], ['معرفی', profile.bio]]) {
        list.append(element('dt', label), element('dd', value || 'ثبت نشده'));
      }
      card.append(list, element('p', 'ویرایش کامل مشخصات حرفه‌ای در فاز ۶ تکمیل می‌شود.', 'workspace-note')); return card;
    }
    if (section === 'patients') return pending('پرونده کاربران', 'اطلاعات فردی، پرسش‌نامه و سابقه برنامه کاربران اختصاص‌یافته در این بخش قرار می‌گیرد.', '۶');
    return pending('گزارش‌های هفتگی کاربران', 'خلاصه مصرف، بازخورد و ترجیحات هر هفته در این بخش قرار می‌گیرد.', '۵');
  }
  async function load() {
    if (!session.active) return;
    const request = ++generation, section = current;
    $('title').textContent = sections[section]; $('content').textContent = 'در حال دریافت اطلاعات…';
    $('content').setAttribute('aria-busy', 'true'); notice();
    for (const button of $('nav').querySelectorAll('button')) {
      button.classList.toggle('active', button.dataset.section === section);
      if (button.dataset.section === section) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    }
    try { const view = await render(section); if (request === generation && session.active) $('content').replaceChildren(view); }
    catch (error) {
      if (request !== generation) return;
      $('content').replaceChildren(element('section', error.status === 403 ? 'اجازه دسترسی به این بخش را ندارید.' : 'دریافت اطلاعات انجام نشد. با دکمه به‌روزرسانی دوباره تلاش کنید.', 'card'));
      notice(error.message);
    } finally { if (request === generation) $('content').setAttribute('aria-busy', 'false'); }
  }
  window.addEventListener('hashchange', () => {
    const next = location.hash.slice(1);
    if (sections[next] && next !== current) { current = next; load(); }
  });
  if (sections[location.hash.slice(1)]) current = location.hash.slice(1);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || $('panel').hidden) return;
    try { await session.restore(); await load(); }
    catch (error) {
      if (error.status === 401 || error.status === 403) signedOut(error.message);
      else { $('content').replaceChildren(element('section', 'بررسی نشست انجام نشد. برای ادامه دوباره تلاش کنید.', 'card')); notice(error.message); }
    }
  });
  setInterval(() => { if (!$('panel').hidden && !session.active) signedOut('نشست پایان یافته؛ دوباره وارد شوید.'); }, 30000);
  session.restore().then(signedIn).catch(error => signedOut(error.status === 401 ? '' : error.message));
})();
