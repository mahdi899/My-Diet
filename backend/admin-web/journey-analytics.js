/* Phase 10 journey analytics. Graphs come from fixture transitions, not an inferred model. */
(() => {
const screenLabels = {
  home: 'خانه',
  plan_purchase: 'خرید برنامه',
  questionnaire: 'پرسش‌نامه',
  plan_day: 'برنامه روز',
  feedback: 'بازخورد',
  login: 'ورود',
};
const places = {
  home: [90, 70],
  plan_purchase: [270, 70],
  questionnaire: [450, 70],
  plan_day: [180, 190],
  feedback: [360, 190],
  login: [90, 190],
};
function session(id, date, platform, appVersion, sessionType, firstAuthenticated, events) {
  return { id, date, platform, appVersion, sessionType, firstAuthenticated, events };
}
function viewed(screenId, activeMs) {
  return { type: 'screen_viewed', screenId, activeMs };
}
function moved(fromScreenId, toScreenId) {
  return { type: 'navigation', fromScreenId, toScreenId };
}
const sessions = [
  session('a', '2026-10-24', 'android', '1.0.0', 'first_visit', false, [viewed('home', 8000), moved('home', 'plan_purchase'), viewed('plan_purchase', 20000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 40000)]),
  session('b', '2026-10-24', 'android', '1.0.0', 'first_visit', false, [viewed('home', 6000), moved('home', 'plan_purchase'), viewed('plan_purchase', 15000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 30000)]),
  session('c', '2026-10-25', 'android', '1.0.0', 'first_visit', false, [viewed('home', 5000), moved('home', 'plan_purchase'), viewed('plan_purchase', 9000)]),
  session('d', '2026-10-26', 'ios', '1.1.0', 'first_visit', false, [viewed('home', 4000), moved('home', 'questionnaire'), viewed('questionnaire', 12000)]),
  session('e', '2026-10-28', 'android', '1.0.0', 'returning', true, [viewed('home', 7000), moved('home', 'plan_day'), viewed('plan_day', 25000), moved('plan_day', 'feedback'), viewed('feedback', 11000)]),
  session('f', '2026-10-29', 'android', '1.0.0', 'returning', false, [viewed('home', 3000), moved('home', 'plan_day'), viewed('plan_day', 18000)]),
];

function percent(count, total) {
  return total ? Math.round((100 * count) / total) : null;
}
function journeyReport(source, { from, to, platform = 'all', appVersion = 'all', sessionType } = {}) {
  if (!from || !to || from > to || (sessionType !== 'first_visit' && sessionType !== 'returning')) return { status: 'invalid' };
  const rows = source.filter(item => item.date >= from && item.date <= to && (platform === 'all' || item.platform === platform) && (appVersion === 'all' || item.appVersion === appVersion) && item.sessionType === sessionType);
  if (!rows.length) return { status: 'empty', nodes: [], edges: [], journeys: [], entries: [], exits: [], active: [] };
  const visits = new Map();
  const active = new Map();
  const exits = new Map();
  const entries = new Map();
  const edges = new Map();
  const paths = new Map();
  for (const item of rows) {
    const screens = item.events.filter(event => event.type === 'screen_viewed');
    const path = screens.map(event => event.screenId).join(' → ');
    paths.set(path, (paths.get(path) || 0) + 1);
    if (screens[0]) entries.set(screens[0].screenId, (entries.get(screens[0].screenId) || 0) + 1);
    if (screens.at(-1)) exits.set(screens.at(-1).screenId, (exits.get(screens.at(-1).screenId) || 0) + 1);
    for (const event of screens) {
      visits.set(event.screenId, (visits.get(event.screenId) || 0) + 1);
      active.set(event.screenId, (active.get(event.screenId) || 0) + (event.activeMs || 0));
    }
    for (const event of item.events) {
      if (event.type !== 'navigation') continue;
      const key = event.fromScreenId + '\t' + event.toScreenId;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const outgoing = new Map();
  for (const [key, count] of edges) outgoing.set(key.split('\t')[0], (outgoing.get(key.split('\t')[0]) || 0) + count);
  const edgeRows = [...edges].map(([key, count]) => {
    const [fromScreenId, toScreenId] = key.split('\t');
    return { fromScreenId, toScreenId, count, percent: percent(count, outgoing.get(fromScreenId)) };
  }).sort((a, b) => b.count - a.count || a.fromScreenId.localeCompare(b.fromScreenId));
  const ranked = map => [...map].map(([screenId, count]) => ({ screenId, count, percent: percent(count, rows.length) })).sort((a, b) => b.count - a.count);
  return {
    status: 'ready',
    sessions: rows.length,
    nodes: [...visits].map(([screenId, count]) => ({ screenId, count })).sort((a, b) => b.count - a.count),
    edges: edgeRows,
    journeys: [...paths].map(([path, count]) => ({ path, count, percent: percent(count, rows.length) })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
    entries: ranked(entries),
    exits: ranked(exits),
    dropOff: [...exits].map(([screenId, count]) => ({ screenId, count, visits: visits.get(screenId) || 0, percent: percent(count, visits.get(screenId) || 0) })).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)),
    active: [...active].map(([screenId, milliseconds]) => ({ screenId, milliseconds })).sort((a, b) => b.milliseconds - a.milliseconds),
  };
}

const fa = value => new Intl.NumberFormat('fa-IR').format(value);
function label(screenId) {
  return screenLabels[screenId] || screenId;
}
function graph(report) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 560 260');
  svg.setAttribute('class', 'journey-graph');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'گراف گذار بین صفحه‌ها');
  if (!report.edges.length) {
    const note = document.createElementNS(svg.namespaceURI, 'text');
    note.setAttribute('x', '20'); note.setAttribute('y', '40'); note.textContent = 'گذاری برای رسم گراف ثبت نشده است.';
    svg.append(note);
    return svg;
  }
  for (const edge of report.edges) {
    const [x1, y1] = places[edge.fromScreenId] || [40, 40];
    const [x2, y2] = places[edge.toScreenId] || [200, 200];
    const line = document.createElementNS(svg.namespaceURI, 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#1f6b4a'); line.setAttribute('stroke-width', '2');
    svg.append(line);
    const caption = document.createElementNS(svg.namespaceURI, 'text');
    caption.setAttribute('x', (x1 + x2) / 2); caption.setAttribute('y', (y1 + y2) / 2 - 6);
    caption.textContent = fa(edge.count) + ' · ' + fa(edge.percent) + '٪';
    svg.append(caption);
  }
  for (const node of report.nodes) {
    const [x, y] = places[node.screenId] || [40, 40];
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', '28'); circle.setAttribute('fill', '#e7f2ea'); circle.setAttribute('stroke', '#1f6b4a');
    const name = document.createElementNS(svg.namespaceURI, 'text');
    name.setAttribute('x', x); name.setAttribute('y', y - 4); name.setAttribute('text-anchor', 'middle'); name.textContent = label(node.screenId);
    const count = document.createElementNS(svg.namespaceURI, 'text');
    count.setAttribute('x', x); count.setAttribute('y', y + 14); count.setAttribute('text-anchor', 'middle'); count.textContent = fa(node.count);
    svg.append(circle, name, count);
  }
  return svg;
}
function list(title, rows, render) {
  const card = element('section', null, 'card');
  card.append(element('h3', title));
  if (!rows.length) card.append(element('p', 'موردی در این نما نیست.'));
  else for (const row of rows) card.append(element('p', render(row)));
  return card;
}
function journeyPage() {
  const root = element('div', null, 'report-stack');
  const from = element('input'), to = element('input'), platform = element('select'), version = element('select');
  let sessionType = 'first_visit';
  from.type = 'date'; to.type = 'date'; from.value = '2026-10-01'; to.value = '2026-10-31';
  from.setAttribute('aria-label', 'شروع بازه'); to.setAttribute('aria-label', 'پایان بازه');
  platform.setAttribute('aria-label', 'سکوی برنامه'); version.setAttribute('aria-label', 'نسخهٔ برنامه');
  for (const [value, text] of [['all', 'همهٔ سکوها'], ['android', 'اندروید'], ['ios', 'iOS'], ['web', 'وب']]) platform.append(Object.assign(element('option', text), { value }));
  for (const value of ['all', '1.0.0', '1.1.0']) version.append(Object.assign(element('option', value === 'all' ? 'همهٔ نسخه‌ها' : value), { value }));
  function draw(busy) {
    root.replaceChildren();
    root.append(element('h2', 'مسیر کاربران'));
    root.append(element('p', 'فاز ۱۰ · اعداد نمونه هستند. ورود اول با اولین ورود بعد از ساخت حساب یکی نیست. وصل کردن نشست ناشناس به حساب کار سرور است. زمان‌ها فقط پیش‌زمینهٔ فعال را می‌شمارند و گراف فقط از گذارهای ثبت‌شده رسم می‌شود.', 'workspace-note'));
    const filters = element('div', null, 'report-filters');
    const first = button('ورود اول', () => { sessionType = 'first_visit'; draw(false); });
    const returning = button('بازدیدهای بعدی', () => { sessionType = 'returning'; draw(false); });
    first.setAttribute('aria-pressed', String(sessionType === 'first_visit'));
    returning.setAttribute('aria-pressed', String(sessionType === 'returning'));
    filters.append(from, to, platform, version, first, returning, button('به‌روزرسانی گزارش', () => { draw(true); setTimeout(() => draw(false), 0); }));
    root.append(filters);
    if (busy) { root.setAttribute('aria-busy', 'true'); root.append(element('p', 'در حال چیدن مسیرهای نمونه')); return; }
    root.removeAttribute('aria-busy');
    const report = journeyReport(sessions, { from: from.value, to: to.value, platform: platform.value, appVersion: version.value, sessionType });
    const figure = element('section', null, 'card');
    figure.append(element('h3', sessionType === 'first_visit' ? 'گراف ورود اول' : 'گراف بازدیدهای بعدی'));
    if (report.status === 'invalid') figure.append(element('p', 'بازه یا نوع نشست را بررسی کن.'));
    else if (report.status === 'empty') figure.append(element('p', 'در این صافی مسیری نیست. این حالت به معنی صفر بودن گذارها نیست.'));
    else {
      figure.append(element('p', fa(report.sessions) + ' نشست در این نما.'));
      figure.append(graph(report));
      const table = element('table');
      const head = element('tr');
      for (const name of ['از', 'به', 'تعداد', 'درصد خروج از مبدأ']) head.append(element('th', name));
      table.append(head);
      for (const edge of report.edges) {
        const row = element('tr');
        for (const cell of [label(edge.fromScreenId), label(edge.toScreenId), fa(edge.count), fa(edge.percent) + '٪']) row.append(element('td', cell));
        table.append(row);
      }
      if (!report.edges.length) table.append(element('tr', null), element('td', 'جدول گذار خالی است چون رویداد ناوبری ثبت نشده.'));
      figure.append(element('h3', 'جدول گذارها'), table);
    }
    root.append(figure);
    if (report.status !== 'ready') return;
    root.append(list('مسیرهای پرتکرار', report.journeys, row => row.path + ' · ' + fa(row.count) + ' (' + fa(row.percent) + '٪)'));
    root.append(list('صفحه‌های ورود', report.entries, row => label(row.screenId) + ' · ' + fa(row.count)));
    root.append(list('صفحه‌های خروج', report.exits, row => label(row.screenId) + ' · ' + fa(row.count)));
    root.append(list('نقاط رها کردن', report.dropOff, row => label(row.screenId) + ' · ' + fa(row.count) + ' خروج از ' + fa(row.visits) + ' بازدید (' + fa(row.percent) + '٪)'));
    root.append(list('زمان فعال', report.active, row => label(row.screenId) + ' · ' + fa(Math.round(row.milliseconds / 1000)) + ' ثانیه'));
  }
  draw(false);
  return root;
}

globalThis.SabzineJourneys = { sessions, journeyReport, journeyPage, screenLabels };
})();
