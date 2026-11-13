import { useQuery } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { Button, Card, CardBody, DataTable, DefinitionList } from '@shared/ui'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { staff } from '../../session'
import { doctorPath } from '../../nav'

export function DoctorWorkspace({ section }: { section: string }) {
  const query = useQuery({
    queryKey: ['doctor', section],
    queryFn: async () => {
      if (section === 'dashboard') {
        const [review, changes] = await Promise.all([
          staff.api('specialist/queue?bucket=awaiting_review'),
          staff.api('specialist/queue?bucket=revisions'),
        ])
        return { kind: 'dashboard' as const, review: asRows(review), changes: asRows(changes) }
      }
      const path = doctorPath(section)
      const payload = await staff.api(path ?? 'specialist/queue')
      const rows = asRows(payload)
      if (rows.length || Array.isArray(payload)) return { kind: 'table' as const, rows }
      const record = asRecord(payload)
      return { kind: 'object' as const, value: record ?? {} }
    },
  })

  if (query.isLoading) return <Card><CardBody>در حال دریافت…</CardBody></Card>
  if (query.isError) {
    const message = query.error instanceof StaffError ? query.error.message : 'ارتباط با سرور برقرار نشد'
    return <Card><CardBody><p className="mb-3 text-sm text-danger">{message}</p><Button variant="secondary" onClick={() => query.refetch()}>تلاش دوباره</Button></CardBody></Card>
  }
  const data = query.data
  if (!data) return null
  if (data.kind === 'dashboard') {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardBody><p className="text-sm text-muted">منتظر بررسی</p><div className="text-3xl font-bold">{formatFaNumber(data.review.length)}</div></CardBody></Card>
          <Card><CardBody><p className="text-sm text-muted">درخواست اصلاح</p><div className="text-3xl font-bold">{formatFaNumber(data.changes.length)}</div></CardBody></Card>
        </div>
        <Card>
          <h2 className="border-b border-line px-6 py-4 font-bold">برنامه‌های آماده بررسی</h2>
          <DataTable rows={data.review} />
        </Card>
      </div>
    )
  }
  if (data.kind === 'object') return <Card><DefinitionList value={data.value} /></Card>
  return <Card><DataTable rows={data.rows} /></Card>
}
