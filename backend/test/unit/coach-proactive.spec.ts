import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planProactive, type ProactivePlanInput } from '../../src/coach/proactive-plan.js';

function input(overrides: Partial<ProactivePlanInput> = {}): ProactivePlanInput {
  return {
    quiet: false,
    hour: 8,
    minutes: 8 * 60,
    weekday: 1,
    sentToday: 0,
    dailyMax: 3,
    backedOff: false,
    recentNag: false,
    dayBriefSent: false,
    weeklySent: false,
    meals: [],
    reminded: [],
    missedSent: [],
    dueStepNote: null,
    streak: 0,
    streakMilestonesSent: [],
    lossKg: 0,
    lossMilestonesSent: [],
    ...overrides,
  };
}

const meal = {
  mealUid: '55555555-5555-7555-8555-555555555555',
  mealType: 'lunch' as const,
  title: 'خورش قیمه',
  suggestedTime: '13:00',
  state: 'unrecorded',
};

describe('coach proactive planner', () => {
  it('stays quiet at night and still keeps a promised follow-up out of the daily budget', () => {
    assert.deepEqual(planProactive(input({ quiet: true, dueStepNote: 'وزن را ثبت کن' })), []);
    const planned = planProactive(input({ dailyMax: 0, dueStepNote: 'وزن را ثبت کن', hour: 8 }));
    assert.deepEqual(planned.map((item) => item.kind), ['next_step']);
  });

  it('sends the morning brief, a meal reminder, and stops at the daily budget', () => {
    const planned = planProactive(input({
      hour: 8,
      minutes: 12 * 60 + 40,
      meals: [meal],
      dailyMax: 2,
    }));
    assert.deepEqual(planned.map((item) => item.kind), ['day_brief', 'meal_reminder']);
  });

  it('backs off nags after silence but still sends the Friday review and one new milestone', () => {
    const planned = planProactive(input({
      backedOff: true,
      recentNag: true,
      hour: 19,
      minutes: 19 * 60,
      weekday: 5,
      dayBriefSent: false,
      streak: 7,
      lossKg: 2.4,
      meals: [{ ...meal, suggestedTime: '19:10' }],
    }));
    assert.deepEqual(planned.map((item) => item.kind), ['weekly_review', 'milestone', 'milestone']);
    assert.equal(planned.filter((item) => item.kind === 'milestone').length, 2);
    const again = planProactive(input({
      hour: 19, weekday: 5, weeklySent: true, streak: 7, streakMilestonesSent: [3, 7], lossKg: 1, lossMilestonesSent: [1],
    }));
    assert.deepEqual(again, []);
  });

  it('marks a meal missed only inside the late window', () => {
    const missed = planProactive(input({
      dayBriefSent: true,
      hour: 14,
      minutes: 14 * 60 + 30,
      meals: [meal],
    }));
    assert.equal(missed[0]?.kind, 'missed_meal');
    const tooSoon = planProactive(input({
      dayBriefSent: true,
      hour: 13,
      minutes: 13 * 60 + 20,
      meals: [meal],
    }));
    assert.equal(tooSoon.length, 0);
  });
});
