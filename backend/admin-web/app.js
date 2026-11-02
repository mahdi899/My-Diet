const $ = id => document.getElementById(id);
const sections = Object.fromEntries(Object.entries(pageMeta).map(([key, page]) => [key, page.title]));
let challenge = null, current = 'dashboard', generation = 0, toastTimer;
const staffSession = SabzineStaff.create({role:'admin',onExpired:()=>signedOut()});

function notice(message = '', kind = 'success') {
  clearTimeout(toastTimer);
  const box = $('message'); box.replaceChildren(); box.hidden = !message;
  box.className = 'toast' + (kind === 'error' ? ' toast-error' : '');
  if (!message) return;
  const dismiss = button('', () => { box.hidden = true; }, { iconName: 'close', className: 'icon-button' }); dismiss.setAttribute('aria-label', 'بستن پیام');
  box.append(icon(kind === 'error' ? 'error' : 'check'), element('span', message), dismiss);
  toastTimer = setTimeout(() => { box.hidden = true; }, kind === 'error' ? 12000 : 6000);
}
async function api(path, method = 'GET', body) {
  if (path === 'auth/refresh') return staffSession.restore();
  if (path.startsWith('auth/') && path !== 'auth/logout') return staffSession.login(path, body);
  if (path === 'auth/logout') return staffSession.logout();
  return staffSession.api(path, method, body);
}
function signedOut() {
  generation++; staffSession.clear(); challenge = null;
  document.querySelectorAll('dialog').forEach(dialog => dialog.close());
  setMenu(false); $('panel').hidden = true; $('login').hidden = false;
  $('totp-form').hidden = true; $('login-form').hidden = false; $('content').replaceChildren();
  $('login-form').reset(); $('totp-form').reset();
}
function signedIn(session) {
  staffSession.accept(session); $('login').hidden = true; $('panel').hidden = false;
  current = sectionFromHash(); void load();
}
async function submit(form, action) {
  const save = form.querySelector('button[type="submit"]'); save.disabled = true; form.setAttribute('aria-busy', 'true');
  const error = form.querySelector('[role="alert"]'); if (error) error.textContent = '';
  try { await action(Object.fromEntries(new FormData(form))); }
  catch (e) { if (error) error.textContent = e.message; else notice(e.message, 'error'); }
  finally { save.disabled = false; form.removeAttribute('aria-busy'); }
}
$('login-form').onsubmit = e => {
  e.preventDefault(); submit(e.target, async body => {
    const session = await api('auth/admin/login', 'POST', body); e.target.reset();
    if (session.totpRequired) { challenge = session.totpToken; $('login-form').hidden = true; $('totp-form').hidden = false; $('totp-form').elements.code.focus(); }
    else signedIn(session);
  });
};
$('totp-form').onsubmit = e => { e.preventDefault(); submit(e.target, async body => { signedIn(await api('auth/totp', 'POST', { ...body, totpToken: challenge })); e.target.reset(); }); };
$('password-toggle').onclick = () => {
  const input = $('login-password'), visible = input.type === 'password'; input.type = visible ? 'text' : 'password';
  $('password-toggle').setAttribute('aria-pressed', String(visible)); $('password-toggle').setAttribute('aria-label', visible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'); $('password-toggle').replaceChildren(icon(visible ? 'eye-off' : 'eye'));
};
$('logout').onclick = async () => { $('logout').disabled = true; try { await api('auth/logout', 'POST'); signedOut(); notice('از حساب خارج شدید'); } catch (e) { notice(e.message, 'error'); } finally { $('logout').disabled = false; } };

function sectionFromHash() { const hash = location.hash.slice(1); return Object.hasOwn(pageMeta, hash) ? hash : 'dashboard'; }
function navigate(section) { if (!pageMeta[section]) return; if (location.hash === '#' + section) { current = section; void load(); } else location.hash = section; }
window.addEventListener('hashchange', () => { if (staffSession.active && location.hash !== '#main') { current = sectionFromHash(); setMenu(false); void load(); } });
let lastGroup, group;
for (const [key, page] of Object.entries(pageMeta)) {
  if (page.group !== lastGroup) { group = element('div', null, 'nav-group'); group.append(element('div', page.group, 'nav-group-label')); $('nav').append(group); lastGroup = page.group; }
  const link = element('a', null, 'nav-link'); link.href = '#' + key; link.dataset.section = key; link.append(icon(page.icon), element('span', page.title));
  link.onclick = () => { if (current === key) setMenu(false); }; group.append(link);
}
const smallScreen = matchMedia('(max-width: 760px)');
function setMenu(open) {
  const visible = open && smallScreen.matches; document.body.classList.toggle('menu-open', visible);
  $('sidebar-backdrop').hidden = !visible; $('menu-toggle').setAttribute('aria-expanded', String(visible));
  $('sidebar').inert = smallScreen.matches && !visible;
  if (visible) { $('sidebar').setAttribute('role', 'dialog'); $('sidebar').setAttribute('aria-modal', 'true'); $('menu-close').focus(); }
  else { $('sidebar').removeAttribute('role'); $('sidebar').removeAttribute('aria-modal'); }
}
$('menu-toggle').onclick = () => setMenu(true);
$('menu-close').onclick = $('sidebar-backdrop').onclick = () => { setMenu(false); $('menu-toggle').focus(); };
smallScreen.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', e => {
  if (!document.body.classList.contains('menu-open')) return;
  if (e.key === 'Escape') { setMenu(false); $('menu-toggle').focus(); }
  if (e.key === 'Tab') {
    const focusable = [...$('sidebar').querySelectorAll('a,button')].filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
hydrateIcons(); setMenu(false);
$('today').textContent = new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' });
$('today').dateTime = new Date().toISOString();

function money(value) { const span = element('span', number(value), 'money'); span.append(element('small', 'تومان')); return span; }
const serviceNames = { new_plan: 'برنامه جدید', ai_revision: 'بازنگری هوش مصنوعی', specialist_revision: 'بازنگری پزشک' };
const roleNames = { user: 'کاربر', specialist: 'پزشک', admin: 'مدیر' };
const kindNames = { ...serviceNames, care: 'گفت‌وگوی درمانی', support: 'پشتیبانی' };
const orderColumns = [
  { label: 'کاربر', render: row => personCell(row.user, 'سفارش ' + row.id.slice(0, 8)) },
  { label: 'خدمت', render: row => serviceNames[row.serviceCode] || row.serviceCode },
  { label: 'مبلغ', render: row => money(row.amountToman) },
  { label: 'وضعیت', render: row => badge(row.status) },
  { label: 'زمان ثبت', className: 'cell-nowrap', render: row => formatDate(row.createdAt) },
];
function dashboard(stats, orders) {
  const view = element('div', null, 'dashboard-page');
  const hero = element('section', null, 'dashboard-hero'), copy = element('div', null, 'hero-copy'), decoration = element('div', null, 'hero-decoration'); decoration.setAttribute('aria-hidden', 'true'); decoration.append(icon('leaf'));
  copy.append(element('span', 'هر روز، یک قدم به سلامت نزدیک‌تر', 'eyebrow'), element('h2', 'سبزینه را با یک نگاه مدیریت کنید.'), element('p', 'از پیگیری درخواست‌ها تا ارتباط با کاربران؛ همهٔ مسیرهای مهم، همین‌جا در دسترس شماست.'), button('مشاهده درخواست‌ها', () => navigate('requests'), { iconName: 'arrow-left', secondary: true })); hero.append(copy, decoration); view.append(hero);
  const cards = element('div', null, 'metrics-grid');
  for (const item of [
    { label: 'کاربران', value: stats.users, note: number(stats.newUsers) + ' عضو جدید در ۷ روز اخیر', icon: 'users', tone: 'green' },
    { label: 'درآمد ۳۰ روز اخیر', value: stats.revenueToman, unit: 'تومان', note: number(stats.paidOrders) + ' سفارش پرداخت‌شده · سهم نقدی', icon: 'wallet', tone: 'amber' },
    { label: 'پیام‌های خوانده‌نشده', value: stats.unreadMessages, note: 'پیام‌های پشتیبانی در انتظار بررسی', icon: 'message', tone: 'blue' },
    { label: 'درخواست‌های امروز AI', value: stats.aiToday, note: 'تلاش‌های ثبت‌شده امروز · وقت تهران', icon: 'sparkles', tone: 'rose' },
  ]) {
    const card = element('section', null, 'card metric-card'), top = element('div', null, 'metric-top'), value = element('div', number(item.value), 'metric-value');
    top.append(element('p', item.label), iconTile(item.icon, item.tone)); if (item.unit) value.append(element('small', item.unit)); card.append(top, value, element('div', item.note, 'metric-foot')); cards.append(card);
  }
  view.append(cards);
  const lower = element('div', null, 'dashboard-lower');
  lower.append(listPanel(orders.slice(0, 5), { title: 'آخرین سفارش‌ها', description: 'پنج سفارش اخیر کاربران', columns: orderColumns, compact: true, pageSize: 5, iconName: 'bag', emptyTitle: 'هنوز سفارشی ثبت نشده', emptyDescription: 'با ثبت اولین سفارش، جزئیات آن را اینجا خواهید دید.', action: button('همه سفارش‌ها', () => navigate('orders'), { secondary: true, iconName: 'arrow-left' }) }));
  const quick = element('section', null, 'card quick-panel'), links = element('div', null, 'quick-links'); quick.append(sectionHead('دسترسی سریع', 'از کجا شروع می‌کنید؟'));
  for (const [key, description] of [['users', 'حساب‌ها و اطلاعات کاربران'], ['orders', 'خریدها و جزئیات خدمات'], ['messages', 'گفت‌وگو با کاربران'], ['tickets', 'درخواست‌های پشتیبانی']]) {
    const link = element('a', null, 'quick-link'), text = element('div'); link.href = '#' + key; text.append(element('strong', sections[key]), element('small', description)); link.append(iconTile(pageMeta[key].icon), text, icon('chevron-left')); links.append(link);
  }
  quick.append(links); lower.append(quick); view.append(lower); return view;
}
const genericColumns = {
  users: [ { label: 'کاربر', render: r => personCell(r.displayName, r.phone) }, { label: 'نقش', render: r => roleNames[r.role] || r.role }, { label: 'وضعیت حساب', render: r => badge(r.status) }, { label: 'شناسه', render: r => shortId(r.id) } ],
  requests: [ { label: 'درخواست', render: r => shortId(r.id) }, { label: 'کاربر', render: r => shortId(r.userId) }, { label: 'نوع درخواست', render: r => kindNames[r.kind] || r.kind }, { label: 'وضعیت', render: r => badge(r.status) }, { label: 'زمان ثبت', render: r => formatDate(r.createdAt), className: 'cell-nowrap' } ],
  specialists: [ { label: 'پزشک', render: r => personCell(r.displayName, r.credential) }, { label: 'معرفی', key: 'bio', className: 'cell-body' }, { label: 'امتیاز', render: r => r.averageRating == null ? 'هنوز بدون امتیاز' : number(r.averageRating) + ' از ۵' }, { label: 'نظرات', render: r => number(r.reviewCount) } ],
  payments: [ { label: 'تراکنش', render: r => shortId(r.id) }, { label: 'کاربر', render: r => shortId(r.userId) }, { label: 'مبلغ', render: r => money(r.amountToman) }, { label: 'وضعیت', render: r => badge(r.status) }, { label: 'تاریخ پرداخت', render: r => formatDate(r.createdAt), className: 'cell-nowrap' } ],
  reviews: [ { label: 'کاربر', render: r => shortId(r.userId) }, { label: 'امتیاز', render: r => number(r.rating) + ' از ۵' }, { label: 'نظر', key: 'body', className: 'cell-body' }, { label: 'وضعیت', render: r => badge(r.status) }, { label: 'بررسی', render: r => {
    const actions = element('div', null, 'cell-actions');
    for (const [status, text, name] of [['approved', 'تأیید', 'check'], ['rejected', 'رد', 'close']]) actions.append(button(text, async () => { await api('admin/reviews/' + encodeURIComponent(r.id), 'POST', { status }); await load(); notice('نظر بررسی شد'); }, { secondary: true, iconName: name, className: status === 'rejected' ? 'danger' : '' }));
    return actions;
  } } ],
  messages: [ { label: 'گفت‌وگو', render: r => shortId(r.id) }, { label: 'نوع', render: r => kindNames[r.kind] || r.kind }, { label: 'درخواست مرتبط', render: r => shortId(r.requestId) }, { label: 'زمان ایجاد', render: r => formatDate(r.createdAt) } ],
  tickets: [ { label: 'تیکت', render: r => shortId(r.id) }, { label: 'کاربر', render: r => shortId(r.userId) }, { label: 'زمان ایجاد', render: r => formatDate(r.createdAt) } ],
  'audit-logs': [ { label: 'عملیات', render: r => auditLabel(r.action) }, { label: 'بخش', render: r => ({ ai_connection: 'هوش مصنوعی', push_campaign: 'اعلان', settings: 'تنظیمات', user: 'کاربر', specialist: 'پزشک' })[r.targetType] || r.targetType }, { label: 'مدیر', render: r => shortId(r.actorId) }, { label: 'شناسه مرتبط', render: r => shortId(r.targetId) }, { label: 'زمان', render: r => formatDate(r.createdAt), className: 'cell-nowrap' } ],
};
function auditLabel(action) { return ({ ai_connection_created: 'افزودن سرویس هوش مصنوعی', ai_connection_deleted: 'حذف سرویس هوش مصنوعی', ai_connection_activation: 'تغییر وضعیت سرویس', push_draft_created: 'ساخت پیش‌نویس اعلان', push_queued: 'قرارگیری اعلان در صف', push_deleted: 'حذف اعلان', firebase_configured: 'تنظیم اتصال Firebase', user_status: 'تغییر وضعیت کاربر', wallet_adjusted: 'اصلاح موجودی', price_updated: 'تغییر تعرفه', reward_updated: 'تغییر پاداش' })[action] || action; }
function tablePage(rows, section) {
  const empty = { users: ['کاربری برای نمایش نیست', 'حساب‌های ثبت‌شدهٔ سبزینه در این بخش قرار می‌گیرند.'], requests: ['درخواست جدیدی ثبت نشده', 'وضعیت درخواست‌های برنامه را از همین بخش دنبال خواهید کرد.'], orders: ['هنوز سفارشی ثبت نشده', 'جزئیات خرید خدمات کاربران پس از ثبت سفارش نمایش داده می‌شود.'], payments: ['پرداختی برای نمایش نیست', 'تراکنش‌های کاربران پس از ثبت در این فهرست نمایش داده می‌شوند.'], reviews: ['همه‌چیز بررسی شده است', 'نظر جدیدی که به بررسی شما نیاز داشته باشد، اینجا نمایش داده می‌شود.'], messages: ['هنوز گفت‌وگویی ندارید', 'گفت‌وگوهای مرتبط با حساب شما در این بخش قرار می‌گیرند.'], tickets: ['تیکتی ثبت نشده است', 'درخواست‌های پشتیبانی کاربران در این بخش نمایش داده می‌شوند.'], specialists: ['پزشک فعالی برای نمایش نیست', 'اطلاعات پزشکان فعال سبزینه در این فهرست نمایش داده می‌شود.'], 'audit-logs': ['هنوز فعالیتی ثبت نشده', 'تغییرات مدیریتی با زمان و شناسه در این بخش ثبت می‌شوند.'] };
  const filters = [...new Set(rows.map(r => r.status).filter(Boolean))].map(value => [value, statusLabels[value] || value]);
  return listPanel(rows, { title: sections[section], description: number(rows.length) + ' مورد در فهرست', columns: section === 'orders' ? orderColumns : genericColumns[section], iconName: pageMeta[section].icon, filters, emptyTitle: empty[section][0], emptyDescription: empty[section][1] });
}
function settings() {
  const layout = element('div', null, 'settings-layout');
  const priceCard = element('section', null, 'card form-card'), rewardCard = element('section', null, 'card form-card');
  priceCard.append(sectionHead('تعرفه خدمات', 'قیمت هر خدمت به تومان ثبت می‌شود.', iconTile('wallet')));
  const form = element('form'); const service = field(form, 'serviceCode', 'انتخاب خدمت', 'select');
  service.append(Object.assign(element('option', 'یک خدمت انتخاب کنید'), { value: '' }));
  for (const [value, text] of Object.entries(serviceNames)) service.append(Object.assign(element('option', text), { value }));
  const amount = field(form, 'amountToman', 'مبلغ خدمت (تومان)', 'number'); amount.min = '1'; amount.step = '1'; amount.placeholder = 'مثلاً ۲۵۰۰۰۰';
  form.append(infoNote('تعرفهٔ جدید برای خریدهای بعدی اعمال می‌شود.'));
  form.append(formFooter('ذخیره تعرفه', 'check')); onForm(form, async body => { await api('admin/prices', 'PUT', { ...body, amountToman: Number(body.amountToman) }); notice('تعرفه ذخیره شد'); }); priceCard.append(form);
  rewardCard.append(sectionHead('پاداش هفتگی', 'انگیزه‌ای برای ادامهٔ مسیر سلامت.', iconTile('star', 'amber')));
  const reward = element('form'), rewardAmount = field(reward, 'amountToman', 'مبلغ پاداش (تومان)', 'number'); rewardAmount.min = '0'; rewardAmount.step = '1'; rewardAmount.placeholder = 'مثلاً ۲۰۰۰۰';
  reward.append(infoNote('مبلغ پاداش به تومان است. برای پاداش بدون مبلغ، صفر وارد کنید. کمپین روزهای پیاپی در بخش جدا ساخته می‌شود و هنوز روی سرور زنده ذخیره نمی‌شود.'));
  reward.append(formFooter('ذخیره پاداش', 'check')); onForm(reward, async body => { await api('admin/reward', 'PUT', { amountToman: Number(body.amountToman) }); notice('پاداش ذخیره شد'); }); rewardCard.append(reward);
  layout.append(priceCard, rewardCard); return layout;
}
async function load() {
  const request = ++generation, section = current, meta = pageMeta[section];
  $('title').textContent = meta.title; $('breadcrumb').textContent = meta.title; $('page-eyebrow').textContent = meta.group; $('page-description').textContent = meta.description; document.title = meta.title + ' | مدیریت سبزینه';
  $('page-actions').replaceChildren();
  document.querySelectorAll('.nav-link').forEach(link => { const active = link.dataset.section === section; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('content').replaceChildren(skeleton()); $('content').setAttribute('aria-busy', 'true');
  try {
    let view;
    if(section==='reasons') view=SabzineMessaging.reasonsConfig();
    else if (section==='questionnaire') view=SabzineReports.questionnairePage();
    else if (section==='user-reports') view=SabzineReports.userReports();
    else if (section==='specialist-reports') view=SabzineReports.specialistReports();
    else if (section==='journeys') view = SabzineJourneys.journeyPage();
    else if (section === 'ai') view = await aiPage();
    else if (section === 'notifications') view = await notificationsPage();
    else if (section === 'streaks') view = SabzineStreak.campaignPage();
    else if (section === 'settings') view = settings();
    else if (section === 'dashboard') { const [stats, orders] = await Promise.all([api('admin/dashboard'), api('admin/orders')]); view = dashboard(stats, orders); }
    else if (section === 'reviews') { const stack = element('div', null, 'report-stack'); stack.append(SabzineReports.moderationNote(), tablePage(await api('admin/reviews?status=pending'), section)); view = stack; }
    else { const path = section === 'specialists' ? 'specialists' : section === 'messages' ? 'conversations' : section === 'tickets' ? 'admin/support-conversations' : 'admin/' + section; view = tablePage(await api(path), section); }
    if (request !== generation || !staffSession.active) return;
    $('content').replaceChildren(view);
    if (section === 'ai') $('page-actions').append(button('افزودن API جدید', addAiModal, { iconName: 'plus' }));
    if (section === 'notifications') $('page-actions').append(button('اتصالات', firebaseModal, { secondary: true, iconName: 'sliders' }), button('اعلان جدید', notificationModal, { iconName: 'plus' }));
  } catch (error) {
    if (request !== generation || !staffSession.active) return;
    const panel = element('section', null, 'card error-panel'); panel.append(emptyState('ارتباط با سرور برقرار نشد', error.message, 'error', button('تلاش دوباره', () => load(), { secondary: true }))); $('content').replaceChildren(panel);
  } finally { if (request === generation) $('content').removeAttribute('aria-busy'); }
}
function phaseOnePage(section) {
  const descriptions = {
    questionnaire:['پیکربندی پرسش‌نامه','ویرایش و انتشار نسخه‌های پرسش‌نامه در فاز ۹ تکمیل می‌شود.','۹'],
    reasons:['دلایل تغییر برنامه','افزودن، غیرفعال‌سازی و مرتب‌سازی گزینه‌های دلیل درخواست.','۹'],
    'user-reports':['گزارش کاربران','ادامه استفاده در هفته‌های اول، دوم و چهارم و تحلیل انتخاب غذاها.','۹'],
    'specialist-reports':['گزارش متخصصان','امتیاز کاربران، زمان پاسخ‌گویی و عملکرد متخصصان.','۹'],
    journeys:['مسیر کاربران','گراف مسیرهای ورود اول و بازگشت کاربران.','۱۰'],
  };
  return WorkspaceUI.pending(...descriptions[section]);
}
document.addEventListener('visibilitychange',async()=>{
  if(document.hidden || $('panel').hidden)return;
  void loadAfterSessionCheck();
});
async function loadAfterSessionCheck(){
  try{await staffSession.restore();await load();}catch(error){
    if(error.status===401||error.status===403)signedOut();
    else $('content').replaceChildren(emptyState('بررسی نشست انجام نشد',error.message,'error',button('تلاش دوباره',loadAfterSessionCheck,{secondary:true})));
  }
}
setInterval(()=>{if(!$('panel').hidden&&!staffSession.active){signedOut();notice('نشست پایان یافته؛ دوباره وارد شوید.','error');}},30000);
api('auth/refresh','POST',{}).then(signedIn).catch(error=>{signedOut();if(error.status!==401)notice(error.message,'error');});
