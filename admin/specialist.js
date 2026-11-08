/* Authenticated specialist navigation, existing APIs and phase 6 clinical workspaces. */
(() => {
  const $ = id => document.getElementById(id);
  const { element, table, date } = WorkspaceUI;
  const sections = { dashboard: 'داشبورد', patients: 'پرونده کاربران', review: 'برنامه‌های منتظر بررسی',
    changes: 'درخواست‌های تغییر برنامه', conversations: 'گفتگوها', reports: 'گزارش‌های هفتگی', profile: 'پروفایل حرفه‌ای' };
  const status = { in_review:'در انتظار بررسی',response_received:'پاسخ دریافت شده',queued:'در صف',generating:'در حال تولید',awaiting_review:'منتظر بررسی',reviewing:'در حال بررسی',
    awaiting_user:'در انتظار پاسخ کاربر',needs_info:'نیاز به اطلاعات',published:'منتشرشده',cancelled:'لغوشده' };
  const session = SabzineStaff.create({ role: 'specialist', onExpired: () => signedOut('نشست پایان یافته؛ دوباره وارد شوید.') });
  let messagingDemo=null;
  const messagingLive=SabzineMessagingRepository.live(session);
  const demoMessages=()=>messagingDemo ||= SabzineMessagingRepository.sample();
  let current = 'dashboard', generation = 0, phone = '', challenge = null;
  const notice = text => { $('message').textContent = text || ''; };
  function signedOut(message = '') {
    SabzineMessaging.reset();messagingDemo=null; SabzineClinical.reset(); generation++; session.clear(); $('panel').hidden = true; $('login').hidden = false;
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
  function navigate(section) { if(!SabzineClinical.leave()||!SabzineMessaging.leave())return; current = section; location.hash = section; load(); }
  for (const [key, label] of Object.entries(sections)) {
    const button = element('button', label); button.type = 'button'; button.dataset.section = key;
    button.onclick = () => navigate(key); $('nav').append(button);
  }
  $('refresh').onclick = () => load();
  $('today').textContent = date(new Date());
  function demoClinical() {
    if(!SabzineClinical.leave())return;
    const repository=SabzineClinicalRepository.sample(),expected=++generation;
    repository.get().then(request=>{if(session.active&&expected===generation)$('content').replaceChildren(SabzineClinical.start({repository,request,session,onBack:load}));});
  }
  function demoButton() {const b=element('button','باز کردن پرونده و ویرایشگر نمونه','secondary');b.type='button';b.onclick=demoClinical;return b;}
  const queueTable = rows => table(rows, [
    ['پرونده و ویرایش', row=>{const b=element('button','باز کردن پرونده و برنامه','secondary');b.onclick=async()=>{
      const expected=++generation;b.disabled=true;
      try {
        if(expected!==generation||!session.active)return;
        $('content').replaceChildren(SabzinePlanReview.open({session,requestId:row.id,onBack:load}));$('content').focus();
      }catch(error){if(expected===generation)notice(error.message);}finally{b.disabled=false;}
    };return b;}],
    ['جزئیات غذا', row => {
      const button = element('button', 'بررسی جزئیات و جایگزین‌ها');
      button.type = 'button'; button.className = 'secondary';
      button.onclick = async () => {
        const expected = ++generation; button.disabled = true; notice();
        try {
          const request = await session.api('specialist/requests/' + encodeURIComponent(row.id));
          if (expected !== generation || !session.active) return;
          const inspector = SabzineMealQuality.render(request);
          const back = element('button', 'بازگشت به فهرست'); back.onclick = () => load();
          $('content').replaceChildren(back, inspector); $('content').focus();
        } catch (error) { if (expected === generation) notice(error.message); }
        finally { button.disabled = false; }
      }; return button;
    }],
    ['نام کاربر', row => row.userName || row.user || row.displayName || 'نام ثبت نشده'],
    ['وضعیت', row => status[row.status] || 'نیازمند بررسی'],
    ['نوع', row => row.kind === 'new_plan' ? 'برنامه جدید' : 'بازنگری برنامه'],
    ['زمان ثبت', row => date(row.createdAt)],
  ]);
  function showChat(repository,conversationId){if(!SabzineClinical.leave()||!SabzineMessaging.leave())return;generation++;$('title').textContent='گفتگو با کاربر';$('content').replaceChildren(SabzineMessaging.chat({repository,session,conversationId}));}
  function changeView(repository){return SabzineMessaging.changes({repository,session,onChat:showChat,onEditor:(repo,request)=>{SabzineMessaging.reset();generation++;$('content').replaceChildren(SabzinePlanReview.open({session,requestId:request.id,onBack:()=>showChanges(repository)}));}});}
  function showChanges(repository){if(!SabzineClinical.leave()||!SabzineMessaging.leave())return;generation++;$('title').textContent='درخواست‌های تغییر برنامه';$('content').replaceChildren(changeView(repository));}
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
    if(section==='changes') {
      const view=element('div'),sample=element('button','باز کردن درخواست‌های تغییر نمونه','secondary');sample.onclick=()=>showChanges(demoMessages());view.append(sample,changeView(messagingLive));return view;
    }
    if (section === 'review') {
      const view = element('div');
      view.append(element('p', 'پرونده و پیش‌نویس را از درخواست‌های اختصاص‌یافته باز کنید. نمونهٔ جداگانه برای بررسی رابط کامل موجود است.', 'workspace-note'),demoButton(),
        queueTable(await session.api('specialist/queue?bucket=' + (section === 'review' ? 'awaiting_review' : 'revisions'))));
      return view;
    }
    if(section==='conversations') {const view=element('div'),sample=element('button','باز کردن پیام‌رسان نمونه','secondary');sample.onclick=()=>showChat(demoMessages());view.append(sample,SabzineMessaging.chat({repository:messagingLive,session}));return view;}
    if (section === 'profile') {
      const profile = await session.api('specialist/profile'), card = element('section', null, 'card'), list = element('dl', null, 'definition-list');
      card.append(element('h2', 'هویت حرفه‌ای'));
      for (const [label, value] of [['نام', profile.displayName], ['تخصص', profile.credential], ['کد نظام پزشکی', profile.councilNo],
        ['وضعیت تأیید', ({verified:'تأییدشده',pending:'در انتظار تأیید',rejected:'تأیید نشده',suspended:'تعلیق‌شده'})[profile.verificationStatus]], ['معرفی', profile.bio]]) {
        list.append(element('dt', label), element('dd', value || 'ثبت نشده'));
      }
      card.append(list, element('p', 'ویرایش مشخصات حرفه‌ای به API مدیریت پروفایل وابسته است.', 'workspace-note')); return card;
    }
    if(section==='patients') {
      const view=element('div');view.append(element('p','پرونده‌های مرتبط با درخواست‌های اختصاص‌یافته؛ دادهٔ پزشکی ارائه‌نشده از روی نام یا درخواست حدس زده نمی‌شود.','workspace-note'),demoButton(),queueTable(await session.api('specialist/queue')));return view;
    }
    return SabzineWeeklyReports.render();
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
    if (sections[next] && next !== current) { if(!SabzineClinical.leave()||!SabzineMessaging.leave()){location.hash=current;return;} current = next; load(); }
  });
  if (sections[location.hash.slice(1)]) current = location.hash.slice(1);
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || $('panel').hidden) return;
    try { await session.restore(); if(!SabzineClinical.open&&!SabzineMessaging.open)await load(); }
    catch (error) {
      if (error.status === 401 || error.status === 403) signedOut(error.message);
      else if(SabzineClinical.open||SabzineMessaging.open){notice(error.message);} else { $('content').replaceChildren(element('section', 'بررسی نشست انجام نشد. برای ادامه دوباره تلاش کنید.', 'card')); notice(error.message); }
    }
  });
  setInterval(() => { if (!$('panel').hidden && !session.active) signedOut('نشست پایان یافته؛ دوباره وارد شوید.'); }, 30000);
  session.restore().then(signedIn).catch(error => signedOut(error.status === 401 ? '' : error.message));
})();
