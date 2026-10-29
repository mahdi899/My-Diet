/** A pregnancy recorded more than four weeks ago has to be reviewed. */
export const PREGNANCY_STALE_DAYS = 28;

const OPEN_REQUEST = new Set([
  'queued',
  'generating',
  'in_review',
  'awaiting_user',
  'response_received',
]);

export interface PublishedQuestion {
  id: string;
  required?: boolean;
}

export interface OpenRequestRef {
  id: string;
  status: string;
}

export interface AcquisitionInput {
  hasSubmission: boolean;
  submittedSchemaVersion: number | null;
  publishedSchemaVersion: number;
  questions: PublishedQuestion[];
  answers: Record<string, unknown> | null;
  pregnancyAsOf: string | null;
  today: string;
  openRequest: OpenRequestRef | null;
}

export interface AcquisitionDecision {
  questionnaire: 'missing' | 'complete' | 'needs_review';
  reasons: string[];
  nextStep: 'questionnaire' | 'confirm_summary' | 'select_service' | 'open_request';
  openRequest: OpenRequestRef | null;
  pregnancyWeek: number | null;
}

export function questionsOf(document: unknown): PublishedQuestion[] {
  if (!document || typeof document !== 'object') return [];
  const questions = (document as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];
  return questions.flatMap((item) => {
    if (typeof item === 'string') return [{ id: item }];
    if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') return [];
    const row = item as { id: string; required?: unknown };
    return [{ id: row.id, required: row.required === true }];
  });
}

/** Whole Tehran civil days from `from` to `to`. */
export function civilDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function decideAcquisition(input: AcquisitionInput): AcquisitionDecision {
  const openRequest =
    input.openRequest && OPEN_REQUEST.has(input.openRequest.status) ? input.openRequest : null;
  if (!input.hasSubmission || !input.answers) {
    return {
      questionnaire: 'missing',
      reasons: [],
      nextStep: 'questionnaire',
      openRequest,
      pregnancyWeek: null,
    };
  }

  const reasons: string[] = [];
  if (input.questions.some((question) => question.required && !answered(input.answers?.[question.id]))) {
    reasons.push('schema_required_question_added');
  }

  const storedWeek = integerOrNull(input.answers.pregnancyWeek);
  let pregnancyWeek: number | null = null;
  if (input.answers.lifeStage === 'pregnant') {
    if (storedWeek == null || input.pregnancyAsOf == null) {
      reasons.push('pregnancy_stale');
    } else {
      const days = civilDaysBetween(input.pregnancyAsOf, input.today);
      pregnancyWeek = storedWeek + Math.floor(Math.max(0, days) / 7);
      if (days > PREGNANCY_STALE_DAYS) reasons.push('pregnancy_stale');
    }
  }

  const questionnaire = reasons.length > 0 ? 'needs_review' : 'complete';
  let nextStep: AcquisitionDecision['nextStep'] = 'select_service';
  if (questionnaire !== 'complete') nextStep = 'questionnaire';
  else if (openRequest) nextStep = 'open_request';
  else if (
    input.submittedSchemaVersion !== input.publishedSchemaVersion ||
    (pregnancyWeek != null && pregnancyWeek !== storedWeek)
  ) {
    nextStep = 'confirm_summary';
  }

  return { questionnaire, reasons, nextStep, openRequest, pregnancyWeek };
}

/** Answers for published `custom_*` questions. Builtin fields stay on the validated submission. */
export function customAnswers(
  questions: PublishedQuestion[],
  source: Record<string, unknown>,
): Record<string, string | number | unknown[]> {
  const extras: Record<string, string | number | unknown[]> = {};
  for (const question of questions) {
    if (!question.id.startsWith('custom_')) continue;
    const value = source[question.id];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 500) {
        throw new Error('custom answer too long');
      }
      if (trimmed) extras[question.id] = trimmed;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      extras[question.id] = value;
    } else if (Array.isArray(value) && value.length > 0 && value.length <= 20) {
      extras[question.id] = value;
    }
  }
  return extras;
}

function answered(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((item) => answered(item));
  return false;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
