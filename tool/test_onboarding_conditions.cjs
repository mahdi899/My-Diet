const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../onboarding');
function load(page, goalId) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'questionnaire-data.js'), 'utf8'), context);
  const goal = context.window.SABZINE_QUESTIONNAIRE.goals.find(goal => goal.id === goalId);
  const questions = goal.questions.map(question => ({ ...question }));
  context.state = {
    selectedGoal: { ...goal, questions }, allGoalQuestions: questions,
    answers: {}, focusedQuestionIndex: 16, maxUnlockedIndex: questions.length - 1,
  };
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  for (const name of ['updateConditionalQuestions', 'restoreSavedAnswers', 'answersByNumber', 'followUpRequiredForChoice', 'isQuestionAnswered', 'answerLabel', 'requiresMedicalReview']) {
    const start = source.indexOf(`    function ${name}(`);
    if (start < 0) continue;
    const end = source.indexOf('\n    }', start) + '\n    }'.length;
    vm.runInContext(source.slice(start, end), context);
  }
  return context;
}

for (const page of ['index.html', 'goals.html', 'quiz.html']) {
  test(`${page}: positive unintentional weight loss answers require medical review`, () => {
    const context = load(page, 'weight_gain');
    const question = context.state.selectedGoal.questions.find(question => question.originalNumber === 24);
    assert.equal(context.requiresMedicalReview(question, undefined), false);
    assert.equal(context.requiresMedicalReview(question, 0), false);
    assert.equal(context.requiresMedicalReview(question, 1), true);
    assert.equal(context.requiresMedicalReview(question, 2), true);
    assert.equal(context.requiresMedicalReview(question, { choice: 2 }), true);
    assert.equal(context.requiresMedicalReview(context.state.selectedGoal.questions[0], 1), false);
  });

  test(`${page}: every allergy category asks for the specific foods and keeps their detail`, () => {
    const context = load(page, 'weight_loss');
    const index = context.state.selectedGoal.questions.findIndex(question => question.originalNumber === 8);
    const question = context.state.selectedGoal.questions[index];
    question.options.forEach((option, choice) => {
      const needsDetail = option.label !== 'بدون حساسیت';
      assert.equal(context.followUpRequiredForChoice(question, choice), needsDetail, option.label);
      context.state.answers[index] = { choices: [choice], detail: '  ' };
      assert.equal(context.isQuestionAnswered(index), !needsDetail, option.label);
      context.state.answers[index].detail = 'فقط شیر';
      assert.equal(context.isQuestionAnswered(index), true, option.label);
    });
    const answer = { choices: [1, 2], detail: 'لبنیات: فقط شیر؛ آجیل: بادام' };
    assert.equal(context.answerLabel(question, answer), 'لبنیات، آجیل — لبنیات: فقط شیر؛ آجیل: بادام');
  });

  test(`${page}: no exercise hides gain sport and discards stale follow-up answers`, () => {
    const context = load(page, 'weight_gain');
    const state = context.state;
    const exercise = state.selectedGoal.questions.find(question => question.originalNumber === 17);
    state.selectedGoal.questions.forEach((question, index) => {
      state.answers[index] = [18, 19, 25].includes(question.originalNumber) ? 1 : `answer-${question.originalNumber}`;
    });
    state.answers[16] = 0;
    assert.equal(context.updateConditionalQuestions(exercise), 16);
    assert.equal(state.selectedGoal.questions.length, state.allGoalQuestions.length - 3);
    for (const number of [18, 19, 25]) {
      assert.equal(state.selectedGoal.questions.some(question => question.originalNumber === number), false);
    }
    assert.equal(state.answers[state.selectedGoal.questions.findIndex(question => question.originalNumber === 26)], 'answer-26');

    state.answers[16] = 2;
    context.updateConditionalQuestions(exercise);
    for (const number of [18, 19, 25]) {
      const index = state.selectedGoal.questions.findIndex(question => question.originalNumber === number);
      assert.ok(index >= 0, `question ${number} returns for an exercising user`);
      assert.equal(state.answers[index], undefined, `question ${number} needs a fresh answer`);
    }
  });

  test(`${page}: question 25 is preserved on other tracks`, () => {
    for (const goalId of ['weight_loss', 'pregnancy', 'detox']) {
      const context = load(page, goalId);
      const state = context.state;
      const exercise = state.selectedGoal.questions.find(question => question.originalNumber === 17);
      state.answers[16] = 0;
      context.updateConditionalQuestions(exercise);
      assert.equal(state.selectedGoal.questions.some(question => question.originalNumber === 25), true, goalId);
    }
  });
}

test('quiz refresh keeps exercise follow-ups hidden and excludes their saved answers', () => {
  const context = load('quiz.html', 'weight_gain');
  context.restoreSavedAnswers({
    answersByNumber: { 17: 0, 18: 1, 19: 2, 25: 3, 26: 1 },
    focused: 22, unlocked: 24, phone: '09120000000',
  });
  const saved = context.answersByNumber();
  for (const number of [18, 19, 25]) {
    assert.equal(context.state.selectedGoal.questions.some(question => question.originalNumber === number), false);
    assert.equal(saved[number], undefined);
  }
  assert.equal(saved[17], 0);
  assert.equal(saved[26], 1);
});
