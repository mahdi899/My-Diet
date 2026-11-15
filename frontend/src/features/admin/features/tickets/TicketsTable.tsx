import { formatFaDate } from '@shared/utils'
import { RecordListTable, ShortRecordId, type RecordColumn } from '../../components/RecordListTable'

const columns: RecordColumn[] = [
  { title: 'تیکت', value: row => row.id, render: value => <ShortRecordId value={value} /> },
  { title: 'کاربر', value: row => row.userId, render: value => <ShortRecordId value={value} /> },
  { title: 'زمان ایجاد', value: row => formatFaDate(row.createdAt) },
]

export function TicketsTable({ rows }: { rows: Record<string, unknown>[] }) {
  return <RecordListTable title="تیکت‌ها" variant="tickets" rows={rows} columns={columns} pageSize={12}
    emptyText="هنوز تیکتی ثبت نشده است." noMatchesText="تیکتی با این مشخصات پیدا نشد." />
}
