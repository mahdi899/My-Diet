import { formatFaDay, personName, requestStatus } from '../../data/labels'
import type { QueueRow } from '../../data/samples'

export function QueueTable({ rows, onPlan, onMeals }: {
  rows: QueueRow[]
  onPlan: (row: QueueRow) => void
  onMeals: (row: QueueRow) => void
}) {
  if (!rows.length) {
    return <section className="card card-pad"><h2>هنوز موردی ثبت نشده</h2><p>پس از ثبت اطلاعات، فهرست در همین بخش نمایش داده می‌شود.</p></section>
  }
  return (
    <section className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>پرونده و ویرایش</th>
            <th>جزئیات غذا</th>
            <th>نام کاربر</th>
            <th>وضعیت</th>
            <th>نوع</th>
            <th>زمان ثبت</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><button className="secondary" type="button" onClick={() => onPlan(row)}>باز کردن پرونده و برنامه</button></td>
              <td><button className="secondary" type="button" onClick={() => onMeals(row)}>بررسی جزئیات و جایگزین‌ها</button></td>
              <td>{personName(row)}</td>
              <td>{requestStatus[row.status] || 'نیازمند بررسی'}</td>
              <td>{row.kind === 'new_plan' ? 'برنامه جدید' : 'بازنگری برنامه'}</td>
              <td>{formatFaDay(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
