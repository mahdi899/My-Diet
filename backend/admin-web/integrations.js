let fieldSequence = 0;
function openModal(title, build, { iconName = 'sliders', danger = false } = {}) {
  const dialog = element('dialog', null, 'modal' + (danger ? ' modal-danger' : ''));
  const titleId = 'modal-title-' + (++fieldSequence), heading = element('h2', title); heading.id = titleId; dialog.setAttribute('aria-labelledby', titleId);
  const head = element('header', null, 'modal-header'), titleWrap = element('div', null, 'modal-title'), body = element('div', null, 'modal-body');
  const close = button('', () => dialog.close(), { iconName: 'close', className: 'icon-button' }); close.setAttribute('aria-label', 'بستن');
  titleWrap.append(iconTile(iconName), heading); head.append(titleWrap, close); dialog.append(head, body); build(body, dialog);
  const previous = document.activeElement; document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); });
  dialog.showModal(); const input = body.querySelector('input:not([type=hidden]),textarea,select'); if (input) input.focus();
  return dialog;
}
function field(form, name, label, type = 'text', value = '') {
  const wrap = element('label', label), input = element(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  input.id = 'field-' + (++fieldSequence); wrap.htmlFor = input.id; input.name = name; if (input.tagName === 'INPUT') input.type = type;
  input.setAttribute('aria-label', label); input.required = true; input.value = value; wrap.append(input); form.append(wrap); return input;
}
function help(input, text) { const description = element('p', text, 'form-help'); description.id = input.id + '-help'; input.setAttribute('aria-describedby', description.id); input.parentElement.append(description); }
function formFooter(label, iconName = 'check', dialog) {
  const footer = element('div', null, 'form-submit'); const save = button(label, null, { iconName }); save.type = 'submit'; footer.append(save);
  if (dialog) footer.append(button('انصراف', () => dialog.close(), { secondary: true })); return footer;
}
function formError(form, error) {
  let box = form.querySelector('[role="alert"]'); if (!box) { box = element('p', null, 'form-error'); box.setAttribute('role', 'alert'); box.tabIndex = -1; form.append(box); }
  box.textContent = error; if (error) box.focus();
}
function onForm(form, action) {
  form.onsubmit = async e => {
    e.preventDefault(); const save = form.querySelector('button[type="submit"]'); save.disabled = true; form.setAttribute('aria-busy', 'true'); formError(form, '');
    try { await action(Object.fromEntries(new FormData(form))); } catch (error) { formError(form, error.message); }
    finally { save.disabled = false; form.removeAttribute('aria-busy'); }
  };
}
function confirmAction(title, description, label, action) {
  openModal(title, (body, dialog) => {
    body.append(element('p', description)); const footer = element('div', null, 'form-submit');
    footer.append(button(label, async () => { await action(); dialog.close(); await load(); }, { iconName: 'trash', className: 'danger' }), button('انصراف', () => dialog.close(), { secondary: true })); body.append(footer);
  }, { iconName: 'trash', danger: true });
}
function addAiModal() {
  openModal('افزودن سرویس هوش مصنوعی', (body, dialog) => {
    body.append(element('p', 'مشخصات سرویس را وارد کنید؛ پس از ذخیره می‌توانید آن را فعال کنید.'));
    const form = element('form'), grid = element('div', null, 'form-grid'); form.append(grid);
    const name = field(grid, 'name', 'نام هوش مصنوعی'); name.maxLength = 80; name.placeholder = 'مثلاً سرویس تولید برنامه';
    const model = field(grid, 'model', 'نام مدل'); model.dir = 'ltr'; model.maxLength = 120; model.placeholder = 'model-name';
    const key = field(form, 'apiKey', 'کلید API', 'password'); key.autocomplete = 'new-password'; key.maxLength = 4096; key.dir = 'ltr'; key.placeholder = 'کلید سرویس را اینجا قرار دهید'; help(key, 'کلید شما خصوصی می‌ماند و پس از ذخیره دوباره نمایش داده نمی‌شود.');
    const url = field(form, 'baseUrl', 'آدرس پایه سرویس', 'url', 'https://api.openai.com/v1'); url.dir = 'ltr'; help(url, 'از سرویس‌های سازگار با OpenAI Chat Completions استفاده کنید.');
    const cost = field(form, 'costPer1kTokens', 'هزینه تخمینی هر ۱۰۰۰ توکن (میکرودلار)', 'number', '0'); cost.min = '0'; cost.step = '1'; help(cost, 'برای محاسبه هزینه، تعرفه سرویس را وارد کنید. صفر یعنی هزینه ثبت نمی‌شود.');
    form.append(formFooter('ذخیره سرویس', 'plus', dialog));
    onForm(form, async value => { await api('admin/ai-connections', 'POST', { ...value, costPer1kTokens: Number(value.costPer1kTokens) }); dialog.close(); await load(); notice('سرویس جدید اضافه شد'); }); body.append(form);
  }, { iconName: 'sparkles' });
}
async function aiPage() {
  const rows = await api('admin/ai-connections'), view = element('div', null, 'ai-page'), active = rows.find(row => row.active);
  const summary = element('section', null, 'card integration-summary'), title = element('div', null, 'integration-summary-title'), text = element('div');
  text.append(element('h2', 'هوش مصنوعی، در خدمت سبزینه'), element('p', 'انتخاب سرویس تولید برنامه از یک نقطه.')); title.append(iconTile('sparkles'), text);
  const metrics = element('div', null, 'summary-metrics');
  for (const [label, value] of [['سرویس‌های متصل', number(rows.length)], ['سرویس فعال', active ? active.name : 'انتخاب نشده'], ['وضعیت کلیدها', 'خصوصی']]) { const metric = element('div', null, 'summary-metric'); metric.append(element('small', label), typeof value === 'string' && value.length > 4 ? badge(active || label === 'وضعیت کلیدها' ? 'active' : 'draft', value) : element('strong', value)); metrics.append(metric); }
  summary.append(title, metrics); view.append(summary);
  if (!rows.length) {
    const empty = element('section', null, 'card integration-empty'); empty.append(emptyState('اولین سرویس را متصل کنید', 'نام، کلید API و مدل را وارد کنید تا مدیریت سرویس از همین‌جا شروع شود.', 'key', button('افزودن API جدید', addAiModal, { iconName: 'plus' })), infoNote('هر بار یک سرویس فعال است. تغییر سرویس برای درخواست‌های بعدی اعمال می‌شود.')); view.append(empty); return view;
  }
  const grid = element('div', null, 'connection-grid');
  for (const row of rows) {
    const card = element('section', null, 'card connection-card'), top = element('div', null, 'connection-top'), identity = element('div'); identity.append(element('h2', row.name), element('small', 'سرویس تولید برنامه')); top.append(iconTile('sparkles'), identity, badge(row.active ? 'active' : 'draft', row.active ? 'فعال' : 'غیرفعال'));
    const details = element('div', null, 'connection-details');
    for (const [label, value, ltr] of [['مدل', row.model, true], ['آدرس سرویس', row.baseUrl, true], ['کلید API', '•••• •••• ••••', true], ['هزینه / هزار توکن', number(row.costPer1kTokens) + ' میکرودلار', false]]) { const line = element('div', null, 'connection-detail'); line.append(element('small', label), element('span', value, ltr ? 'ltr' : '')); details.append(line); }
    const actions = element('div', null, 'connection-actions'); actions.append(button(row.active ? 'غیرفعال کردن' : 'فعال کردن', async () => { await api('admin/ai-connections/' + row.id + '/active', 'PUT', { active: !row.active }); await load(); notice('وضعیت سرویس تغییر کرد'); }, { secondary: row.active, iconName: row.active ? 'close' : 'check' }), button('حذف', () => confirmAction('حذف سرویس', 'سرویس «' + row.name + '» از تنظیمات حذف شود؟', 'حذف سرویس', () => api('admin/ai-connections/' + row.id, 'DELETE')), { iconName: 'trash', secondary: true, className: 'ghost' }));
    card.append(top, details, actions); grid.append(card);
  }
  view.append(grid); return view;
}
function firebaseModal() {
  openModal('اتصال به Firebase', (body, dialog) => {
    body.append(infoNote('برای ارسال پوش، اطلاعات حساب سرویس Firebase پروژه را ثبت کنید. کلید خصوصی پس از ذخیره نمایش داده نمی‌شود.'));
    const form = element('form'), input = field(form, 'account', 'JSON حساب سرویس', 'textarea'); input.rows = 8; input.dir = 'ltr'; input.spellcheck = false; input.placeholder = '{ "project_id": "…", "client_email": "…", "private_key": "…" }';
    help(input, 'محتوای فایل حساب سرویس را به‌طور کامل وارد کنید.'); form.append(formFooter('ذخیره اتصال', 'check', dialog));
    onForm(form, async value => { let account; try { account = JSON.parse(value.account); } catch { throw new Error('محتوای JSON معتبر نیست. فایل حساب سرویس را بررسی کنید.'); } await api('admin/push/firebase', 'PUT', account); dialog.close(); await load(); notice('اتصال ذخیره شد. برای بررسی دسترسی، یک اعلان آزمایشی بفرستید.'); }); body.append(form);
  }, { iconName: 'server' });
}
async function notificationModal() {
  const devices = await api('admin/push/devices');
  openModal('ساخت اعلان جدید', (body, dialog) => {
    const form = element('form'), title = field(form, 'title', 'عنوان اعلان'); title.maxLength = 120; title.placeholder = 'عنوان کوتاه و روشن برای پیام شما';
    const message = field(form, 'body', 'متن اعلان', 'textarea'); message.maxLength = 1000; message.rows = 3; message.placeholder = 'چه پیامی برای کاربران دارید؟';
    const preview = element('div', null, 'notification-preview'), previewText = element('div'), previewTitle = element('strong', 'سبزینه'), previewBody = element('p', 'پیش‌نمایش پیام شما'); previewText.append(previewTitle, previewBody); preview.append(iconTile('leaf'), previewText, element('small', 'پیش‌نمایش')); form.append(preview);
    title.oninput = () => { previewTitle.textContent = title.value || 'سبزینه'; }; message.oninput = () => { previewBody.textContent = message.value || 'پیش‌نمایش پیام شما'; };
    const audience = field(form, 'audience', 'مخاطبان', 'select');
    for (const [value, label] of [['device', 'آزمایشی · یک دستگاه'], ['all', 'همه کاربران']]) audience.append(Object.assign(element('option', label), { value }));
    const device = field(form, 'deviceId', 'دستگاه آزمایشی', 'select'); device.append(Object.assign(element('option', 'یک دستگاه انتخاب کنید'), { value: '' }));
    for (const d of devices) device.append(Object.assign(element('option', (d.displayName || 'کاربر') + ' · ' + d.platform + ' · ' + d.id.slice(-6)), { value: d.id }));
    if (!devices.length) help(device, 'هنوز دستگاهی برای دریافت اعلان ثبت نشده است. برای ذخیره پیش‌نویس می‌توانید «همه کاربران» را انتخاب کنید.');
    audience.onchange = () => { device.parentElement.hidden = audience.value === 'all'; device.required = audience.value === 'device'; };
    const schedule = field(form, 'scheduledAt', 'زمان ارسال (اختیاری)', 'datetime-local'); schedule.required = false; help(schedule, 'به وقت تهران. برای ارسال بدون زمان‌بندی، این فیلد را خالی بگذارید.');
    form.append(infoNote('ابتدا پیش‌نویس ذخیره می‌شود. ارسال نهایی را از بخش جزئیات تأیید می‌کنید.'), formFooter('ذخیره پیش‌نویس', 'check', dialog));
    onForm(form, async value => { const payload = { title: value.title, body: value.body, audience: value.audience }; if (value.audience === 'device') payload.deviceId = value.deviceId; if (value.scheduledAt) payload.scheduledAt = new Date(value.scheduledAt + ':00+03:30').toISOString(); await api('admin/push/campaigns', 'POST', payload); dialog.close(); await load(); notice('پیش‌نویس اعلان ذخیره شد'); }); body.append(form);
  }, { iconName: 'bell' });
}
const campaignStatuses = { draft: 'پیش‌نویس', scheduled: 'زمان‌بندی‌شده', sending: 'در حال ارسال', completed: 'پایان ارسال', failed: 'ناموفق' };
function notificationDetails(row, status) {
  openModal('جزئیات اعلان', (body, dialog) => {
    body.append(element('h3', row.title), element('p', row.body, 'detail-message'));
    const grid = element('div', null, 'detail-grid');
    for (const [label, value] of [['وضعیت', badge(row.status)], ['مخاطبان', row.audience === 'all' ? 'همه کاربران' : 'آزمایشی · یک دستگاه'], ['پذیرفته‌شده', number(row.accepted) + ' دستگاه'], ['خطا / نامشخص', number(row.failed) + ' دستگاه'], ['زمان ایجاد', formatDate(row.createdAt)], ['زمان ارسال', formatDate(row.sentAt || row.scheduledAt)]]) { const item = element('div'); item.append(element('small', label), value instanceof Node ? value : element('strong', value)); grid.append(item); } body.append(grid);
    if (row.status === 'draft') {
      body.append(infoNote(status.configured ? 'با تأیید، اعلان برای مخاطبان انتخاب‌شده در صف ارسال قرار می‌گیرد.' : 'برای ارسال، ابتدا اتصال Firebase را در بخش اتصالات تنظیم کنید.', status.configured ? '' : 'warning'));
      const footer = element('div', null, 'form-submit'), send = button(row.scheduledAt ? 'تأیید زمان‌بندی' : row.audience === 'all' ? 'تأیید و ارسال به همه کاربران' : 'ارسال آزمایشی', async () => { await api('admin/push/campaigns/' + row.id + '/send', 'POST', {}); dialog.close(); await load(); notice('اعلان در صف ارسال قرار گرفت'); }, { iconName: 'send' }); send.disabled = !status.configured; footer.append(send); body.append(footer);
    }
  }, { iconName: 'bell' });
}
async function notificationsPage() {
  const [status, rows] = await Promise.all([api('admin/push/status'), api('admin/push/campaigns')]);
  const view = element('div', null, 'push-page'), summary = element('section', null, 'card integration-summary'), identity = element('div', null, 'integration-summary-title'), text = element('div');
  text.append(element('h2', 'ارتباط مستقیم با کاربران'), element('p', 'اعلان بسازید، آزمایش کنید و نتیجه را ببینید.')); identity.append(iconTile('send'), text);
  const metrics = element('div', null, 'summary-metrics'), service = element('div', null, 'summary-metric');
  service.append(element('small', 'وضعیت سرویس'), badge(status.configured ? 'active' : 'pending', status.configured ? 'Firebase تنظیم‌شده' : 'در انتظار اتصال'));
  if (status.projectId) service.append(element('p', status.projectId, 'project-id ltr')); metrics.append(service);
  for (const [label, value] of [['گوشی‌های واجد شرایط', status.devices], ['اعلان‌های زمان‌بندی‌شده', status.scheduled]]) { const metric = element('div', null, 'summary-metric'); metric.append(element('small', label), element('strong', number(value))); metrics.append(metric); }
  summary.append(identity, metrics, infoNote(status.configured ? 'پذیرفته‌شده به معنای پذیرش پیام توسط Firebase است؛ نمایش روی گوشی به تنظیمات دستگاه بستگی دارد.' : 'پیش‌نویس‌ها را آماده کنید؛ پس از اتصال Firebase و ثبت دستگاه، ارسال واقعی فعال می‌شود.')); view.append(summary);
  const columns = [
    { label: 'عنوان اعلان', render: row => { const text = element('div', null, 'notification-title-cell'); text.append(element('strong', row.title), element('small', row.body.length > 65 ? row.body.slice(0, 65) + '…' : row.body)); return text; } },
    { label: 'وضعیت', render: row => badge(row.status) },
    { label: 'مخاطبان', render: row => row.audience === 'all' ? 'همه کاربران' : 'آزمایشی · یک دستگاه', className: 'cell-nowrap' },
    { label: 'پذیرفته‌شده', render: row => number(row.accepted) },
    { label: 'کل گوشی‌ها', render: row => number(row.total) },
    { label: 'خطا / نامشخص', render: row => number(row.failed) },
    { label: 'زمان ارسال · تهران', render: row => formatDate(row.sentAt || row.scheduledAt), className: 'cell-nowrap' },
    { label: 'تاریخ ایجاد', render: row => formatDate(row.createdAt), className: 'cell-nowrap' },
    { label: 'عملیات', render: row => { const actions = element('div', null, 'cell-actions'); actions.append(button('جزئیات', () => notificationDetails(row, status), { secondary: true, iconName: 'eye' })); if (row.status !== 'sending') actions.append(button('حذف', () => confirmAction('حذف اعلان', 'اعلان از فهرست حذف و ارسال زمان‌بندی‌شده لغو شود؟ گزارش آن حفظ می‌شود.', 'حذف اعلان', () => api('admin/push/campaigns/' + row.id, 'DELETE')), { secondary: true, iconName: 'trash', className: 'danger' })); return actions; } },
  ];
  view.append(listPanel(rows, { title: 'اعلان‌ها', description: number(rows.length) + ' اعلان در فهرست', columns, filters: Object.entries(campaignStatuses), emptyTitle: 'اولین پیام شما، شروع یک ارتباط', emptyDescription: 'با دکمهٔ «اعلان جدید» یک پیام بسازید و ابتدا آن را به‌صورت پیش‌نویس ذخیره کنید.', iconName: 'bell' })); return view;
}
