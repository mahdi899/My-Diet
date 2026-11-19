import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { staff } from '../../session'
import { doctorPreviewEnabled } from '../../data/preview'
import { messagingSample, type ChangeRequest } from '../../data/samples'
import { changeStatuses, formatFaDay } from '../../data/labels'
import { apiError, loadPlan } from '../../data/api'
import { changeAction, loadChanges } from '../../data/change-requests'
import { DoctorDialog } from './PeoplePage'

export function ChangesPage({ onEditDemo, onEditPlan }: { onEditDemo: () => void; onEditPlan: (requestId: string, changeId: string) => void }) {
  const preview = doctorPreviewEnabled()
  const client = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<ChangeRequest | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useQuery({
    queryKey: ['doctor', 'changes', preview],
    queryFn: loadChanges,
  })
  const rows = (query.data ?? []).filter((row) => filter === 'all' || row.status === filter)
  async function run(action: () => Promise<ChangeRequest>) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const next = await action()
      setSelected(next)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['doctor', 'changes'] }),
        client.invalidateQueries({ queryKey: ['doctor', 'dashboard'] }),
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.')
    } finally { setBusy(false) }
  }
  async function editPlan(row: ChangeRequest) {
    if (preview) { onEditDemo(); return }
    if (!row.planRequestId || busy) return
    setBusy(true)
    setError('')
    try {
      const plan = await loadPlan(row.planRequestId)
      if (plan.version?.status === 'published') {
        await staff.api('specialist/requests/' + encodeURIComponent(row.planRequestId) + '/corrections', 'POST')
      }
      onEditPlan(row.planRequestId, row.id)
    } catch (cause) { setError(apiError(cause)) } finally { setBusy(false) }
  }
  if (query.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  if (query.isError) return <section className="card card-pad">{apiError(query.error)}</section>
  return (
    <section className="stack">
      <p className="workspace-note">{preview ? 'نسخه نمایشی جداگانه. برنامه و پیام واقعی تغییر نمی‌کنند.' : 'درخواست‌های کاربران را بررسی کنید؛ برای تأیید تغییر، برنامه را ویرایش و منتشر کنید.'}</p>
      {error && !selected && <p className="chat-error" role="alert">{error}</p>}
      <div className="change-filters">
        {[['all', 'همه'] as const, ...Object.entries(changeStatuses)].map(([key, label]) => (
          <button key={key} className={`secondary${filter === key ? ' active' : ''}`} type="button" onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {!rows.length ? <p>درخواستی در این وضعیت ندارید.</p> : (
        <section className="card table-wrap">
          <table>
            <thead><tr><th>کاربر</th><th>وضعیت</th><th>ثبت</th><th>جزئیات</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName || 'نام ارائه نشده'}</td>
                  <td>{changeStatuses[row.status] || row.status}</td>
                  <td>{formatFaDay(row.createdAt)}</td>
                  <td><button className="secondary" type="button" onClick={() => { setSelected(row); setNote(''); setError('') }}>جزئیات درخواست</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {preview && <button className="secondary" type="button" onClick={onEditDemo}>باز کردن پروندهٔ نمونه برای ویرایش برنامه</button>}
      {selected && (
        <DoctorDialog title={selected.displayName || 'کاربر'} close={() => setSelected(null)} busy={busy}>
          <div className="modal-body change-detail">
            {error && <p className="chat-error" role="alert">{error}</p>}
            <p className="change-status">{changeStatuses[selected.status] || selected.status}</p>
            {selected.reasons?.length ? <p>دلیل: {selected.reasons.join('، ')}</p> : null}
            {selected.details && <p>توضیح: {selected.details}</p>}
            {selected.awaitingCustomer && selected.clarification && <p>منتظر کاربر: {selected.clarification}</p>}
            {selected.answer && <p>پاسخ کاربر: {selected.answer}</p>}
            {selected.rejection && <p>دلیل رد: {selected.rejection}</p>}
            <h3>تاریخچه</h3>
            <ol className="change-history">
              {(selected.history ?? []).length ? selected.history.map((item, index) => (
                <li key={index}><b>{changeStatuses[item.status] || item.status}</b> <small>{formatFaDay(item.at)}</small>{item.body && <span> {item.body}</span>}</li>
              )) : <li>تاریخچه‌ای ثبت نشده.</li>}
            </ol>
            {selected.status === 'awaiting_review' && <button type="button" disabled={busy} onClick={() => run(() => changeAction(selected.id, 'review'))}>شروع بررسی</button>}
            {selected.status === 'under_review' && (
              <>
                <label>یادداشت برای کاربر
                  <textarea disabled={busy} maxLength={2000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="دلیل رد، یا سؤالی که می‌خواهید از کاربر بپرسید" />
                </label>
                <div className="actions">
                  <button className="secondary" type="button" disabled={busy || selected.awaitingCustomer || !note.trim()} onClick={() => run(() => changeAction(selected.id, 'clarifications', note))}>سؤال از کاربر</button>
                  <button className="secondary" type="button" disabled={busy || !note.trim()} onClick={() => run(() => changeAction(selected.id, 'reject', note))}>رد درخواست</button>
                  {preview && selected.awaitingCustomer && <button className="secondary" type="button" disabled={busy} onClick={() => run(() => messagingSample().answer(selected.id))}>پاسخ نمونهٔ کاربر</button>}
                  {selected.awaitingCustomer && <p>برای انتشار تغییر، منتظر پاسخ کاربر بمانید.</p>}
                  <button type="button" disabled={busy || selected.awaitingCustomer} onClick={() => void editPlan(selected)}>ویرایش برنامه</button>
                </div>
              </>
            )}
          </div>
        </DoctorDialog>
      )}
    </section>
  )
}
