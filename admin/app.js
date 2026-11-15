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
async function logoutAccount(trigger) {
  trigger.disabled = true;
  try { await api('auth/logout', 'POST'); signedOut(); notice('از حساب خارج شدید'); }
  catch (e) { notice(e.message, 'error'); }
  finally { trigger.disabled = false; }
}
function setAccountMenu(open) {
  $('account-menu').hidden = !open;
  $('account-toggle').setAttribute('aria-expanded', String(open));
}
$('logout').onclick = () => logoutAccount($('logout'));
$('logout-menu').onclick = () => logoutAccount($('logout-menu'));
$('account-toggle').onclick = event => { event.stopPropagation(); setAccountMenu($('account-menu').hidden); };
document.addEventListener('click', event => {
  if (!$('account-menu') || $('account-menu').hidden) return;
  if (!$('account-toggle').parentElement.contains(event.target)) setAccountMenu(false);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') setAccountMenu(false); });

function sectionFromHash() { const hash = location.hash.slice(1) === 'orders' ? 'payments' : location.hash.slice(1); return Object.hasOwn(pageMeta, hash) ? hash : 'dashboard'; }
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
const kindNames = { ...serviceNames, care: 'گفت‌وگوی درمانی', support: 'پشتیبانی' };
const paymentColumns = [
  { label: 'کاربر', render: row => personCell(row.user, 'پرداخت ' + row.id.slice(0, 8)) },
  { label: 'پکیج', render: row => row.packageCode },
  { label: 'مبلغ', render: row => money(row.amountToman) },
  { label: 'وضعیت', render: row => badge(row.status) },
  { label: 'زمان پرداخت', className: 'cell-nowrap', render: row => formatDate(row.createdAt) },
];
function dashboard(stats, orders) {
  const view = element('div', null, 'dashboard-page');
  const hero = element('section', null, 'dashboard-hero'), copy = element('div', null, 'hero-copy'), decoration = element('div', null, 'hero-decoration'); decoration.setAttribute('aria-hidden', 'true'); decoration.append(icon('leaf'));
  copy.append(element('span', 'هر روز، یک قدم به سلامت نزدیک‌تر', 'eyebrow'), element('h2', 'رژیم من را با یک نگاه مدیریت کنید.'), element('p', 'از پیگیری درخواست‌ها تا ارتباط با کاربران؛ همهٔ مسیرهای مهم، همین‌جا در دسترس شماست.'), button('مشاهده درخواست‌ها', () => navigate('requests'), { iconName: 'arrow-left', secondary: true })); hero.append(copy, decoration); view.append(hero);
  const cards = element('div', null, 'metrics-grid');
  for (const item of [
    { label: 'کاربران', value: stats.users, note: number(stats.newUsers) + ' عضو جدید در ۷ روز اخیر', icon: 'users', tone: 'green' },
    { label: 'درآمد ۳۰ روز اخیر', value: stats.revenueToman, unit: 'تومان', note: number(stats.paidOrders) + ' خرید پکیج', icon: 'wallet', tone: 'amber' },
    { label: 'پیام‌های خوانده‌نشده', value: stats.unreadMessages, note: 'پیام‌های پشتیبانی در انتظار بررسی', icon: 'message', tone: 'blue' },
    { label: 'درخواست‌های امروز AI', value: stats.aiToday, note: 'تلاش‌های ثبت‌شده امروز · وقت تهران', icon: 'sparkles', tone: 'rose' },
  ]) {
    const card = element('section', null, 'card metric-card'), top = element('div', null, 'metric-top'), value = element('div', number(item.value), 'metric-value');
    top.append(element('p', item.label), iconTile(item.icon, item.tone)); if (item.unit) value.append(element('small', item.unit)); card.append(top, value, element('div', item.note, 'metric-foot')); cards.append(card);
  }
  view.append(cards);
  const lower = element('div', null, 'dashboard-lower');
  lower.append(listPanel(orders.slice(0, 5), { title: 'آخرین پرداخت‌ها', description: 'پنج خرید اخیر پکیج', columns: paymentColumns, compact: true, pageSize: 5, iconName: 'wallet', emptyTitle: 'هنوز پرداختی ثبت نشده', emptyDescription: 'با خرید اولین پکیج، جزئیات آن را اینجا خواهید دید.', action: button('همه پرداخت‌ها', () => navigate('payments'), { secondary: true, iconName: 'arrow-left' }) }));
  const quick = element('section', null, 'card quick-panel'), links = element('div', null, 'quick-links'); quick.append(sectionHead('دسترسی سریع', 'از کجا شروع می‌کنید؟'));
  for (const [key, description] of [['users', 'حساب‌ها و اطلاعات کاربران'], ['payments', 'خرید پکیج‌ها'], ['messages', 'گفت‌وگو با کاربران'], ['tickets', 'درخواست‌های پشتیبانی']]) {
    const link = element('a', null, 'quick-link'), text = element('div'); link.href = '#' + key; text.append(element('strong', sections[key]), element('small', description)); link.append(iconTile(pageMeta[key].icon), text, icon('chevron-left')); links.append(link);
  }
  quick.append(links); lower.append(quick); view.append(lower); return view;
}
const genericColumns = {
  users: [ { label: 'کاربر', render: r => userPhotoCell(r.displayName, r.phone, r.photo) }, { label: 'وضعیت حساب', render: r => badge(r.status) }, { label: 'شناسه', render: r => shortId(r.id) }, { label: 'عملیات', render: r => userRowActions(r) } ],
  requests: [ { label: 'درخواست', render: r => shortId(r.id) }, { label: 'کاربر', render: r => shortId(r.userId) }, { label: 'نوع درخواست', render: r => kindNames[r.kind] || r.kind }, { label: 'وضعیت', render: r => badge(r.status) }, { label: 'زمان ثبت', render: r => formatDate(r.createdAt), className: 'cell-nowrap' } ],
  specialists: [ { label: 'نام', render: r => doctorCell(r) }, { label: 'شماره تلفن', render: r => ltrText(r.phone), className: 'cell-nowrap' }, { label: 'کد نظام پزشکی', render: r => ltrText(r.councilNo), className: 'cell-nowrap' }, { label: 'تعداد زیرمجموعه', render: r => number(r.subordinateCount ?? 0) }, { label: 'زیرمجموعه‌ها', render: r => specialistMembersAction(r) }, { label: 'عملیات', render: r => specialistRowActions(r) } ],
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
function iconAction(label, action, iconName, className = '') {
  const control = button('', action, { iconName, className: ['icon-button', className].filter(Boolean).join(' ') });
  control.setAttribute('aria-label', label);
  return control;
}
function userRowActions(row) {
  const actions = element('div', null, 'cell-actions');
  actions.append(iconAction('ویرایش', () => userOperations(row), 'pencil'));
  if (row.status !== 'deleted') {
    actions.append(iconAction('حذف حساب', () => confirmAction('حذف حساب کاربری', 'حساب «' + (row.displayName || row.phone) + '» و همهٔ داده‌های وابسته‌اش برای همیشه از پایگاه داده پاک می‌شود.', 'حذف حساب', async () => {
      await api('admin/users/' + encodeURIComponent(row.id) + '/delete', 'POST', { confirmation: 'حذف حساب' });
      notice('حساب حذف شد');
      await load();
    }), 'trash', 'danger'));
  }
  return actions;
}
function ltrText(value) {
  return element('span', value || '—', 'ltr');
}
function startedLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' });
}
function civilLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return '—';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}
function doctorCell(row) {
  const cell = personCell(row.displayName);
  if (row.portrait) {
    const photo = element('img');
    photo.className = 'avatar avatar-soft';
    photo.alt = '';
    photo.src = row.portrait;
    cell.replaceChild(photo, cell.firstChild);
  }
  return cell;
}
function latinDigits(value) {
  return String(value).replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) - (c <= '٩' ? 0x660 : 0x6f0))).replace(/\D/g, '');
}
function portraitFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    if (!/^image\/(?:jpeg|png)$/.test(file.type) || file.size > 5_000_000) { reject(new Error('یک تصویر JPG یا PNG کوچک‌تر از ۵ مگابایت انتخاب کنید')); return; }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 256 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تصویر خوانده نشد')); };
    image.src = url;
  });
}
function specialistMembersAction(row) {
  const actions = element('div', null, 'cell-actions');
  actions.append(iconAction('زیرمجموعه‌ها', () => specialistMembers(row), 'eye'));
  return actions;
}
function memberLine(person, action) {
  const line = element('div', null, 'member-row');
  line.append(userPhotoCell(person.displayName, person.phone, person.photo), action);
  return line;
}
function specialistMembers(doctor) {
  openModal('زیرمجموعه‌های ' + (doctor.displayName || 'پزشک'), async (body, dialog) => {
    dialog.classList.add('user-detail-modal');
    dialog.addEventListener('close', () => { void load(); }, { once: true });
    await renderSpecialistMembers(body, doctor);
  }, { iconName: 'users', modalClass: 'modal-wide' });
}
async function renderSpecialistMembers(body, doctor) {
  const path = 'admin/specialists/' + encodeURIComponent(doctor.id) + '/members';
  const paint = (nodes) => { body.replaceChildren(...nodes); };
  const navigate = async view => {
    try {
      await view();
      body.querySelector('.member-toolbar button')?.focus();
    } catch (error) {
      const alert = element('p', error.message, 'form-error');
      alert.setAttribute('role', 'alert');
      paint([alert, button('تلاش دوباره', () => navigate(view), { secondary: true })]);
      body.querySelector('button')?.focus();
    }
  };
  const showCurrent = async () => {
    paint([skeleton()]);
    const people = await api(path);
    const toolbar = element('div', null, 'member-toolbar');
    toolbar.append(button('افزودن زیرمجموعه', () => navigate(showAvailable), { iconName: 'plus' }));
    const list = element('div', null, 'member-list');
    if (!people.length) list.append(infoNote('هنوز کاربری در زیرمجموعهٔ این پزشک نیست.'));
    for (const person of people) {
      const remove = iconAction('حذف از زیرمجموعه', async () => {
        remove.disabled = true;
        try {
          await api(path + '/' + encodeURIComponent(person.id), 'DELETE');
          notice('کاربر از زیرمجموعه خارج شد');
          await navigate(showCurrent);
        } catch (error) {
          notice(error.message, 'error');
          remove.disabled = false;
        }
      }, 'trash', 'danger');
      list.append(memberLine(person, remove));
    }
    paint([toolbar, list]);
  };
  const showAvailable = async () => {
    paint([skeleton()]);
    const people = await api(path + '?available=1');
    const toolbar = element('div', null, 'member-toolbar');
    toolbar.append(button('بازگشت به زیرمجموعه‌ها', () => navigate(showCurrent), { secondary: true, iconName: 'chevron-right' }));
    const list = element('div', null, 'member-list');
    if (!people.length) list.append(infoNote('کاربری که زیرمجموعهٔ هیچ پزشکی نباشد پیدا نشد.'));
    for (const person of people) {
      const add = button('افزودن', async () => {
        add.disabled = true;
        try {
          await api(path, 'POST', { userId: person.id });
          notice('کاربر به زیرمجموعه اضافه شد');
          await navigate(showCurrent);
        } catch (error) {
          notice(error.message, 'error');
          add.disabled = false;
        }
      }, { secondary: true, iconName: 'plus' });
      list.append(memberLine(person, add));
    }
    paint([toolbar, list]);
  };
  await navigate(showCurrent);
}
function specialistRowActions(row) {
  const actions = element('div', null, 'cell-actions');
  actions.append(button('ویرایش', () => specialistDetail(row), { secondary: true, iconName: 'pencil' }));
  return actions;
}
function specialistDetail(row) {
  openModal('اطلاعات پزشک', (body, dialog) => {
    dialog.classList.add('user-detail-modal');
    const panel = element('div', null, 'report-stack');
    const identity = element('div', null, 'user-detail-identity');
    identity.append(doctorCell(row), badge(row.active === false ? 'suspended' : 'active', row.active === false ? 'غیرفعال' : 'فعال'));
    const grid = element('div', null, 'detail-grid');
    const education = row.education || row.credential || '—';
    const fields = [
      ['شماره تلفن', row.phone || '—', true],
      ['کد نظام پزشکی', row.councilNo || '—', true],
      ['نام کاربری', row.username || '—', true],
      ['تحصیلات', education, false],
    ];
    if (row.credential && row.education && row.credential !== row.education) fields.push(['تخصص', row.credential, false]);
    fields.push(
      ['تاریخ تولد', civilLabel(row.birthDate), false],
      ['تاریخ شروع فعالیت', startedLabel(row.startedAt), false],
      ['تعداد نظر', number(row.reviewCount ?? 0), false],
      ['تعداد زیرمجموعه', number(row.subordinateCount ?? 0), false],
    );
    for (const [label, value, ltr] of fields) {
      const item = element('div');
      const val = element('strong', String(value));
      if (ltr) val.classList.add('ltr');
      item.append(element('small', label), val);
      grid.append(item);
    }
    const about = element('div', null, 'span-row');
    about.append(element('small', 'معرفی'), element('strong', row.bio || '—'));
    grid.append(about);
    const form = element('form');
    form.classList.add('user-package-form');
    const edit = element('div', null, 'form-grid');
    const capacity = field(edit, 'capacity', 'ظرفیت پذیرش', 'number', String(row.capacity ?? 0));
    capacity.min = '0';
    capacity.max = '500';
    capacity.step = '1';
    const shownRating = row.rating != null ? row.rating : row.averageRating;
    const rating = field(edit, 'rating', 'امتیاز', 'number', shownRating == null ? '0' : String(shownRating));
    rating.min = '0';
    rating.max = '5';
    rating.step = '0.1';
    help(rating, 'از ۰ تا ۵. با ثبت، همین مقدار برای پزشک ذخیره می‌شود.');
    form.append(edit, formFooter('ثبت تغییرات', 'check'));
    onForm(form, async data => {
      const capacityValue = Number(data.capacity);
      const ratingValue = Number(data.rating);
      if (!Number.isInteger(capacityValue) || capacityValue < 0 || capacityValue > 500) throw new Error('ظرفیت پذیرش باید عددی بین ۰ و ۵۰۰ باشد');
      if (!Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) throw new Error('امتیاز باید بین ۰ و ۵ باشد');
      await api('admin/specialists/' + encodeURIComponent(row.id), 'PATCH', { capacity: capacityValue, rating: ratingValue });
      dialog.close();
      notice('امتیاز و ظرفیت پذیرش ذخیره شد');
      await load();
    });
    panel.append(identity, grid, form);
    body.append(panel);
  }, { iconName: 'medical', modalClass: 'modal-wide' });
}
function addSpecialistModal() {
  openModal('افزودن پزشک', (body, dialog) => {
    dialog.classList.add('specialist-create-modal');
    const form = element('form', null, 'specialist-form');
    const picker = element('label', null, 'portrait-picker');
    picker.title = 'انتخاب تصویر پروفایل';
    const portrait = element('input');
    portrait.type = 'file';
    portrait.name = 'portrait';
    portrait.accept = 'image/jpeg,image/png';
    portrait.required = true;
    portrait.setAttribute('aria-label', 'تصویر پروفایل');
    const preview = element('span', null, 'portrait-preview');
    preview.append(icon('plus'));
    const ring = element('span', null, 'portrait-ring');
    ring.hidden = true;
    ring.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="track" cx="18" cy="18" r="15.5" pathLength="100"></circle><circle class="bar" cx="18" cy="18" r="15.5" pathLength="100"></circle></svg>';
    let prepared = null;
    let uploadTimer = null;
    const setProgress = value => ring.style.setProperty('--p', String(100 - value));
    portrait.onchange = () => {
      const file = portrait.files[0];
      clearInterval(uploadTimer);
      picker.classList.remove('is-ready', 'is-failed');
      prepared = null;
      if (!file) { ring.hidden = true; preview.replaceChildren(icon('plus')); return; }
      ring.hidden = false;
      setProgress(4);
      let shown = 4;
      let finished = false;
      let failed = false;
      uploadTimer = setInterval(() => {
        const cap = finished ? 100 : 86;
        shown = Math.min(cap, shown + Math.max(1.4, (cap - shown) * 0.22));
        setProgress(shown);
        if (finished && shown >= 99) {
          clearInterval(uploadTimer);
          setProgress(100);
          picker.classList.add(failed ? 'is-failed' : 'is-ready');
          if (!failed) ring.hidden = true;
        }
      }, 40);
      portraitFile(file).then(photo => {
        prepared = photo;
        const image = element('img');
        image.alt = '';
        image.src = photo;
        preview.replaceChildren(image);
        finished = true;
      }).catch(error => {
        failed = true;
        finished = true;
        preview.replaceChildren(icon('plus'));
        notice(error.message, 'error');
      });
    };
    picker.append(portrait, preview, ring);
    const photoSection = element('section', null, 'specialist-photo-section');
    const photoCopy = element('div');
    photoCopy.append(element('h3', 'تصویر پروفایل'), element('p', 'برای انتخاب یا تغییر عکس کلیک کنید. فرمت JPG یا PNG.'));
    photoSection.append(picker, photoCopy);
    const grid = element('div', null, 'form-grid');
    field(grid, 'firstName', 'نام');
    field(grid, 'lastName', 'نام خانوادگی');
    const birth = SabzineJalali.jalaliField(grid, 'birthDate', 'تاریخ تولد');
    const council = field(grid, 'councilNo', 'کد نظام پزشکی');
    council.inputMode = 'numeric';
    council.maxLength = 6;
    council.dir = 'ltr';
    council.placeholder = '۱۲۳۴۵۶';
    help(council, 'دقیقاً ۶ رقم.');
    field(grid, 'education', 'تحصیلات');
    const phone = field(grid, 'phone', 'شماره تلفن', 'tel');
    phone.inputMode = 'numeric';
    phone.maxLength = 11;
    phone.dir = 'ltr';
    phone.placeholder = '۰۹۱۲۳۴۵۶۷۸۹';
    help(phone, 'دقیقاً ۱۱ رقم و با ۰۹.');
    const credentials = element('div', null, 'form-grid');
    const username = field(credentials, 'username', 'نام کاربری');
    username.dir = 'ltr';
    username.autocomplete = 'off';
    username.maxLength = 32;
    username.placeholder = 'doctor.name';
    help(username, 'برای ورود به پنل پزشک. ۳ تا ۳۲ نویسهٔ انگلیسی.');
    const passwordLabel = element('label', 'رمز عبور');
    const passwordShell = element('div', null, 'password-field');
    const password = element('input');
    password.type = 'password';
    password.name = 'panelPassword';
    password.id = 'specialist-panel-password';
    passwordLabel.htmlFor = password.id;
    password.setAttribute('aria-label', 'رمز عبور');
    password.required = true;
    password.dir = 'ltr';
    password.autocomplete = 'new-password';
    password.spellcheck = false;
    password.minLength = 8;
    password.maxLength = 256;
    passwordShell.append(password);
    passwordLabel.append(passwordShell);
    credentials.append(passwordLabel);
    help(password, 'حداقل ۸ نویسه. پزشک با همین نام کاربری و رمز، یا با شماره و کد پیامکی وارد می‌شود.');
    const profileSection = element('section', null, 'specialist-form-section');
    profileSection.append(element('h3', 'اطلاعات فردی و حرفه‌ای'), element('p', 'مشخصات پزشک را مطابق مدارک وارد کنید.'), grid);
    const loginSection = element('section', null, 'specialist-form-section');
    loginSection.append(element('h3', 'دسترسی به پنل پزشک'), credentials);
    const members = element('section', null, 'specialist-form-section specialist-create-members');
    const membersTitle = element('h3', 'زیرمجموعه‌ها');
    const membersBody = element('div');
    membersBody.append(element('p', 'بعد از ایجاد حساب، کاربران را همین‌جا به زیرمجموعهٔ پزشک اضافه کنید.'));
    members.append(membersTitle, membersBody);
    form.append(profileSection, photoSection, loginSection, members, formFooter('ایجاد حساب پزشک', 'check', dialog));
    onForm(form, async data => {
      if (!prepared) throw new Error('تصویر پروفایل را انتخاب کنید و صبر کنید تا بارگذاری کامل شود');
      const councilNo = latinDigits(data.councilNo);
      const mobile = latinDigits(data.phone);
      if (!/^\d{6}$/.test(councilNo)) throw new Error('کد نظام پزشکی باید دقیقاً ۶ رقم باشد');
      if (!/^09\d{9}$/.test(mobile)) throw new Error('شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود');
      if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(data.username.trim())) throw new Error('نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی باشد و با حرف شروع شود');
      const panelPassword = data.panelPassword ?? '';
      if (panelPassword.length < 8) throw new Error('رمز عبور باید حداقل ۸ نویسه باشد');
      if (!birth.value) throw new Error('تاریخ تولد را از تقویم شمسی انتخاب کنید');
      const doctor = await api('admin/specialists', 'POST', {
        firstName: data.firstName, lastName: data.lastName, birthDate: data.birthDate,
        councilNo, education: data.education, phone: mobile, portrait: prepared,
        username: data.username.trim().toLowerCase(), password: panelPassword,
      });
      if (!dialog.open) { await load(); return; }
      const saved = element('p', 'حساب پزشک ایجاد شد.', 'info-note');
      saved.setAttribute('role', 'status');
      const finish = element('div', null, 'form-submit');
      finish.append(button('پایان', () => dialog.close(), { iconName: 'check' }));
      form.replaceChildren(saved, members, finish);
      dialog.addEventListener('close', () => { void load(); }, { once: true });
      notice('پزشک ثبت شد');
      await renderSpecialistMembers(membersBody, doctor);
    });
    body.append(form);
  }, { iconName: 'medical' });
}
function userPhotoCell(name, phone, encoded) {
  const cell = personCell(name, phone);
  if (typeof encoded !== 'string' || !/^(?:\/9j\/|iVBORw0KGgo)[A-Za-z0-9+/=]+$/.test(encoded)) return cell;
  const photo = document.createElement('img');
  const mime = encoded.startsWith('/9j/') ? 'jpeg' : 'png';
  photo.src = 'data:image/' + mime + ';base64,' + encoded;
  photo.alt = '';
  photo.className = 'avatar avatar-soft';
  photo.style.objectFit = 'cover';
  photo.addEventListener('load', () => cell.firstElementChild.replaceWith(photo), { once: true });
  return cell;
}
function userOperations(row) {
  openModal('ویرایش کاربر', async (body, dialog) => {
    dialog.classList.add('user-detail-modal');
    body.append(skeleton());
    const detail = await api('admin/users/' + encodeURIComponent(row.id));
    const intake = detail.intake ?? {};
    const personal = detail.personalDetails;
    const grid = element('div', null, 'detail-grid');
    for (const [label, value] of [
      ['نام', detail.displayName || row.displayName || 'بدون نام'],
      ['شماره ورود', detail.phone || row.phone || '—'],
      ...(personal ? [
        ['شماره تماس', personal.contactPhone],
        ['سن', number(personal.age)],
        ['قد (سانتی‌متر)', number(personal.height)],
        ['وزن (کیلوگرم)', number(personal.weight)],
      ] : []),
      ['هدف انتخاب‌شده', intake.trackLabel || '—'],
      ['ثبت‌نام از طریق', intake.source === 'demo' ? 'آنبوردینگ وب' : (row.registrationLabel || 'اپلیکیشن')],
      ['وضعیت حساب', statusLabels[detail.status] || detail.status],
      ['پکیج فعال', row.packageTitle || 'پکیج فعالی ندارد'],
    ]) {
      const item = element('div');
      const val = element('strong', value);
      if (label === 'شماره ورود' || label === 'شماره تماس') val.classList.add('ltr');
      item.append(element('small', label), val);
      grid.append(item);
    }
    const panel = element('div', null, 'report-stack');
    const identity = element('div', null, 'user-detail-identity');
    identity.append(userPhotoCell(detail.displayName || row.displayName || 'کاربر', detail.phone || row.phone, personal?.photo ?? row.photo), badge(detail.status));
    panel.append(identity, grid);
    if (intake.answers?.length) {
      const answersCard = element('section', null, 'card');
      answersCard.append(sectionHead('پاسخ‌های پرسش‌نامه', 'اطلاعاتی که کاربر در دمو یا اپ ثبت کرده است.'));
      const list = element('dl', null, 'ob-pairs');
      for (const item of intake.answers) {
        list.append(element('dt', item.question), element('dd', item.answer));
      }
      answersCard.append(list);
      panel.append(answersCard);
    } else {
      panel.append(infoNote('هنوز پاسخ پرسش‌نامه‌ای برای این حساب در دسترس نیست.'));
    }
    const form = element('form');
    form.classList.add('user-package-form');
    form.append(sectionHead('مدیریت پکیج', row.packageTitle || 'پکیج فعالی ندارد'));
    const days = field(form, 'daysRemaining', 'روزهای مانده از پکیج', 'number', row.daysRemaining == null ? '' : String(row.daysRemaining));
    days.required = false;
    days.min = '0';
    days.max = '3650';
    days.step = '1';
    help(days, 'عدد جدید از همین لحظه محاسبه می‌شود. صفر یعنی دسترسی پکیج همین حالا تمام شود.');
    form.append(formFooter('ذخیره روزهای مانده', 'check'));
    onForm(form, async data => {
      const value = Number(data.daysRemaining);
      if (!Number.isInteger(value) || value < 0 || value > 3650) throw new Error('تعداد روز درست نیست');
      await api('admin/users/' + encodeURIComponent(row.id) + '/package', 'PUT', { daysRemaining: value });
      dialog.close();
      notice('روزهای پکیج ذخیره شد');
      await load();
    });
    panel.append(form);
    if (row.status !== 'deleted' && row.role !== 'admin') {
      const actions = element('div', null, 'form-submit user-account-actions');
      const statusChoices = [
        ['active', 'فعال', 'check'],
        ['pending', 'در انتظار', 'clock'],
        ['suspended', 'غیرفعال', 'lock'],
      ];
      for (const [status, label, iconName] of statusChoices) {
        if (status === detail.status) continue;
        actions.append(button('تنظیم وضعیت: ' + label, async () => {
          await api('admin/users/' + encodeURIComponent(row.id) + '/status', 'POST', { status });
          dialog.close();
          notice('وضعیت حساب به «' + label + '» تغییر کرد');
          await load();
        }, { secondary: true, iconName }));
      }
      actions.append(button('حذف حساب این شماره', () => {
        dialog.close();
        confirmAction('حذف حساب کاربری', 'حساب «' + (detail.displayName || row.displayName || row.phone) + '» و همهٔ داده‌های وابسته‌اش برای همیشه از پایگاه داده پاک می‌شود.', 'حذف حساب', async () => {
          await api('admin/users/' + encodeURIComponent(row.id) + '/delete', 'POST', { confirmation: 'حذف حساب' });
          notice('حساب حذف شد');
          await load();
        });
      }, { className: 'danger', iconName: 'trash' }));
      panel.append(actions);
    }
    body.replaceChildren(panel);
  }, { iconName: 'users', modalClass: 'modal-wide' });
}
function tablePage(rows, section) {
  const empty = { users: ['کاربری برای نمایش نیست', 'حساب‌های ثبت‌شدهٔ رژیم من در این بخش قرار می‌گیرند.'], requests: ['درخواست جدیدی ثبت نشده', 'وضعیت درخواست‌های برنامه را از همین بخش دنبال خواهید کرد.'], payments: ['پرداختی برای نمایش نیست', 'خرید پکیج‌ها پس از ثبت در این فهرست نمایش داده می‌شوند. تغییر برنامه بعد از خرید، پرداخت جداگانه ندارد.'], reviews: ['همه‌چیز بررسی شده است', 'نظر جدیدی که به بررسی شما نیاز داشته باشد، اینجا نمایش داده می‌شود.'], messages: ['هنوز گفت‌وگویی ندارید', 'گفت‌وگوهای مرتبط با حساب شما در این بخش قرار می‌گیرند.'], tickets: ['تیکتی ثبت نشده است', 'درخواست‌های پشتیبانی کاربران در این بخش نمایش داده می‌شوند.'], specialists: ['پزشک فعالی برای نمایش نیست', 'اطلاعات پزشکان فعال رژیم من در این فهرست نمایش داده می‌شود.'], 'audit-logs': ['هنوز فعالیتی ثبت نشده', 'تغییرات مدیریتی با زمان و شناسه در این بخش ثبت می‌شوند.'] };
  const filters = [...new Set(rows.map(r => r.status).filter(Boolean))].map(value => [value, statusLabels[value] || value]);
  const panel = listPanel(rows, { title: sections[section], description: number(rows.length) + ' مورد در فهرست', columns: section === 'payments' ? paymentColumns : genericColumns[section], iconName: pageMeta[section].icon, filters, emptyTitle: empty[section][0], emptyDescription: empty[section][1] });
  if (section === 'users') panel.classList.add('users-table-panel');
  return panel;
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
  $('title').textContent = meta.title; $('breadcrumb').textContent = meta.title; $('page-eyebrow').textContent = meta.group; $('page-description').textContent = meta.description; document.title = meta.title + ' | مدیریت رژیم من';
  $('page-actions').replaceChildren();
  document.querySelectorAll('.nav-link').forEach(link => { const active = link.dataset.section === section; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('content').replaceChildren(skeleton()); $('content').setAttribute('aria-busy', 'true');
  try {
    let view;
    if(section==='reasons') view=SabzineMessaging.reasonsConfig();
    else if (section==='questionnaire') view=await onboardingQuestionnairePage();
    else if (section==='user-reports') view=SabzineReports.userReports();
    else if (section==='specialist-reports') view=SabzineReports.specialistReports();
    else if (section==='journeys') view = SabzineJourneys.journeyPage();
    else if (section==='web-analytics') view = await webAnalyticsPage();
    else if (section==='campaign-links') view = await campaignLinksPage();
    else if (section==='articles') view = await articlesPage();
    else if (section === 'ai') view = await SabzineAi.page();
    else if (section === 'onboarding') view = await SabzineOnboarding.page();
    else if (section === 'foods') view = await SabzineFoods.page();
    else if (section === 'notifications') view = await notificationsPage();
    else if (section === 'streaks') view = SabzineStreak.campaignPage();
    else if (section === 'settings') view = settings();
    else if (section === 'dashboard') { const [stats, payments] = await Promise.all([api('admin/dashboard'), api('admin/payments')]); view = dashboard(stats, payments); }
    else if (section === 'payments') {
      const [payments, transfers] = await Promise.all([api('admin/payments'), api('admin/onboarding-transfers')]);
      view = element('div', null, 'report-stack');
      view.append(onboardingTransferPanel(transfers), tablePage(payments, section));
    }
    else if (section === 'reviews') { view = tablePage(await api('admin/reviews?status=pending'), section); }
    else { const path = section === 'messages' ? 'conversations' : section === 'tickets' ? 'admin/support-conversations' : 'admin/' + section; view = tablePage(await api(path), section); }
    if (request !== generation || !staffSession.active) return;
    $('content').replaceChildren(view);
    if (section === 'notifications') $('page-actions').append(button('اتصالات', firebaseModal, { secondary: true, iconName: 'sliders' }), button('اعلان جدید', notificationModal, { iconName: 'plus' }));
    if (section === 'specialists') $('page-actions').append(button('افزودن', addSpecialistModal, { iconName: 'plus' }));
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
function onboardingTransferPanel(rows) {
  const plans = { weekly: 'شروع', monthly: 'همراه', quarterly: 'VIP' };
  return listPanel(rows, {
    title: 'واریزهای کارت‌به‌کارت آنبوردینگ',
    description: 'مبلغ را با گردش حساب تطبیق دهید و شناسه پیگیری بانکی را ثبت کنید.',
    columns: [
      { label: 'شماره کاربر', render: row => row.phone_e164 },
      { label: 'پلن', render: row => plans[row.plan] },
      { label: 'روش پرداخت', render: row => row.zibal_track_id ? 'زیبال' : 'کارت‌به‌کارت' },
      { label: 'مبلغ', render: row => money(row.amount_toman) },
      { label: 'مهلت واریز', render: row => new Date(row.expires_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }) },
      { label: 'وضعیت', render: row => row.confirmed_at ? 'تأیید شد' : Date.parse(row.expires_at) > Date.now() ? 'در انتظار' : 'مهلت تمام شد' },
      { label: 'پیامک', render: row => ({ sent: 'ارسال شد', failed: 'ارسال ناموفق', sending: 'در حال ارسال' })[row.sms_status] || '—' },
      { label: 'پیگیری', render: row => row.confirmed_at ? row.bank_reference : row.zibal_track_id ? 'منتظر زیبال' : button('تأیید واریز', () => {
        openModal('تأیید واریز کارت‌به‌کارت', (body, dialog) => {
          const form = element('form');
          form.append(infoNote('مبلغ مورد انتظار ' + number(row.amount_toman) + ' تومان است. مبلغ واقعی و شناسه را از گردش حساب وارد کنید.'));
          const amount = field(form, 'amount', 'مبلغ واریزشده (تومان)', 'number');
          const reference = field(form, 'reference', 'شناسه پیگیری بانکی', 'text');
          amount.required = reference.required = true;
          form.append(formFooter('ثبت تأیید', 'check'));
          onForm(form, async values => {
            const result = await api('admin/onboarding-transfers/' + row.id + '/confirm', 'POST', { reference: values.reference, amountToman: Number(values.amount) });
            dialog.close();
            notice(result.smsStatus === 'sent' ? 'واریز تأیید و پیامک ارسال شد' : 'واریز تأیید شد. پیامک ارسال نشد.');
            await load();
          });
          body.append(form);
        });
      }, { secondary: true }) },
    ],
  });
}
