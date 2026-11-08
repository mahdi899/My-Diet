import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { activeQuestions, type AnswerValue, type CanonicalAnswers, type SpecQuestion } from '../../src/onboarding/spec.js';

const BASE: CanonicalAnswers = {
  name: 'نگار',
  age: 33,
  sex: 'female',
  height_cm: 166,
  weight_kg: 79,
  target_weight_kg: 68,
  sleep_wake: { sleep: 23, wake: 7 },
};

function sample(question: SpecQuestion, overrides: CanonicalAnswers): AnswerValue {
  if (overrides[question.key] != null) return overrides[question.key]!;
  if (BASE[question.key] != null) return BASE[question.key]!;
  const options = question.options ?? [];
  if (question.kind === 'text') return 'توضیح';
  if (question.kind === 'number' || question.kind === 'age') return question.default ?? question.min ?? 1;
  if (question.kind === 'single') return (options.find((option) => option.code !== 'yes') ?? options[0])!.code;
  const none = options.find((option) => option.code === 'none');
  return [(none ?? options[0])!.code];
}

/** A valid weight-loss answer set; `overrides` replace individual answers. */
export function weightLossAnswers(overrides: CanonicalAnswers = {}): CanonicalAnswers {
  const answers: CanonicalAnswers = {};
  for (let round = 0; round < 5; round += 1) {
    for (const question of activeQuestions('weight_loss', answers)) {
      if (answers[question.key] != null) continue;
      answers[question.key] = sample(question, overrides);
      if (question.followUp) {
        const value = answers[question.key];
        const codes = Array.isArray(value) ? value : [String(value)];
        if (codes.some((code) => question.followUp!.whenCodes.includes(code))) answers[question.followUp.key] = 'توضیح';
      }
    }
  }
  return answers;
}

/** Fills the draft and submits it with consent, through the public endpoints. */
export async function completeOnboarding(api: INestApplication, auth: { Authorization: string }, overrides: CanonicalAnswers = {}) {
  const server = api.getHttpServer();
  const saved = await request(server).put('/v1/me/onboarding/draft').set(auth)
    .send({ track: 'weight_loss', patch: weightLossAnswers(overrides), stepKey: 'review', progress: 90 });
  if (saved.status !== 200) throw new Error(`draft ${saved.status} ${JSON.stringify(saved.body)}`);
  const done = await request(server).post('/v1/me/onboarding/submit').set(auth).send({ consent: true });
  if (done.status !== 201) throw new Error(`submit ${done.status} ${JSON.stringify(done.body)}`);
  return done.body;
}
