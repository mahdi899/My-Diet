import { formatFaDate } from '@shared/utils'
import { RecordListTable, ShortRecordId, type RecordColumn } from '../../components/RecordListTable'

const columns: RecordColumn[] = [
  { title: 'عملیات', value: row => row.action, render: value => <bdi>{String(value ?? '') || '—'}</bdi> },
  { title: 'بخش', value: row => row.targetType, render: value => <bdi>{String(value ?? '') || '—'}</bdi> },
  { title: 'مدیر', value: row => row.actorId, render: value => <ShortRecordId value={value} /> },
  { title: 'شناسه مرتبط', value: row => row.targetId, render: value => <ShortRecordId value={value} /> },
  { title: 'زمان', value: row => formatFaDate(row.createdAt) },
]

export function AuditLogsTable({ rows }: { rows: Record<string, unknown>[] }) {
  return <RecordListTable title="تاریخچه فعالیت" variant="audit" rows={rows} columns={columns} pageSize={10}
    emptyText="هنوز فعالیتی ثبت نشده است." noMatchesText="فعالیتی با این مشخصات پیدا نشد." />
}
