import { Badge } from './Badge'
import { formatFaDate, formatFaNumber, statusLabels } from '../utils'

const hiddenKeys = new Set(['password', 'passwordHash', 'accessToken'])

function cellText(value: unknown) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return formatFaNumber(value)
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (typeof value === 'string') return formatFaDate(value) ?? value
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean).join('، ') || '—'
  return null
}

export function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="px-6 py-10 text-center text-sm text-muted">موردی برای نمایش نیست.</p>
  }
  const first = rows[0] ?? {}
  const keys = Object.keys(first).filter((key) => !hiddenKeys.has(key) && cellText(first[key]) !== null).slice(0, 7)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-right text-sm">
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key} className="whitespace-nowrap bg-[#f9faf6] px-4 py-3 text-[11px] font-normal text-[#75816d]">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-t border-[#edf0e8]">
              {keys.map((key) => {
                const value = row[key]
                if (key === 'status' && typeof value === 'string') {
                  const tone = ['active', 'paid', 'credited', 'approved', 'verified', 'published'].includes(value)
                    ? 'success'
                    : ['failed', 'rejected', 'suspended', 'deleted'].includes(value)
                      ? 'danger'
                      : 'warning'
                  return (
                    <td key={key} className="px-4 py-3">
                      <Badge variant={tone === 'warning' ? 'warning' : tone} dot>
                        {statusLabels[value] ?? value}
                      </Badge>
                    </td>
                  )
                }
                return (
                  <td key={key} className="max-w-[280px] px-4 py-3 align-middle text-[#334632]">
                    {cellText(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DefinitionList({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(([key]) => !hiddenKeys.has(key))
  return (
    <dl className="grid gap-4 p-6 sm:grid-cols-2">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt className="text-[11px] font-semibold text-[#5d7160]">{key}</dt>
          <dd className="mt-1 text-sm break-words">
            {cellText(item) ?? <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(item, null, 2)}</pre>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
