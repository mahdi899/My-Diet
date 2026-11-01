/* Phase 2 read-only quality inspector. Missing API fields stay missing. */
(() => {
  const node = (tag, text) => { const el = document.createElement(tag); if (text != null) el.textContent = text; return el; };
  function issues(meal) {
    const result = [];
    if (!meal.title?.trim()) result.push('نام غذا ثبت نشده');
    if (!Number.isFinite(meal.calories) || meal.calories <= 0) result.push('کالری سهم ثبت نشده');
    if (!Number.isFinite(meal.preparationMinutes) || meal.preparationMinutes < 0) result.push('زمان آماده‌سازی ثبت نشده');
    if (!meal.instructions?.trim()) result.push('روش آماده‌سازی ثبت نشده');
    if (!meal.quantityBasis?.trim()) result.push('مبنای وزن خام یا پخته ثبت نشده');
    if (!Array.isArray(meal.items) || !meal.items.length || meal.items.some(i => !i.name || !(i.quantity > 0) || !i.unit)) result.push('مواد اولیه یا مقدار ناقص است');
    return result;
  }
  function check(meal) {
    const result = issues(meal), options = Array.isArray(meal.alternatives) ? meal.alternatives : [];
    if(options.length!==2 || options.some(a=>!['ai','specialist'].includes(a.source)))result.push('دقیقاً دو جایگزین با منبع مشخص لازم است');
    for (const [source, label] of [['ai', 'هوش مصنوعی'], ['specialist', 'متخصص']]) {
      const matching = options.filter(a => a.source === source);
      if (matching.length !== 1) result.push(`یک جایگزین ${label} لازم است`);
      for (const a of matching) {
        if (!a.approved || !a.reviewedBy || !a.reviewedAt || !Number.isFinite(Date.parse(a.reviewedAt))) result.push(`جایگزین ${label} تأیید متخصص ندارد`);
        for (const issue of issues(a.meal || {})) result.push(`جایگزین ${label}: ${issue}`);
      }
    }
    if (new Set(options.map(a => a.id)).size !== options.length || options.some(a => !a.id)) result.push('شناسه جایگزین نامعتبر است');
    return result;
  }
  function render(request) {
    const view = node('section'); view.className = 'card';
    view.append(node('h2', 'کامل‌بودن غذاها و جایگزین‌ها پیش از انتشار'));
    view.append(node('p', 'این بخش وضعیت داده دریافتی را بررسی می‌کند. جزئیات یا تأیید ثبت‌نشده به‌صورت خودکار ساخته نمی‌شود. برای ویرایش، از دکمهٔ پرونده و برنامه استفاده کن.'));
    if (!request.version?.days?.length) { view.append(node('p', 'پیش‌نویس برنامه هنوز موجود نیست.')); return view; }
    const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    let count = 0;
    if (request.version.days.length !== 7) { view.append(node('p', 'هفت روز برنامه کامل نیست.')); count++; }
    request.version.days.forEach((day, index) => {
      const group = node('details'), heading = node('summary', days[index] || 'روز خارج از هفته');
      group.append(heading);
      if (!day.meals?.length) { group.append(node('p', 'وعده‌ای ثبت نشده')); count++; }
      for (const meal of day.meals || []) {
        const card = node('section'); card.className = 'card';
        card.append(node('h3', meal.title || 'بدون نام'));
        for (const item of meal.items || []) card.append(node('p', `${item.name || 'بدون نام'}: ${item.quantity ?? 'ثبت نشده'} ${item.unit ?? ''}`));
        const problems = check(meal); count += problems.length;
        const list = node('ul');
        for (const problem of problems) list.append(node('li', problem));
        card.append(node('p', problems.length ? 'نیازمند تکمیل پیش از انتشار' : 'جزئیات و هر دو تأیید کامل است'), list);
        group.append(card);
      }
      view.append(group);
    });
    const state = node('p', count ? 'برنامه برای انتشار آماده نیست؛ موارد بالا باید تکمیل شوند.' : 'اطلاعات فاز دو کامل است؛ انتشار همچنان تابع بررسی بالینی و پاسخ‌های لازم کاربر است.');
    state.setAttribute('role', 'status'); view.prepend(state);
    return view;
  }
  window.SabzineMealQuality = { check, render };
})();
