(() => {
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text instanceof Node) node.append(text); else if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const pending = (title, description, phase) => {
    const card = element('section', null, 'card future-state');
    card.append(element('span', 'فاز ' + phase, 'status-tag'), element('h2', title), element('p', description),
      element('p', 'مسیر این بخش آماده است؛ قابلیت‌های آن در فاز مشخص‌شده تکمیل می‌شوند. داده یا عملیات ساختگی نمایش داده نمی‌شود.'));
    return card;
  };
  const date = value => value ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'medium', timeZone: 'Asia/Tehran',
  }).format(new Date(value)) : '—';
  function table(rows, columns) {
    const wrap = element('section', null, 'card table-wrap');
    if (!rows.length) { wrap.append(element('h2', 'هنوز موردی ثبت نشده'), element('p', 'پس از ثبت اطلاعات، فهرست در همین بخش نمایش داده می‌شود.')); return wrap; }
    const table = element('table'), head = element('thead'), header = element('tr'), body = element('tbody');
    for (const [label] of columns) header.append(element('th', label));
    head.append(header);
    for (const row of rows) { const tr = element('tr'); for (const [, value] of columns) tr.append(element('td', value(row) ?? '—')); body.append(tr); }
    table.append(head, body); wrap.append(table); return wrap;
  }
  globalThis.WorkspaceUI = { element, pending, date, table };
})();
