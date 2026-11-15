import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { staff } from '../../session'
import { doctorPreviewEnabled } from '../../data/preview'
import { messagingSample, type ChangeRequest } from '../../data/samples'
import { changeStatuses, formatFaDay } from '../../data/labels'
import { apiError } from '../../data/api'

export function ChangesPage({ onEditDemo }: { onEditDemo: () => void }) {
  const preview = doctorPreviewEnabled()
  const client = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<ChangeRequest | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['doctor', 'changes', preview],
    queryFn: () => preview ? messagingSample().changes() : staff.api<ChangeRequest[]>('specialist/queue?bucket=revisions'),
  })
  const rows = (query.data ?? []).filter((row) => filter === 'all' || row.status === filter)
  async function run(action: () => Promise<ChangeRequest>) {
    setError('')
    try {
      const next = await action()
      setSelected(next)
      await client.invalidateQueries({ queryKey: ['doctor', 'changes'] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات انجام نشد.')
    }
  }
  if (query.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  if (query.isError) return <section className="card card-pad">{apiError(query.error)}</section>
  return (
    <section className="stack">
      <p className="workspace-note">{preview ? 'نسخه نمایشی جداگانه. برنامه و پیام واقعی تغییر نمی‌کنند.' : 'درخواست‌های اختصاص‌یافته از API فعلی دریافت می‌شوند. شروع بررسی، رد با توضیح و تأیید درخواست به قرارداد سرور وابسته‌اند.'}</p>
      {error && <p className="chat-error" role="alert">{error}</p>}
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
        <dialog className="modal" open>
          <div className="modal-header"><h2>{selected.displayName || 'کاربر'}</h2><button className="icon-button" type="button" aria-label="بستن" onClick={() => setSelected(null)}>×</button></div>
          <div className="modal-body change-detail">
            <p className="change-status">{changeStatuses[selected.status] || selected.status}</p>
            {selected.reasons?.length ? <p>دلیل: {selected.reasons.join('، ')}</p> : null}
            {selected.details && <p>توضیح: {selected.details}</p>}
            {selected.awaitingCustomer && selected.clarification && <p>منتظر کاربر: {selected.clarification}</p>}
            {selected.rejection && <p>دلیل رد: {selected.rejection}</p>}
            <h3>تاریخچه</h3>
            <ol className="change-history">
              {(selected.history ?? []).length ? selected.history.map((item, index) => (
                <li key={index}><b>{changeStatuses[item.status] || item.status}</b> <small>{formatFaDay(item.at)}</small>{item.body && <span> {item.body}</span>}</li>
              )) : <li>تاریخچه‌ای ثبت نشده.</li>}
            </ol>
            {preview && selected.status === 'awaiting_review' && <button type="button" onClick={() => run(() => messagingSample().start(selected.id))}>شروع بررسی</button>}
            {preview && selected.status === 'under_review' && (
              <>
                <label>یادداشت برای کاربر
                  <textarea maxLength={2000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="دلیل رد، یا سؤالی که می‌خواهید از کاربر بپرسید" />
                </label>
                <div className="actions">
                  <button className="secondary" type="button" onClick={() => run(() => messagingSample().clarify(selected.id, note))}>سؤال از کاربر</button>
                  <button className="secondary" type="button" onClick={() => run(() => messagingSample().reject(selected.id, note))}>رد درخواست</button>
                  {selected.awaitingCustomer && <button className="secondary" type="button" onClick={() => run(() => messagingSample().answer(selected.id))}>پاسخ نمونهٔ کاربر</button>}
                  <button type="button" onClick={onEditDemo}>ویرایش برنامه</button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </section>
  )
}
