export const INFO_QUESTION_STATUSES = ['open', 'answered', 'acknowledged', 'withdrawn'] as const;

export type InfoQuestionStatus = (typeof INFO_QUESTION_STATUSES)[number];

/** Missing filter means the questions the user still has to answer. */
export function parseQuestionListStatus(raw: unknown): InfoQuestionStatus | null {
  if (raw == null || raw === '') return 'open';
  if (typeof raw === 'string' && (INFO_QUESTION_STATUSES as readonly string[]).includes(raw)) {
    return raw as InfoQuestionStatus;
  }
  return null;
}

/** An answer can be added while the specialist has not closed the question. */
export function acceptsAnotherAnswer(status: string): boolean {
  return status === 'open' || status === 'answered';
}

/** A specialist can take back a question that is not yet acknowledged. */
export function canWithdrawQuestion(status: string): boolean {
  return status === 'open' || status === 'answered';
}

/** Open and answered required questions still block publication. */
export function questionBlocksPublish(status: string, required: boolean): boolean {
  return required && (status === 'open' || status === 'answered');
}
