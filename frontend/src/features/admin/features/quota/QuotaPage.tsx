import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows } from '@shared/utils'
import { staff } from '../../session'

type PlanQuota = {
  plan_code: string
  daily_msg_limit: number
  period_msg_limit: number
  period_days: number
  vision_limit: number
}

const labels: Record<string, string> = { weekly: 'شروع ۱۵ روزه', monthly: 'همراه ۳۰ روزه', quarterly: 'ویژه ۹۰ روزه' }

export function QuotaPage({ preview }: { preview: boolean }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['admin-coach-quotas'],
    enabled: !preview,
    queryFn: async () => asRows(asRecord(await staff.api('admin/coach-quotas'))?.plans) as PlanQuota[],
  })
  const save = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const planCode = String(data.get('planCode') ?? '')
      const body = {
        dailyLimit: Number(data.get('dailyLimit')),
        periodLimit: Number(data.get('periodLimit')),
        periodDays: Number(data.get('periodDays')),
        visionLimit: Number(data.get('visionLimit')),
      }
      await staff.api('admin/coach-quotas/' + encodeURIComponent(planCode), 'PUT', body)
    },
    onSuccess: async () => {
      setError('')
      setNotice('سقف پیام مربی ذخیره شد.')
      await client.invalidateQueries({ queryKey: ['admin-coach-quotas'] })
    },
    onError: (cause: Error) => setError(cause.message || 'ذخیره انجام نشد'),
  })

  if (preview) {
    return <section className="card card-pad"><h2>سهمیه مربی</h2><p>در پیش‌نمایش، سقف‌ها فقط نمایشی هستند.</p></section>
  }
  if (query.isLoading) return <section className="card card-pad">در حال دریافت سقف‌ها…</section>
  if (query.isError) return <section className="card card-pad">سقف پیام‌ها دریافت نشد.</section>

  return (
    <div className="stack">
      {notice && <p className="info-note">{notice}</p>}
      {error && <p className="info-note">{error}</p>}
      {(query.data ?? []).map((plan) => (
        <form key={plan.plan_code} className="card card-pad stack" onSubmit={(event) => save.mutate(event)}>
          <h2>{labels[plan.plan_code] ?? plan.plan_code}</h2>
          <input type="hidden" name="planCode" value={plan.plan_code} />
          <label>سقف روزانه<input name="dailyLimit" type="number" min={1} max={100} defaultValue={plan.daily_msg_limit} required /></label>
          <label>سقف دوره<input name="periodLimit" type="number" min={1} defaultValue={plan.period_msg_limit} required /></label>
          <label>طول دوره (روز)<input name="periodDays" type="number" min={1} defaultValue={plan.period_days} required /></label>
          <label>سقف تحلیل عکس<input name="visionLimit" type="number" min={1} defaultValue={plan.vision_limit} required /></label>
          <button type="submit" disabled={save.isPending}>ذخیره</button>
        </form>
      ))}
    </div>
  )
}
