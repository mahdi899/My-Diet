import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../../admin/components/AdminIcon'
import { apiError, loadMember, loadMembers, loadPlan, loadQueue, removeMember, type DoctorMember, type QueueRow } from '../../data/api'
import { formatFaDay, trackLabels } from '../../data/labels'

type Person = DoctorMember | QueueRow
type Mode = 'patients' | 'review' | 'reports'
const daily = 86_400_000

function goal(row: Person) {
  return trackLabels[row.goal ?? ''] || trackLabels[row.track ?? ''] || row.goal || '—'
}

export function PeoplePage({ mode, onPlan, onMeals, onActivity }: {
  mode: Mode; onPlan: (id: string) => void; onMeals: (id: string) => void; onActivity: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const [detail, setDetail] = useState<Person | null>(null)
  const [removing, setRemoving] = useState<Person | null>(null)
  const review = mode === 'review'
  const reports = mode === 'reports'
  const list = useQuery({
    queryKey: ['doctor', 'people', mode],
    queryFn: (): Promise<Person[]> => review ? loadQueue('specialist/queue?bucket=awaiting_review') : loadMembers(reports),
    refetchInterval: reports ? daily : false,
  })
  const removal = useMutation({
    mutationFn: removeMember,
    onSuccess: async () => {
      setRemoving(null)
      await queryClient.invalidateQueries({ queryKey: ['doctor', 'people'] })
    },
  })
  if (list.isPending) return <p role="status">در حال دریافت اطلاعات…</p>
  if (list.isError) return <p role="alert">{apiError(list.error)}</p>
  return <>
    {reports && <p className="workspace-note">روز کامل یعنی همهٔ وعده‌های برنامه در آن روز ثبت شده‌اند. هفتهٔ برنامه و تغییر وزن هر ۲۴ ساعت محاسبه می‌شوند.</p>}
    <section className="card table-wrap">
      <table>
        <thead><tr><th>نام کاربر</th><th>شماره تلفن</th>{review && <th>تاریخ ثبت</th>}<th>هدف</th>
          {reports ? <><th>هفتهٔ برنامه</th><th>تغییر وزن</th><th>آخرین محاسبه</th><th>روزهای کامل</th><th>عملیات</th></> : <th>عملیات</th>}
        </tr></thead>
        <tbody>
          {list.data.length === 0 && <tr><td colSpan={reports ? 8 : review ? 5 : 4}>هنوز موردی ثبت نشده است.</td></tr>}
          {list.data.map(row => <tr key={row.id}>
            <td>{row.displayName || '—'}</td><td><bdi>{row.phone || '—'}</bdi></td>
            {review && <td>{formatFaDay((row as QueueRow).createdAt)}</td>}
            <td>{goal(row)}</td>
            {reports ? <><ProgressCells row={row as DoctorMember} /><td><div className="doctor-row-actions">
              <button className="secondary icon-button" type="button" aria-label={`مشاهدهٔ تقویم فعالیت ${row.displayName}`} title="مشاهدهٔ تقویم فعالیت" onClick={() => onActivity(row.id)}><Icon name="eye" /></button>
            </div></td></> : <td><div className="doctor-row-actions">
              <button className="secondary icon-button" type="button" aria-label={`مشاهدهٔ اطلاعات ${row.displayName}`} onClick={() => setDetail(row)}><Icon name="eye" /></button>
              {!review && <button className="secondary icon-button" type="button" aria-label={`حذف عضویت ${row.displayName}`}
                onClick={() => { removal.reset(); setRemoving(row) }}><Icon name="trash" /></button>}
            </div></td>}
          </tr>)}
        </tbody>
      </table>
    </section>
    {detail && <PersonDetails row={detail} review={review} close={() => setDetail(null)} onPlan={onPlan} onMeals={onMeals} />}
    {removing && <DoctorDialog title="حذف از زیرمجموعه" close={() => setRemoving(null)} busy={removal.isPending}>
      <p>عضویت «{removing.displayName}» در زیرمجموعهٔ شما حذف می‌شود. حساب و سوابق کاربر حفظ می‌شود.</p>
      {removal.isError && <p role="alert">{apiError(removal.error)}</p>}
      <button type="button" disabled={removal.isPending} onClick={() => removal.mutate(removing.id)}>تأیید حذف عضویت</button>
    </DoctorDialog>}
  </>
}

function ProgressCells({ row }: { row: DoctorMember }) {
  const change = row.weightChangeKg
  return <>
    <td>{row.week == null ? 'شروع نشده' : formatFaNumber(row.week)}</td>
    <td>{change == null ? 'ثبت وزن کافی نیست' : change === 0 ? 'بدون تغییر' : `${formatFaNumber(Math.abs(change))} کیلوگرم ${change < 0 ? 'کاهش' : 'افزایش'}`}</td>
    <td>{row.refreshedAt ? formatFaDay(row.refreshedAt) : '—'}</td>
    <td>{row.completedDays == null ? '—' : formatFaNumber(row.completedDays)}</td>
  </>
}

export function DoctorDialog({ title, close, busy = false, children }: {
  title: string; close: () => void; busy?: boolean; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog className="doctor-details-dialog" ref={ref} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <header><h2 id={heading}>{title}</h2><button className="secondary icon-button" type="button" onClick={close} disabled={busy} aria-label="بستن"><Icon name="close" /></button></header>
    {children}
  </dialog>
}

function PersonDetails({ row, review, close, onPlan, onMeals }: {
  row: Person; review: boolean; close: () => void; onPlan: (id: string) => void; onMeals: (id: string) => void
}) {
  const detail = useQuery({
    queryKey: ['doctor', 'person-details', review, row.id],
    queryFn: async () => review ? (await loadPlan(row.id)).profile : loadMember(row.id),
  })
  const profile = detail.data
  const fields = [
    ['شماره تلفن', row.phone], ['هدف', goal(row)], ['سن', profile?.age],
    ['قد (سانتی‌متر)', profile?.heightCm], ['وزن ثبت‌شده (کیلوگرم)', profile?.weightKg],
    ['وزن هدف (کیلوگرم)', profile?.targetWeightKg], ['شاخص تودهٔ بدنی', profile?.bmi],
    ['حساسیت‌ها', profile?.allergens?.join('، ')], ['شرایط سلامتی', profile?.conditions?.join('، ')],
  ] as const
  return <DoctorDialog title={row.displayName || 'اطلاعات کاربر'} close={close}>
    {detail.isPending && <p role="status">در حال دریافت پرونده…</p>}
    {detail.isError && <p role="alert">{apiError(detail.error)}</p>}
    {detail.isSuccess && <dl className="doctor-detail-grid">
      {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value || '—'}</bdi></dd></div>)}
    </dl>}
    {review && <div className="doctor-row-actions">
      <button type="button" onClick={() => onPlan(row.id)}>باز کردن برنامه</button>
      <button className="secondary" type="button" onClick={() => onMeals(row.id)}>جزئیات وعده‌ها</button>
    </div>}
  </DoctorDialog>
}
