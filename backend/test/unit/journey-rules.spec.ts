import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../../src/common/errors.js';
import { journeyReport, parseBatch } from '../../src/reports/journey-rules.js';

const now = new Date('2026-11-01T06:30:00.000Z');
const installId = '019a0000-0000-7000-8000-000000000101';
const sessionId = '019a0000-0000-7000-8000-000000000102';

function viewed(screenId: string, activeMs: number) {
  return { type: 'screen_viewed', properties: { screenId, activeMs } };
}
function moved(fromScreenId: string, toScreenId: string) {
  return { type: 'navigation', properties: { fromScreenId, toScreenId } };
}
function sample(sessionType: 'first_visit' | 'returning', events: Array<{ type: string; properties: Record<string, unknown> }>) {
  return { date: '2026-11-01', platform: 'android', appVersion: '1.0.0', sessionType, firstAuthenticated: false, gapped: false, events };
}

describe('phase 11 journey rules', () => {
  it('matches the screen graph used by the admin sample', () => {
    const first = journeyReport([
      sample('first_visit', [viewed('home', 8000), moved('home', 'plan_purchase'), viewed('plan_purchase', 20000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 40000)]),
      sample('first_visit', [viewed('home', 6000), moved('home', 'plan_purchase'), viewed('plan_purchase', 15000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 30000)]),
      sample('first_visit', [viewed('home', 5000), moved('home', 'plan_purchase'), viewed('plan_purchase', 9000)]),
      sample('first_visit', [viewed('home', 4000), moved('home', 'questionnaire'), viewed('questionnaire', 12000)]),
    ]);
    assert.equal(first.sessions, 4);
    assert.equal(first.journeys[0]?.path, 'home → plan_purchase → questionnaire');
    assert.equal(first.journeys[0]?.count, 2);
    assert.equal(first.edges.find((edge) => edge.fromScreenId === 'home' && edge.toScreenId === 'plan_purchase')?.percent, 75);
    assert.equal(first.active.find((row) => row.screenId === 'home')?.milliseconds, 8000 + 6000 + 5000 + 4000);
    const returning = journeyReport([
      sample('returning', [viewed('home', 7000), moved('home', 'plan_day'), viewed('plan_day', 25000), moved('plan_day', 'feedback'), viewed('feedback', 11000)]),
      sample('returning', [viewed('home', 3000), moved('home', 'plan_day'), viewed('plan_day', 18000)]),
    ]);
    assert.equal(returning.edges.some((edge) => edge.toScreenId === 'questionnaire'), false);
    assert.equal(returning.edges.find((edge) => edge.toScreenId === 'plan_day')?.count, 2);
    const silent = journeyReport([sample('first_visit', [viewed('home', 1000), viewed('login', 1000)])]);
    assert.equal(silent.edges.length, 0);
    assert.equal(silent.journeys[0]?.path, 'home → login');
  });

  it('rejects sensitive properties and drops the client visit label', () => {
    const opened = parseBatch({
      installId,
      sessionId,
      events: [{
        id: '019a0000-0000-7000-8000-000000000103',
        type: 'session_started',
        occurredAt: now.toISOString(),
        properties: { platform: 'android', appVersion: '1.0.0', sessionType: 'returning', firstAuthenticated: true },
      }],
    }, now);
    assert.deepEqual(opened.events[0]?.properties, { platform: 'android', appVersion: '1.0.0' });
    const rejected = (body: unknown, code: string) => {
      assert.throws(() => parseBatch(body, now), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal((error.getResponse() as { code: string }).code, code);
        return true;
      });
    };
    rejected({
      installId,
      sessionId,
      events: [{
        id: '019a0000-0000-7000-8000-000000000104',
        type: 'screen_viewed',
        occurredAt: now.toISOString(),
        properties: { screenId: 'home', phone: '+989121234567' },
      }],
    }, 'sensitive_property');
    rejected({
      installId,
      sessionId,
      events: [{
        id: '019a0000-0000-7000-8000-000000000105',
        type: 'screen_viewed',
        occurredAt: now.toISOString(),
        properties: { screenId: 'note for the doctor' },
      }],
    }, 'sensitive_property');
    rejected({
      installId,
      sessionId,
      events: [{
        id: '019a0000-0000-7000-8000-000000000106',
        type: 'screen_viewed',
        occurredAt: '2026-10-01T00:00:00.000Z',
        properties: { screenId: 'home' },
      }],
    }, 'clock_skew');
  });

  it('bounds a graph that names more screens than the report can draw', () => {
    const events = Array.from({ length: 41 }, (_, index) => viewed(`screen_${String(index).padStart(2, '0')}`, 1));
    const report = journeyReport([sample('first_visit', events)]);
    assert.equal(report.bounded, true);
    assert.equal(report.nodes.length, 40);
  });
});
