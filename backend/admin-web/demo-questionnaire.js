async function demoQuestionnairePage() {
  const response = await fetch('/v1/public/demo-questionnaire', {cache:'no-store'});
  if (!response.ok) throw new Error('دریافت تنظیمات پرسش‌نامه ممکن نشد.');
  const saved = await response.json();
  const goals = window.SABZINE_QUESTIONNAIRE.goals;
  const root = element('section', null, 'card');
  const form = element('form', null, 'report-stack');
  const select = field(root, 'goal', 'هدف رژیم', 'select');
  for (const goal of goals) select.append(Object.assign(element('option', saved[goal.id]?.title ?? goal.title), {value:goal.id}));
  const title = field(form, 'title', 'عنوان هدف');
  title.maxLength = 120;
  const list = element('div', null, 'report-stack');
  const drafts = new Map();
  let current;
  function render() {
    list.replaceChildren();
    current.questions.forEach((question, index) => {
      const row = element('fieldset');
      row.append(element('legend', 'سؤال ' + number(index + 1)));
      const input = field(row, 'question', 'متن سؤال', 'textarea', question.q);
      input.maxLength = 500;
      input.oninput = () => question.q = input.value;
      if (question.id > 100) {
        const options = field(row, 'options', 'گزینه‌ها (هر گزینه یک خط؛ برای پاسخ متنی خالی بگذارید)', 'textarea', question.options?.join('\n') ?? '');
        options.required = false;
        options.oninput = () => {
          question.options = options.value.split('\n').map(value => value.trim()).filter(Boolean);
          question.type = question.options.length ? 'choice' : 'text';
        };
      }
      const actions = element('div', null, 'form-submit');
      for (const [offset, label] of [[-1, 'بالاتر'], [1, 'پایین‌تر']]) {
        const move = button(label, () => {
          const questions = current.questions;
          [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]];
          render();
          list.children[index + offset].querySelector('textarea').focus();
        }, {secondary:true});
        move.disabled = index + offset < 0 || index + offset >= current.questions.length;
        actions.append(move);
      }
      const remove = button('حذف سؤال', () => { current.questions.splice(index, 1); render(); }, {secondary:true});
      remove.disabled = current.questions.length <= 1;
      actions.append(remove);
      row.append(actions);
      list.append(row);
    });
  }
  function changeGoal() {
    const goal = goals.find(item => item.id === select.value);
    if (!drafts.has(goal.id)) {
      drafts.set(goal.id, structuredClone(saved[goal.id] ?? {
        title: goal.title,
        questions: goal.questions.filter(q => goal.id !== 'pregnancy' || ![3,32].includes(q.originalNumber))
          .map(q => ({id:q.originalNumber,q:q.q})),
      }));
    }
    current = drafts.get(goal.id);
    title.value = current.title;
    render();
  }
  title.oninput = () => current.title = title.value;
  select.onchange = changeGoal;
  const add = button('افزودن سؤال', () => {
    if (current.questions.length >= 100) return notice('هر هدف حداکثر ۱۰۰ سؤال دارد.', 'error');
    const id = Math.max(100, ...current.questions.map(q => q.id)) + 1;
    current.questions.push({id,q:'',type:'text'});
    render();
    list.lastElementChild.querySelector('textarea').focus();
  }, {iconName:'plus',secondary:true});
  form.append(list, add, formFooter('ذخیره و اعمال در دمو'));
  onForm(form, async () => {
    const goal = select.value;
    select.disabled = true;
    try {
      await api('admin/demo-questionnaire/' + goal, 'PUT', current);
      select.selectedOptions[0].textContent = current.title;
      notice('تنظیمات پرسش‌نامه ذخیره شد');
    } finally { select.disabled = false; }
  });
  root.append(form);
  changeGoal();
  return root;
}
