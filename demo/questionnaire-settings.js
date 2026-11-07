async function loadDemoQuestionnaire(goals) {
  try {
    const response = await fetch('/v1/public/demo-questionnaire', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return;
    const settings = await response.json();
    for (const goal of goals) {
      const document = settings[goal.id];
      if (!document) continue;
      const baseline = new Map(goal.questions.map(question => [question.originalNumber, question]));
      const questions = document.questions.flatMap(question => {
        const original = baseline.get(question.id);
        if (original) return [{ ...original, q: question.q }];
        if (question.id <= 100) return [];
        const extra = { originalNumber: question.id, q: question.q, category: 'سؤال‌های تکمیلی' };
        if (question.type === 'text') return [{ ...extra, type: 'text' }];
        return [{ ...extra, options: question.options.map(label => ({ label, icon: '•' })) }];
      });
      if (questions.length) {
        goal.questions = questions;
        goal.title = document.title;
      }
    }
  } catch {
    // The bundled questionnaire is available if the settings service is offline.
  }
}
