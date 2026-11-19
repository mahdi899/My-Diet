import { staff } from '../session'
import { doctorPreviewEnabled } from './preview'
import { messagingSample, type ChangeRequest } from './samples'

type LiveChange = {
  id: string; planRequestId: string; displayName?: string; status: string; createdAt: string
  explanation: string; reasons: { label: string }[]; rejectionExplanation: string | null
  substate: string; question: { prompt: string; answer: string | null } | null
}

function present(row: LiveChange): ChangeRequest {
  return {
    id: row.id, planRequestId: row.planRequestId, displayName: row.displayName ?? '',
    status: row.status, createdAt: row.createdAt, details: row.explanation,
    reasons: row.reasons.map(reason => reason.label), rejection: row.rejectionExplanation ?? '',
    awaitingCustomer: row.substate === 'awaiting_clarification',
    clarification: row.question?.prompt, answer: row.question?.answer ?? undefined, history: [],
  }
}

export async function loadChanges(): Promise<ChangeRequest[]> {
  if (doctorPreviewEnabled()) return messagingSample().changes()
  return (await staff.api<LiveChange[]>('specialist/plan-changes')).map(present)
}

export async function changeAction(id: string, action: 'review' | 'clarifications' | 'reject', note = ''): Promise<ChangeRequest> {
  if (doctorPreviewEnabled()) {
    const sample = messagingSample()
    return action === 'review' ? sample.start(id) : action === 'reject' ? sample.reject(id, note) : sample.clarify(id, note)
  }
  const body = action === 'reject' ? { explanation: note } : action === 'clarifications' ? { prompt: note } : undefined
  return present(await staff.api<LiveChange>('specialist/plan-changes/' + encodeURIComponent(id) + '/' + action, 'POST', body))
}
