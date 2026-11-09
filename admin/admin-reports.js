/* Phase 9 admin reports and configuration. Fixture numbers are not live analytics. */
const windows = [
  { key: 'week1', days: 7, label: 'هفتهٔ اول' },
  { key: 'week2', days: 14, label: 'هفتهٔ دوم' },
  { key: 'week4', days: 28, label: 'هفتهٔ چهارم' },
];
const retentionEvents = {
  activity: 'بازگشت به برنامه، بدون الزام ثبت وعده یا خرید',
  tracking: 'ثبت حداقل یک وعده در همان پنجره',
  purchase: 'خرید دوبارهٔ برنامه در همان پنجره',
};
const cohorts = [
  { id: 'sep', label: 'گروه ۱۲ شهریور', startedOn: '2026-09-03', size: 40, counts: { activity: { week1: 28, week2: 18, week4: 11 }, tracking: { week1: 22, week2: 14, week4: 8 }, purchase: { week1: 6, week2: 4, week4: 3 } } },
  { id: 'oct', label: 'گروه ۲۸ مهر', startedOn: '2026-10-20', size: 12, counts: { activity: { week1: 9, week2: 0, week4: 0 }, tracking: { week1: 7, week2: 0, week4: 0 }, purchase: { week1: 1, week2: 0, week4: 0 } } },
  { id: 'new', label: 'گروه ۶ آبان', startedOn: '2026-10-28', size: 5, counts: { activity: { week1: 0, week2: 0, week4: 0 }, tracking: { week1: 0, week2: 0, week4: 0 }, purchase: { week1: 0, week2: 0, week4: 0 } } },
  { id: 'quiet', label: 'گروه بدون بازگشت', startedOn: '2026-08-01', size: 10, counts: { activity: { week1: 0, week2: 0, week4: 0 }, tracking: { week1: 0, week2: 0, week4: 0 }, purchase: { week1: 0, week2: 0, week4: 0 } } },
];
const foodEvents = [
  ['2026-10-04', 'rice', 'مرغ و برنج', 'selected'],
  ['2026-10-06', 'rice', 'مرغ و برنج', 'selected'],
  ['2026-10-08', 'lentil', 'عدسی', 'selected'],
  ['2026-10-11', 'lentil', 'عدسی', 'alternative'],
  ['2026-10-12', 'yogurt', 'ماست و خیار', 'alternative'],
  ['2026-10-18', 'soup', 'سوپ جو', 'disliked'],
  ['2026-10-19', 'soup', 'سوپ جو', 'disliked'],
  ['2026-10-21', 'time', 'زمان آماده‌سازی', 'reason'],
  ['2026-10-22', 'cost', 'هزینهٔ مواد', 'reason'],
  ['2026-10-22', 'time', 'زمان آماده‌سازی', 'reason'],
].map(([date, foodId, label, kind]) => ({ date, foodId, label, kind }));
const feedbackFixture = { eligible: 40, submitted: 17, continued: 12 };
const specialists = [
  { id: 's-a', name: 'متخصص نمونهٔ الف', ratings: [5, 4, 5, 4, 3], messageResponseMinutes: [20, 40, 15], reviewMinutes: [180, 240], pendingMessages: 2, pendingChanges: 1 },
  { id: 's-b', name: 'متخصص نمونهٔ ب', ratings: [5], messageResponseMinutes: [12], reviewMinutes: [90], pendingMessages: 0, pendingChanges: 4 },
  { id: 's-c', name: 'متخصص بدون امتیاز', ratings: [], messageResponseMinutes: [], reviewMinutes: [60], pendingMessages: 1, pendingChanges: 0 },
];

function ageDays(start, asOf) {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = asOf.split('-').map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000);
}
function percent(count, denominator) {
  return Math.round((100 * count) / denominator);
}
function retentionReport(source, { from, to, event = 'activity' } = {}) {
  if (!from || !to || from > to) return { status: 'invalid', rows: [] };
  if (!retentionEvents[event]) throw new Error('رویداد بازگشت نامعتبر است.');
  const rows = source.filter(cohort => cohort.startedOn >= from && cohort.startedOn <= to).map(cohort => ({
    id: cohort.id,
    label: cohort.label,
    size: cohort.size,
    ageDays: ageDays(cohort.startedOn, to),
    cells: Object.fromEntries(windows.map(window => {
      if (ageDays(cohort.startedOn, to) < window.days) return [window.key, { state: 'not_yet_measurable' }];
      if (!cohort.size) return [window.key, { state: 'no_denominator' }];
      const count = cohort.counts[event][window.key];
      return [window.key, { state: 'measured', count, denominator: cohort.size, percent: percent(count, cohort.size) }];
    })),
  }));
  return { status: rows.length ? 'ready' : 'empty', from, to, event, definition: retentionEvents[event], rows };
}
function rankFoods(events, { from, to, kind }) {
  if (!from || !to || from > to) return { status: 'invalid', rows: [] };
  const counts = new Map();
  for (const event of events) {
    if (event.kind !== kind || event.date < from || event.date > to) continue;
    const current = counts.get(event.foodId) || { id: event.foodId, label: event.label, count: 0 };
    current.count += 1;
    counts.set(event.foodId, current);
  }
  const rows = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa'));
  return { status: rows.length ? 'ready' : 'empty', rows };
}
function feedbackSummary(stats) {
  if (!stats || !stats.eligible) return { status: 'empty' };
  return {
    status: 'ready',
    participation: { count: stats.submitted, denominator: stats.eligible, percent: percent(stats.submitted, stats.eligible) },
    continuation: { count: stats.continued, denominator: stats.eligible, percent: percent(stats.continued, stats.eligible) },
  };
}
function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function summarizeSpecialist(person) {
  const count = person.ratings.length;
  return {
    id: person.id,
    name: person.name,
    ratingCount: count,
    ratingAverage: count ? average(person.ratings) : null,
    smallSample: count > 0 && count < 5,
    distribution: [1, 2, 3, 4, 5].map(star => ({ star, count: person.ratings.filter(value => value === star).length })),
    messageResponse: average(person.messageResponseMinutes),
    messageSamples: person.messageResponseMinutes.length,
    reviewTime: average(person.reviewMinutes),
    reviewSamples: person.reviewMinutes.length,
    pendingMessages: person.pendingMessages,
    pendingChanges: person.pendingChanges,
    pending: person.pendingMessages + person.pendingChanges,
  };
}
function leaderboard(people, sort = 'rating') {
  const rows = people.map(summarizeSpecialist);
  const read = { rating: row => row.ratingAverage, response: row => row.messageResponse, workload: row => row.pending }[sort];
  if (!read) throw new Error('ترتیب رتبه‌بندی نامعتبر است.');
  const direction = sort === 'response' ? 1 : -1;
  rows.sort((a, b) => {
    const left = read(a), right = read(b);
    if (left == null && right == null) return a.name.localeCompare(b.name, 'fa');
    if (left == null) return 1;
    if (right == null) return -1;
    return left === right ? a.name.localeCompare(b.name, 'fa') : (left - right) * direction;
  });
  return rows;
}
function addReason(rows, label, id) {
  const next = String(label || '').trim();
  if (!next || rows.some(row => row.label === next)) throw new Error('دلیل خالی یا تکراری مجاز نیست.');
  const row = { id: id || 'reason-' + rows.length, label: next, active: true, historicalLabels: [] };
  rows.push(row);
  return row;
}
function updateReason(rows, id, patch) {
  const row = rows.find(item => item.id === id);
  if (!row) throw new Error('دلیل پیدا نشد.');
  if (!Array.isArray(row.historicalLabels)) row.historicalLabels = [];
  if (patch.label != null) {
    const next = String(patch.label).trim();
    if (!next) throw new Error('برچسب خالی مجاز نیست.');
    if (rows.some(item => item.id !== id && item.label === next)) throw new Error('برچسب تکراری مجاز نیست.');
    if (next !== row.label) {
      row.historicalLabels.push(row.label);
      row.label = next;
    }
  }
  if (patch.active != null) row.active = Boolean(patch.active);
  return row;
}
function createQuestionnaire() {
  let version = 1;
  const questions = [
    { id: 'q-goal', prompt: 'هدفت از برنامه چیست؟', required: true, active: true, historicalPrompts: [] },
    { id: 'q-allergy', prompt: 'حساسیت غذایی داری؟', required: true, active: true, historicalPrompts: [] },
  ];
  const submissions = { 'q-goal': 'هدفت از برنامه چیست؟' };
  return {
    version: () => version,
    list: () => questions.map(question => structuredClone(question)),
    add(prompt, required) {
      const text = String(prompt || '').trim();
      if (!text) throw new Error('متن سؤال خالی است.');
      questions.push({ id: 'q-' + (questions.length + 1), prompt: text, required: Boolean(required), active: true, historicalPrompts: [] });
    },
    rename(id, prompt) {
      const question = questions.find(item => item.id === id);
      if (!question) throw new Error('سؤال پیدا نشد.');
      const text = String(prompt || '').trim();
      if (!text) throw new Error('متن سؤال خالی است.');
      if (text !== question.prompt) {
        question.historicalPrompts.push(question.prompt);
        question.prompt = text;
      }
    },
    setActive(id, active) {
      const question = questions.find(item => item.id === id);
      if (!question) throw new Error('سؤال پیدا نشد.');
      question.active = Boolean(active);
    },
    setRequired(id, required) {
      const question = questions.find(item => item.id === id);
      if (!question) throw new Error('سؤال پیدا نشد.');
      question.required = Boolean(required);
    },
    move(id, direction) {
      const index = questions.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= questions.length) return;
      [questions[index], questions[target]] = [questions[target], questions[index]];
    },
    publish() { version += 1; return version; },
    submittedPrompt: id => submissions[id] || null,
  };
}

const fa = value => new Intl.NumberFormat('fa-IR').format(value);
function cellText(cell) {
  if (cell.state === 'not_yet_measurable') return 'هنوز قابل سنجش نیست';
  if (cell.state === 'no_denominator') return 'مخرج گروه مشخص نیست';
  return fa(cell.count) + ' از ' + fa(cell.denominator) + ' (' + fa(cell.percent) + '٪)';
}
function minutesText(value, samples, empty) {
  if (value == null || !samples) return empty;
  return fa(Math.round(value)) + ' دقیقه · ' + fa(samples) + ' نمونه';
}
function bar(label, ratio) {
  const row = element('div', null, 'report-bar');
  row.append(element('span', label), element('div', null, 'report-track'));
  const fill = element('div', null, 'report-fill');
  fill.style.width = Math.max(0, Math.min(100, ratio)) + '%';
  row.lastChild.append(fill);
  return row;
}
function userReports() {
  const root = element('div', null, 'report-stack');
  const from = element('input'), to = element('input'), event = element('select');
  from.type = 'date'; to.type = 'date'; from.value = '2026-08-01'; to.value = '2026-10-30';
  from.setAttribute('aria-label', 'شروع بازه'); to.setAttribute('aria-label', 'پایان بازه'); event.setAttribute('aria-label', 'رویداد بازگشت');
  for (const [value, label] of Object.entries(retentionEvents)) event.append(Object.assign(element('option', label), { value }));
  function draw(busy) {
    root.replaceChildren();
    root.append(element('h2', 'گزارش کاربران'));
    root.append(element('p', 'فاز ۹ · این اعداد نمونهٔ طراحی هستند و گزارش زندهٔ سرور نیستند. بازگشت به برنامه، ثبت وعده و خرید دوباره سه رویداد جدا هستند.', 'workspace-note'));
    const filters = element('div', null, 'report-filters');
    filters.append(from, to, event, button('به‌روزرسانی گزارش', () => { draw(true); setTimeout(() => draw(false), 0); }));
    root.append(filters);
    if (busy) { root.setAttribute('aria-busy', 'true'); root.append(element('p', 'در حال آماده‌سازی گزارش نمونه')); return; }
    root.removeAttribute('aria-busy');
    const report = retentionReport(cohorts, { from: from.value, to: to.value, event: event.value });
    const card = element('section', null, 'card');
    card.append(element('h3', 'ماندگاری گروه‌ها'), element('p', 'بازه: ' + from.value + ' تا ' + to.value + '. تعریف: ' + retentionEvents[event.value] + '. مخرج، تعداد کاربران همان گروه در شروع است.'));
    if (report.status === 'invalid') card.append(element('p', 'بازهٔ تاریخ را بررسی کن.'));
    else if (report.status === 'empty') card.append(element('p', 'در این بازه گروهی برای سنجش نیست. این حالت به معنی ماندگاری صفر نیست.'));
    else for (const row of report.rows) {
      const block = element('div', null, 'report-block');
      block.append(element('strong', row.label + ' · ' + fa(row.size) + ' نفر'));
      for (const window of windows) {
        const cell = row.cells[window.key];
        block.append(element('p', window.label + ': ' + cellText(cell)));
        if (cell.state === 'measured') block.append(bar(window.label, cell.percent));
      }
      card.append(block);
    }
    root.append(card);
    const foods = element('section', null, 'card');
    foods.append(element('h3', 'غذاها، جایگزین‌ها و دلایل'));
    const titles = [['selected', 'بیشترین انتخاب'], ['alternative', 'بیشترین جایگزین'], ['disliked', 'بیشترین غذای نامطلوب'], ['reason', 'دلایل رایج جایگزینی']];
    for (const [kind, title] of titles) {
      const ranked = rankFoods(foodEvents, { from: from.value, to: to.value, kind });
      foods.append(element('h4', title));
      if (ranked.status !== 'ready') foods.append(element('p', 'در این بازه موردی ثبت نشده است.'));
      else for (const item of ranked.rows) foods.append(bar(item.label + ' · ' + fa(item.count), item.count / ranked.rows[0].count * 100));
    }
    const feedback = feedbackSummary(feedbackFixture);
    foods.append(element('h4', 'بازخورد و ادامهٔ برنامه'));
    foods.append(element('p', 'شرکت در بازخورد، ارسال نظر برای برنامهٔ همان بازه است. ادامهٔ برنامه خرید یا تمدید است و از روی شرکت در بازخورد حدس زده نمی‌شود.'));
    if (feedback.status !== 'ready') foods.append(element('p', 'مخرج این بخش مشخص نیست.'));
    else foods.append(element('p', 'شرکت در بازخورد: ' + cellText({ state: 'measured', ...feedback.participation })), element('p', 'ادامهٔ برنامه: ' + cellText({ state: 'measured', ...feedback.continuation })));
    root.append(foods);
  }
  draw(false);
  return root;
}
function specialistReports() {
  const root = element('div', null, 'report-stack');
  const sort = element('select');
  sort.setAttribute('aria-label', 'ترتیب رتبه‌بندی');
  for (const [value, label] of [['rating', 'بیشترین امتیاز'], ['response', 'سریع‌ترین پاسخ پیام'], ['workload', 'بیشترین کار باز']]) sort.append(Object.assign(element('option', label), { value }));
  function draw() {
    root.replaceChildren();
    root.append(element('h2', 'گزارش متخصصان'));
    root.append(element('p', 'فاز ۹ · نمونهٔ طراحی برای بازهٔ ۱ تا ۳۰ مهر ۱۴۰۵. زمان پاسخ پیام، فاصله تا اولین پاسخ متخصص است. زمان بررسی تغییر برنامه، فاصله تا تصمیم متخصص است و با هم جمع نمی‌شوند.', 'workspace-note'));
    sort.onchange = draw;
    root.append(sort);
    const rows = leaderboard(specialists, sort.value);
    if (rows.length === 1) root.append(element('p', 'با یک متخصص هم رتبه‌بندی معنی دارد؛ مقایسهٔ نسبی تا آمدن نفر دوم نشان داده نمی‌شود.'));
    for (const row of rows) {
      const card = element('section', null, 'card');
      const rating = row.ratingAverage == null ? 'بدون امتیاز' : fa(Math.round(row.ratingAverage * 10) / 10) + ' از ۵ · ' + fa(row.ratingCount) + ' نظر';
      card.append(element('h3', row.name), element('p', rating));
      if (row.smallSample) card.append(element('p', 'کمتر از ۵ امتیاز؛ میانگین را با احتیاط بخوان.'));
      for (const bucket of row.distribution) card.append(bar(fa(bucket.star) + ' ستاره · ' + fa(bucket.count), row.ratingCount ? bucket.count / row.ratingCount * 100 : 0));
      card.append(element('p', 'پاسخ پیام: ' + minutesText(row.messageResponse, row.messageSamples, 'نمونه‌ای برای پاسخ پیام در این بازه نیست')));
      card.append(element('p', 'بررسی تغییر برنامه: ' + minutesText(row.reviewTime, row.reviewSamples, 'نمونه‌ای برای تصمیم تغییر برنامه در این بازه نیست')));
      card.append(element('p', 'کار باز: ' + fa(row.pendingMessages) + ' پیام و ' + fa(row.pendingChanges) + ' درخواست تغییر. کار باز داخل میانگین زمان‌ها حساب نمی‌شود.'));
      root.append(card);
    }
  }
  draw();
  return root;
}
let questionnaireStore;
function questionnairePage() {
  questionnaireStore ??= createQuestionnaire();
  const root = element('div', null, 'report-stack');
  function draw() {
    const store = questionnaireStore;
    root.replaceChildren();
    root.append(element('h2', 'پیکربندی پرسش‌نامه'));
    root.append(element('p', 'فاز ۹ · نسخهٔ ' + fa(store.version()) + ' فقط در همین مرورگر است. شناسهٔ سؤال و برچسب پاسخ‌های قبلی با ویرایش عوض نمی‌شود. تعرفه در بخش تعرفه و پاداش، پاداش در کمپین روزهای پیاپی، و بررسی نظرها در بخش نظرات است.', 'workspace-note'));
    const links = element('p');
    links.append(Object.assign(element('a', 'تعرفه و پاداش'), { href: '#settings' }), element('span', ' · '), Object.assign(element('a', 'کمپین روزهای پیاپی'), { href: '#streaks' }), element('span', ' · '), Object.assign(element('a', 'نظرات'), { href: '#reviews' }));
    root.append(links);
    for (const question of store.list()) {
      const card = element('section', null, 'card');
      const input = element('input');
      input.value = question.prompt;
      input.setAttribute('aria-label', 'متن ' + question.id);
      card.append(element('p', 'شناسه: ' + question.id), input);
      if (question.historicalPrompts.length) card.append(element('p', 'برچسب‌های قبلی: ' + question.historicalPrompts.join('، ')));
      const saved = store.submittedPrompt(question.id);
      if (saved) card.append(element('p', 'پاسخ‌های ثبت‌شده هنوز با «' + saved + '» خوانده می‌شوند.'));
      const required = element('input'), active = element('input');
      required.type = 'checkbox'; active.type = 'checkbox'; required.checked = question.required; active.checked = question.active;
      required.setAttribute('aria-label', 'الزامی ' + question.id); active.setAttribute('aria-label', 'فعال ' + question.id);
      card.append(element('label', 'الزامی'), required, element('label', 'فعال برای نسخهٔ بعد'), active);
      card.append(button('ثبت متن', () => { store.rename(question.id, input.value); store.setRequired(question.id, required.checked); store.setActive(question.id, active.checked); draw(); }), button('بالاتر', () => { store.move(question.id, -1); draw(); }));
      root.append(card);
    }
    const add = element('input');
    add.setAttribute('aria-label', 'سؤال جدید'); add.placeholder = 'سؤال جدید';
    root.append(add, button('افزودن سؤال', () => { store.add(add.value, false); draw(); }), button('انتشار نسخهٔ نمونه', () => { store.publish(); notice('نسخهٔ پرسش‌نامه فقط در نمونه ذخیره شد.'); draw(); }));
  }
  draw();
  return root;
}
var SabzineReports = {
  windows, retentionEvents, cohorts, foodEvents, feedbackFixture, specialists,
  retentionReport, rankFoods, feedbackSummary, leaderboard, summarizeSpecialist,
  addReason, updateReason, createQuestionnaire, userReports, specialistReports, questionnairePage,
};
