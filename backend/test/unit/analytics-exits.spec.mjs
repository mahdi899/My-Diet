// Run against a PostgreSQL connection using ANALYTICS_TEST_DATABASE_URL or DATABASE_URL.
// Fixtures are query-local CTEs: this test never changes application data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { analyticsExitsSql } from '../../dist/admin/analytics-exits.js';

test('independent paths preserve earlier exits and scope registration/inactivity', async () => {
  const db = new pg.Client({ connectionString: process.env.ANALYTICS_TEST_DATABASE_URL || process.env.DATABASE_URL });
  await db.connect();
  try {
    const events = [];
    const add = (visit, minutes, step, name = 'step_view', journey = null) => {
      events.push({ event_id: String(events.length + 1).padStart(4, '0'), visit_id: visit,
        minutes, step, event_name: name, journey });
    };
    // Existing data: answering 23 shows 24; later activity in the same visit
    // must not move that exit to intro or suppress it after registration.
    add('legacy', 20, 'quiz');
    add('legacy', 19, 'question:detox:23');
    add('legacy', 18, 'question:detox:24');
    add('legacy', 17, 'question:detox:24', 'presence_end');
    add('legacy', 15, 'intro');
    add('legacy', 14, 'goals');
    add('legacy', 13, 'quiz');
    add('legacy', 12, 'question:pregnancy:11');
    add('legacy', 11, 'contact', 'phone_registered');
    // Explicit IDs also isolate concurrent tabs in one Umami visit.
    add('modern', 10, 'question:detox:24', 'step_view', 'path-a');
    add('modern', 9, 'question:weight_loss:3', 'step_view', 'path-b');
    add('modern', 8, 'contact', 'phone_registered', 'path-b');
    add('modern', 7, 'question:detox:24', 'presence_end', 'path-a');
    // An active path is excluded; resuming one ID changes only that path.
    add('modern', 6, 'question:weight_gain:1', 'step_view', 'path-c');
    add('modern', 0, 'question:weight_gain:2', 'step_view', 'path-c');
    add('resume', 10, 'question:pregnancy:1', 'step_view', 'path-d');
    add('resume', 5, 'question:pregnancy:2', 'step_view', 'path-d');
    // Re-entering quiz without visiting intro/goals starts a legacy path.
    add('reload', 12, 'quiz');
    add('reload', 11, 'question:weight_loss:5');
    add('reload', 9, 'quiz');
    add('reload', 8, 'question:weight_gain:6');
    const prefix = `with fixtures as (
      select *,now()-minutes*interval '1 minute' as created_at
      from jsonb_to_recordset($1::jsonb) as f(event_id text,visit_id text,
        minutes int,step text,event_name text,journey text)
    ), e as (select event_id,visit_id,created_at,event_name from fixtures),
    d as (select event_id as website_event_id,'journey' as data_key,
      journey as string_value from fixtures where journey is not null),
    steps as (select e.*,f.step from e join fixtures f using(event_id)
      where e.event_name='step_view') `;
    const rows = (await db.query(prefix + analyticsExitsSql, [JSON.stringify(events)])).rows;
    const counts = Object.fromEntries(rows.map(r => [r.step, r.visits]));
    assert.deepEqual(counts, { 'question:detox:24': 2, 'question:pregnancy:2': 1,
      'question:weight_gain:6': 1, 'question:weight_loss:5': 1 });
    assert.equal(rows.reduce((n, r) => n + r.percent, 0), 100);
  } finally { await db.end(); }
});
