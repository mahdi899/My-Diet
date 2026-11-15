import { StaffError } from '@shared/api/staff-session'
import { asRows } from '@shared/utils'
import { staff } from '../session'
import { doctorPreviewEnabled, previewProfile } from './preview'
import { messagingSample, previewReviewQueue, samplePlanRequest, type PlanRequest, type QueueRow } from './samples'

export async function loadQueue(path: string): Promise<QueueRow[]> {
  if (doctorPreviewEnabled()) {
    if (path.includes('revisions')) {
      return (await messagingSample().changes()).map((row) => ({ id: row.id, displayName: row.displayName, status: row.status, kind: 'revision', createdAt: row.createdAt }))
    }
    if (path.includes('awaiting_review')) return previewReviewQueue
    return [...previewReviewQueue, ...(await loadQueue('specialist/queue?bucket=revisions'))]
  }
  return asRows(await staff.api(path)) as QueueRow[]
}

export async function loadProfile() {
  if (doctorPreviewEnabled()) return previewProfile
  return staff.api<typeof previewProfile>('specialist/profile')
}

export async function loadPlan(id: string): Promise<PlanRequest> {
  if (doctorPreviewEnabled()) return samplePlanRequest(id)
  return staff.api<PlanRequest>('specialist/requests/' + encodeURIComponent(id))
}

export function apiError(error: unknown) {
  return error instanceof StaffError ? error.message : 'دریافت اطلاعات انجام نشد.'
}
