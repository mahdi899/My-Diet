/* Shared visual components. User-provided strings are always rendered as text. */
const pageMeta = {
  dashboard: { title: 'داشبورد', icon: 'grid', group: 'نمای کلی', description: 'تصویر امروز رژیم من؛ همه‌چیز در یک نگاه.' },
  users: { title: 'کاربران', icon: 'users', group: 'مدیریت خدمات', description: 'حساب‌ها و وضعیت کاربران را از اینجا دنبال کنید.' },
  specialists: { title: 'پزشکان', icon: 'medical', group: 'مدیریت خدمات', description: 'پزشکان فعال و اطلاعات تخصصی آن‌ها.' },
  requests: { title: 'درخواست‌ها', icon: 'clipboard', group: 'مدیریت خدمات', description: 'مسیر درخواست‌ها، از ثبت تا انتشار برنامه.' },
  orders: { title: 'سفارش‌ها', icon: 'bag', group: 'مدیریت خدمات', description: 'جزئیات سفارش‌ها و وضعیت خرید خدمات.' },
  payments: { title: 'پرداخت‌ها', icon: 'wallet', group: 'مدیریت خدمات', description: 'پرداخت‌ها و تراکنش‌های ثبت‌شده در رژیم من.' },
  reviews: { title: 'نظرات', icon: 'star', group: 'ارتباط با کاربران', description: 'نظرات در انتظار بررسی را بخوانید و مدیریت کنید.' },
  messages: { title: 'پیام‌ها', icon: 'message', group: 'ارتباط با کاربران', description: 'گفت‌وگوهای مرتبط با حساب مدیریت شما.' },
  tickets: { title: 'تیکت‌ها', icon: 'headphones', group: 'ارتباط با کاربران', description: 'درخواست‌های پشتیبانی و ارتباط کاربران با تیم شما.' },
  notifications: { title: 'نوتفیکیشن', icon: 'bell', group: 'ارتباط با کاربران', description: 'پیام درست را در زمان درست به دست کاربران برسانید.' },
  onboarding: { title: 'ثبت‌نام و پروفایل‌ها', icon: 'users', group: 'مدیریت خدمات', description: 'پروفایل تغذیه‌ای کاربران، قیف ثبت‌نام و سرنخ‌های دمو.' },
  foods: { title: 'کاتالوگ غذا', icon: 'clipboard', group: 'مدیریت خدمات', description: 'غذاهای ایرانی که برنامه‌ها از روی آن‌ها ساخته می‌شود.' },
  articles: { title: 'مقالات', icon: 'clipboard', group: 'محتوا', description: 'نوشتن، ویرایش و انتشار مقاله‌های مجلهٔ رژیم من.' },
  ai: { title: 'هوش مصنوعی', icon: 'sparkles', group: 'تنظیمات و ابزارها', description: 'سرویس‌ها، استخر مدل‌ها، هزینه، پرامپت و کیفیت پیش‌نویس‌ها.' },
  settings: { title: 'تعرفه و پاداش', icon: 'sliders', group: 'تنظیمات و ابزارها', description: 'تعرفه خدمات و پاداش هفتگی را تنظیم کنید.' },
  streaks: { title: 'کمپین روزهای پیاپی', icon: 'calendar', group: 'تنظیمات و ابزارها', description: 'شرط، مایل‌ستون و نسخهٔ پاداش روزهای پیاپی.' },
  'audit-logs': { title: 'تاریخچه فعالیت', icon: 'history', group: 'تنظیمات و ابزارها', description: 'ردپای تغییرات و فعالیت‌های مدیریتی.' },
  questionnaire: {title:'پیکربندی پرسش‌نامه',icon:'clipboard',group:'توسعه سامانه',description:'پیکربندی پرسش‌نامه کاربران.'},
  reasons: {title:'دلایل تغییر برنامه',icon:'sliders',group:'توسعه سامانه',description:'گزینه‌های دلیل درخواست تغییر.'},
  'user-reports': {title:'گزارش کاربران',icon:'users',group:'گزارش‌ها',description:'ادامه استفاده و انتخاب غذاها.'},
  'specialist-reports': {title:'گزارش متخصصان',icon:'medical',group:'گزارش‌ها',description:'عملکرد و زمان پاسخ‌گویی.'},
  journeys: {title:'مسیر کاربران',icon:'history',group:'گزارش‌ها',description:'مسیرهای ورود اول و بازگشت کاربران.'},
  'campaign-links': {title:'لینک‌های تبلیغاتی',icon:'history',group:'گزارش‌ها',description:'ساخت لینک دمو برای هر کانال و کنترل فعال‌بودن آن.'},
  'web-analytics': {title:'رهگیری سایت دمو',icon:'history',group:'گزارش‌ها',description:'ورودی تبلیغات، انتخاب هدف، زمان مراحل و مسیر واقعی کاربران دمو.'},
};
const iconPaths = {
  leaf: ['M20 3C8 2 3 8 6 15c7 4 15-1 14-12Z', 'M4 21 15 9'],
  grid: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87'],
  medical: ['M8 3H5a2 2 0 0 0-2 2v5a5 5 0 0 0 10 0V5a2 2 0 0 0-2-2', 'M8 15v1a5 5 0 0 0 10 0v-2', 'M18 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  clipboard: ['M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3', 'M9 2h6v4H9zM8 12h8M8 16h5'],
  bag: ['M6 7h12l3 14H3L6 7Z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  wallet: ['M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15V8H5a3 3 0 0 1 0-6', 'M20 12h-5v5h5M16 14.5h.01'],
  star: ['m12 3 2.78 5.63L21 9.53l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z'],
  message: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z', 'M8 11h8M8 15h4'],
  headphones: ['M3 14v-3a9 9 0 0 1 18 0v3', 'M3 13h4v7H5a2 2 0 0 1-2-2v-5ZM21 13h-4v7h2a2 2 0 0 0 2-2v-5ZM18 20a3 3 0 0 1-3 3h-3'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'],
  sparkles: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4'],
  sliders: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 10h6M9 12h6M17 16h6'],
  history: ['M3 12a9 9 0 1 0 2.7-6.4L3 8', 'M3 3v5h5M12 7v5l3 2'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 11h18M7 15h2M15 15h2'],
  'arrow-left': ['M19 12H5m7 7-7-7 7-7'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  plus: ['M12 5v14M5 12h14'], close: ['m6 6 12 12M6 18 18 6'],
  search: ['M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5'],
  filter: ['M4 7h16M7 12h10M10 17h4'],
  check: ['m5 12 4 4L19 6'],
  shield: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z', 'm8 12 3 3 5-6'],
  lock: ['M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3'],
  logout: ['M9 21H4V3h5M9 12h12m-4-4 4 4-4 4'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  'eye-off': ['m3 3 18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4M6 6a20 20 0 0 0-4 6s3.5 7 10 7a12 12 0 0 0 5-1M9 9a4 4 0 0 0 6 6'],
  key: ['M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM11 13l-8 8v-4l2-2h3M17 7h.01'],
  server: ['M3 3h18v7H3zM3 14h18v7H3zM7 6.5h.01M7 17.5h.01'],
  device: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2'],
  send: ['m22 2-7 20-4-9-9-4L22 2ZM22 2 11 13'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7h.01'],
  inbox: ['M5 3h14l3 10v7H2v-7L5 3ZM2 13h6l2 3h4l2-3h6'],
  error: ['m12 3 10 18H2L12 3ZM12 9v5M12 17h.01'],
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'icon ' + className })) svg.setAttribute(key, value);
  for (const d of iconPaths[name] || iconPaths.grid) {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon))); }
function iconTile(name, tone = 'green') { const tile = element('span', null, 'icon-tile tone-' + tone); tile.append(icon(name)); return tile; }
function button(label, action, { secondary = false, iconName, className = '' } = {}) {
  const b = element('button', null, [secondary ? 'secondary' : '', className].filter(Boolean).join(' '));
  b.type = 'button';
  if (iconName) b.append(icon(iconName));
  b.append(element('span', label));
  if (action) b.onclick = () => {
    try {
      const result = action();
      if (result && typeof result.then === 'function') {
        b.disabled = true;
        Promise.resolve(result).catch(error => notice(error.message, 'error')).finally(() => { b.disabled = false; });
      }
    } catch (error) { notice(error.message, 'error'); }
  };
  return b;
}
const number = value => new Intl.NumberFormat('fa-IR').format(value ?? 0);
function formatDate(value, withTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
const statusLabels = { active: 'فعال', suspended: 'غیرفعال', deleted: 'حذف‌شده', paid: 'پرداخت‌شده', refunded: 'بازپرداخت‌شده', credited: 'واریزشده', pending: 'در انتظار', failed: 'ناموفق', queued: 'در صف', generating: 'در حال تولید', in_review: 'در حال بررسی', awaiting_user: 'در انتظار کاربر', response_received: 'پاسخ دریافت‌شده', published: 'منتشرشده', cancelled: 'لغوشده', approved: 'تأییدشده', rejected: 'ردشده', verified: 'تأییدشده', draft: 'پیش‌نویس', scheduled: 'زمان‌بندی‌شده', sending: 'در حال ارسال', completed: 'پایان ارسال', unknown: 'نامشخص' };
function badge(value, label) {
  const tone = ['active', 'paid', 'credited', 'approved', 'verified', 'published', 'completed'].includes(value) ? 'success' : ['failed', 'rejected', 'suspended', 'deleted'].includes(value) ? 'danger' : ['pending', 'queued', 'scheduled', 'in_review', 'awaiting_user', 'generating', 'sending'].includes(value) ? 'warning' : 'neutral';
  const b = element('span', label || statusLabels[value] || value || '—', 'badge badge-' + tone);
  b.prepend(element('span', null, 'badge-dot'));
  return b;
}
function emptyState(title, description, name = 'inbox', action) {
  const state = element('div', null, 'empty-state');
  state.append(iconTile(name), element('h3', title), element('p', description));
  if (action) state.append(action);
  return state;
}
function sectionHead(title, description, action) {
  const head = element('header', null, 'section-head');
  const text = element('div'); text.append(element('h2', title)); if (description) text.append(element('p', description));
  head.append(text); if (action) head.append(action); return head;
}
function infoNote(text, tone = '') { const note = element('div', null, 'info-note ' + tone); note.append(icon('info'), element('p', text)); return note; }
function searchField(label) {
  const wrap = element('div', null, 'search-field'); const input = element('input');
  input.type = 'search'; input.placeholder = label; input.setAttribute('aria-label', label); wrap.append(icon('search'), input);
  return { wrap, input };
}
function shortId(value) { const span = element('span', value ? String(value).slice(0, 8) : '—', 'mono'); span.title = value || ''; return span; }
function personCell(name, secondary) {
  const wrap = element('div', null, 'person-cell'); const text = element('div');
  text.append(element('strong', name || 'بدون نام')); if (secondary) text.append(element('small', secondary, 'ltr'));
  wrap.append(element('span', (name || 'ک').trim().charAt(0), 'avatar avatar-soft'), text); return wrap;
}
function listPanel(rows, options) {
  const { columns, title, description = '', emptyTitle = 'هنوز موردی ثبت نشده است', emptyDescription = 'اطلاعات جدید پس از ثبت در این بخش نمایش داده می‌شوند.', iconName = 'inbox', filters = [], search = true, pageSize = 10, compact = false } = options;
  const panel = element('section', null, 'card data-panel' + (compact ? ' compact-panel' : ''));
  if (title) panel.append(sectionHead(title, description, options.action));
  let query = '', status = '', page = 0;
  const toolbar = element('div', null, 'table-toolbar');
  if (search && !compact) { const field = searchField('جستجو در ' + (title || 'فهرست') + '…'); field.input.oninput = () => { query = field.input.value.trim().toLocaleLowerCase('fa'); page = 0; render(); }; toolbar.append(field.wrap); }
  if (filters.length && !compact) {
    const wrap = element('div', null, 'filter-field'); const select = element('select'); select.setAttribute('aria-label', 'فیلتر وضعیت');
    select.append(Object.assign(element('option', 'همه وضعیت‌ها'), { value: '' }));
    for (const [value, label] of filters) select.append(Object.assign(element('option', label), { value }));
    select.onchange = () => { status = select.value; page = 0; render(); }; wrap.append(icon('filter'), select); toolbar.append(wrap);
  }
  if (toolbar.childNodes.length) panel.append(toolbar);
  const scroll = element('div', null, 'table-wrap'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', title || 'جدول اطلاعات'); panel.append(scroll);
  const footer = element('div', null, 'table-footer'); const count = element('span'); const pager = element('div', null, 'pagination');
  const prev = button('قبلی', () => { page--; render(); }, { secondary: true, iconName: 'chevron-right' });
  const next = button('بعدی', () => { page++; render(); }, { secondary: true, iconName: 'chevron-left' });
  const pageLabel = element('span', null, 'page-number'); pager.append(prev, pageLabel, next); footer.append(count, pager); if (!compact) panel.append(footer);
  function render() {
    const filtered = rows.filter(row => (!status || row.status === status) && (!query || Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('fa').includes(query))));
    page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1)));
    const table = element('table'), thead = element('thead'), head = element('tr'), tbody = element('tbody');
    for (const col of columns) { const th = element('th', col.label); th.scope = 'col'; head.append(th); } thead.append(head); table.append(thead, tbody);
    for (const row of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
      const tr = element('tr');
      for (const col of columns) { const td = element('td'); const value = col.render ? col.render(row) : row[col.key] ?? '—'; if (value instanceof Node) td.append(value); else td.textContent = String(value); if (col.className) td.className = col.className; tr.append(td); }
      tbody.append(tr);
    }
    if (!filtered.length) { const td = element('td'); td.colSpan = columns.length; td.className = 'empty-cell'; td.append(emptyState(query || status ? 'نتیجه‌ای پیدا نشد' : emptyTitle, query || status ? 'عبارت جستجو یا فیلتر را تغییر دهید.' : emptyDescription, query || status ? 'search' : iconName)); const tr = element('tr'); tr.append(td); tbody.append(tr); }
    scroll.replaceChildren(table);
    count.textContent = filtered.length ? `${number(page * pageSize + 1)} تا ${number(Math.min((page + 1) * pageSize, filtered.length))} از ${number(filtered.length)} مورد` : '۰ مورد';
    pageLabel.textContent = number(page + 1); prev.disabled = page === 0; next.disabled = (page + 1) * pageSize >= filtered.length;
  }
  render(); return panel;
}
function skeleton() {
  const root = element('div', null, 'loading-state'); root.setAttribute('role', 'status'); root.setAttribute('aria-label', 'در حال دریافت اطلاعات');
  root.append(element('span', 'در حال دریافت اطلاعات…', 'sr-only'));
  const grid = element('div', null, 'metrics-grid'); for (let i = 0; i < 4; i++) grid.append(element('div', null, 'skeleton skeleton-card'));
  root.append(grid, element('div', null, 'skeleton skeleton-table')); return root;
}
