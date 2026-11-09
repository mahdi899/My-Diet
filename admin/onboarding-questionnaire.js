async function onboardingQuestionnairePage() {
  const response = await fetch('/v1/public/onboarding-questionnaire', {cache:'no-store'});
  if (!response.ok) throw new Error('دریافت تنظیمات پرسش‌نامه ممکن نشد.');
  const saved = await response.json();
  const goals = window.SABZINE_QUESTIONNAIRE.goals;
  const root = element('section');
  const grid = element('div', null, 'onboarding-goal-grid');
  const editor = element('section', null, 'card report-stack');
  const form = element('form', null, 'report-stack');
  const heading = element('h2');
  heading.tabIndex = -1;
  const title = field(form, 'title', 'عنوان هدف');
  title.maxLength = 120;
  const list = element('div', null, 'report-stack');
  const drafts = new Map();
  let current, activeGoal, activeCard;
  const back = button('بازگشت به دسته‌بندی‌ها', () => {
    editor.hidden = true;
    grid.hidden = false;
    activeCard.focus();
  }, {secondary:true});
  for (const goal of goals) {
    const card = button(saved[goal.id]?.title ?? goal.title, () => changeGoal(goal, card), {className:'onboarding-goal-card'});
    card.style.backgroundImage = 'linear-gradient(rgb(12 23 17 / 53%), rgb(12 23 17 / 53%)), url("/onboarding/' + goal.image + '")';
    grid.append(card);
  }
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
  function changeGoal(goal, card) {
    if (!drafts.has(goal.id)) {
      drafts.set(goal.id, structuredClone(saved[goal.id] ?? {
        title: goal.title,
        questions: goal.questions.filter(q => goal.id !== 'pregnancy' || ![3,32].includes(q.originalNumber))
          .map(q => ({id:q.originalNumber,q:q.q})),
      }));
    }
    current = drafts.get(goal.id);
    activeGoal = goal.id;
    activeCard = card;
    title.value = current.title;
    heading.textContent = current.title;
    render();
    grid.hidden = true;
    editor.hidden = false;
    heading.focus();
  }
  title.oninput = () => current.title = title.value;
  const add = button('افزودن سؤال', () => {
    if (current.questions.length >= 100) return notice('هر هدف حداکثر ۱۰۰ سؤال دارد.', 'error');
    const id = Math.max(100, ...current.questions.map(q => q.id)) + 1;
    current.questions.push({id,q:'',type:'text'});
    render();
    list.lastElementChild.querySelector('textarea').focus();
  }, {iconName:'plus',secondary:true});
  form.append(list, add, formFooter('ذخیره و اعمال در آنبوردینگ وب'));
  onForm(form, async () => {
    back.disabled = true;
    try {
      const document = await api('admin/onboarding-questionnaire/' + activeGoal, 'PUT', current);
      heading.textContent = document.title;
      activeCard.textContent = document.title;
      notice('تنظیمات پرسش‌نامه ذخیره شد');
    } finally { back.disabled = false; }
  });
  editor.append(back, heading, form);
  editor.hidden = true;
  root.append(grid, editor);
  return root;
}
