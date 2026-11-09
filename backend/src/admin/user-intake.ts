import { createHmac } from 'crypto';
import type { Pool } from 'pg';
import { decryptText } from '../common/field-crypto.js';
import type { Env } from '../config/env.js';
import {
  adminAnswerRows,
  demoDisplayName,
  demoRawRows,
  legacyToCanonical,
  trackTitle,
  type LegacyAnswer,
} from '../onboarding/mapper.js';
import { openCanonical } from '../onboarding/onboarding.service.js';
import type { CanonicalAnswers, TrackId } from '../onboarding/spec.js';
import { questionByKey } from '../onboarding/spec.js';

export type UserIntakeAnswer = { question: string; answer: string };

export type UserIntake = {
  displayName: string | null;
  trackId: string | null;
  trackLabel: string | null;
  source: 'demo' | 'app' | null;
  answers: UserIntakeAnswer[];
};

function nameFromAnswers(answers: CanonicalAnswers, displayName: string | null): string | null {
  const raw = answers.name;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return displayName;
}

async function factsRows(
  pool: Pool,
  userId: string,
): Promise<{ track: string | null; source: string | null; answers: UserIntakeAnswer[] } | null> {
  const row = await pool.query<{ track: string; source: string; submission_id: string }>(
    `select track, source, submission_id from nutrition_profiles where user_id = $1`,
    [userId],
  );
  const profile = row.rows[0];
  if (!profile) return null;
  const facts = await pool.query<{ question_key: string; value_code: string; value_num: string | null }>(
    `select question_key, value_code, value_num
     from onboarding_answer_facts
     where submission_id = $1
     order by question_key, value_code`,
    [profile.submission_id],
  );
  if (!facts.rowCount) return null;
  const answers: UserIntakeAnswer[] = [];
  for (const fact of facts.rows) {
    const question = questionByKey(fact.question_key);
    const label = question?.title ?? fact.question_key;
    const option = question?.options?.find((item) => item.code === fact.value_code);
    const answer = fact.value_num != null ? fact.value_num : option?.label ?? fact.value_code;
    answers.push({ question: label, answer });
  }
  return {
    track: profile.track,
    source: profile.source === 'demo' ? 'demo' : 'app',
    answers,
  };
}

async function draftRows(
  pool: Pool,
  env: Env,
  userId: string,
): Promise<{ track: string | null; source: 'demo' | 'app'; answers: CanonicalAnswers } | null> {
  const row = await pool.query<{ track: string | null; answers: CanonicalAnswers; source: string }>(
    `select track, answers, source from onboarding_drafts where user_id = $1`,
    [userId],
  );
  const draft = row.rows[0];
  if (!draft) return null;
  return {
    track: draft.track,
    source: draft.source === 'demo' ? 'demo' : 'app',
    answers: openCanonical(draft.answers, env.FIELD_KEY),
  };
}

function parseLead(goal: string, encrypted: string, fieldKey: string): {
  track: string;
  displayName: string | null;
  answers: UserIntakeAnswer[];
} {
  let items: LegacyAnswer[] = [];
  try {
    const parsed: unknown = JSON.parse(decryptText(encrypted, fieldKey));
    if (Array.isArray(parsed)) items = parsed as LegacyAnswer[];
  } catch {
    items = [];
  }
  const { track, answers } = legacyToCanonical(goal as TrackId, items);
  const raw = demoRawRows(items);
  return {
    track,
    displayName: demoDisplayName(items) ?? nameFromAnswers(answers, null),
    answers: raw.length ? raw : adminAnswerRows(track, answers),
  };
}

async function demoLeadRows(
  pool: Pool,
  env: Env,
  userId: string,
  phone: string,
): Promise<{ track: string; displayName: string | null; answers: UserIntakeAnswer[] } | null> {
  const claimed = await pool.query<{ goal: string; answers_encrypted: string }>(
    `select goal, answers_encrypted from demo_lead_submissions
     where claimed_user_id = $1
     order by created_at desc limit 1`,
    [userId],
  );
  let lead = claimed.rows[0];
  if (!lead) {
    const hash = createHmac('sha256', env.FIELD_KEY).update(phone).digest('hex');
    const byPhone = await pool.query<{ goal: string; answers_encrypted: string }>(
      `select goal, answers_encrypted from demo_lead_submissions
       where phone_hash = $1
       order by created_at desc limit 1`,
      [hash],
    );
    lead = byPhone.rows[0];
  }
  if (!lead) return null;
  return parseLead(lead.goal, lead.answers_encrypted, env.FIELD_KEY);
}

/** Copies the demo name onto accounts that were created before it was stored on the user. */
export async function rememberDemoIdentities(
  pool: Pool,
  env: Env,
  people: Array<{ id: string; phone: string; displayName: string | null }>,
): Promise<Map<string, { displayName: string | null; fromDemo: boolean }>> {
  const leads = await pool.query<{ phone_hash: string; claimed_user_id: string | null; answers_encrypted: string; goal: string }>(
    `select phone_hash, claimed_user_id, goal, answers_encrypted
     from demo_lead_submissions
     order by created_at desc`,
  );
  const byUser = new Map<string, (typeof leads.rows)[number]>();
  const byHash = new Map<string, (typeof leads.rows)[number]>();
  for (const lead of leads.rows) {
    if (lead.claimed_user_id && !byUser.has(lead.claimed_user_id)) byUser.set(lead.claimed_user_id, lead);
    if (!byHash.has(lead.phone_hash)) byHash.set(lead.phone_hash, lead);
  }
  const result = new Map<string, { displayName: string | null; fromDemo: boolean }>();
  for (const person of people) {
    const hash = createHmac('sha256', env.FIELD_KEY).update(person.phone).digest('hex');
    const lead = byUser.get(person.id) ?? byHash.get(hash);
    if (!lead) {
      result.set(person.id, { displayName: person.displayName, fromDemo: false });
      continue;
    }
    const parsed = parseLead(lead.goal, lead.answers_encrypted, env.FIELD_KEY);
    const displayName = person.displayName || parsed.displayName;
    if (displayName && !person.displayName) {
      await pool.query(`update users set display_name = $2 where id = $1 and display_name is null`, [person.id, displayName]);
    }
    await pool.query(`update users set signup_channel = 'demo' where id = $1 and signup_channel = 'app'`, [person.id]);
    result.set(person.id, { displayName, fromDemo: true });
  }
  return result;
}

export async function loadUserIntake(pool: Pool, env: Env, userId: string): Promise<UserIntake | null> {
  const user = await pool.query<{ phone_e164: string; display_name: string | null }>(
    `select phone_e164, display_name from users where id = $1`,
    [userId],
  );
  const row = user.rows[0];
  if (!row) return null;

  const lead = await demoLeadRows(pool, env, userId, row.phone_e164);
  if (lead && lead.answers.length) {
    const displayName = lead.displayName ?? row.display_name;
    if (displayName && !row.display_name) {
      await pool.query(`update users set display_name = $2 where id = $1 and display_name is null`, [userId, displayName]);
    }
    await pool.query(`update users set signup_channel = 'demo' where id = $1 and signup_channel = 'app'`, [userId]);
    return {
      displayName,
      trackId: lead.track,
      trackLabel: trackTitle(lead.track),
      source: 'demo',
      answers: lead.answers,
    };
  }

  const fromFacts = await factsRows(pool, userId);
  if (fromFacts && fromFacts.answers.length) {
    return {
      displayName: row.display_name,
      trackId: fromFacts.track,
      trackLabel: trackTitle(fromFacts.track),
      source: fromFacts.source === 'demo' ? 'demo' : 'app',
      answers: fromFacts.answers,
    };
  }

  const draft = await draftRows(pool, env, userId);
  if (draft) {
    return {
      displayName: nameFromAnswers(draft.answers, row.display_name),
      trackId: draft.track,
      trackLabel: trackTitle(draft.track),
      source: draft.source,
      answers: adminAnswerRows(draft.track, draft.answers),
    };
  }

  return {
    displayName: row.display_name,
    trackId: null,
    trackLabel: null,
    source: null,
    answers: [],
  };
}
