import { type FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import './settings.css'

type PlanPrice = { id: string; title: string; days: number; priceToman: number }

function asPlan(row: Record<string, unknown>): PlanPrice | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null
  return { id: row.id, title: row.title, days: Number(row.days ?? 0), priceToman: Number(row.priceToman ?? 0) }
}

export function SubscriptionPricesPage({ preview }: { preview: boolean }) {
  const client = useQueryClient()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['admin-subscription-prices'],
    enabled: !preview,
    queryFn: async () => asRows(asRecord(await staff.api('admin/subscription-prices'))?.plans).flatMap(row => {
      const plan = asPlan(row)
      return plan ? [plan] : []
    }),
  })
  const save = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const raw = toEnglishDigits(String(data.get('amountToman') ?? '')).trim()
      const amountToman = Number(raw)
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(amountToman) || amountToman < 1 || amountToman > 100_000_000) {
        throw new Error('مبلغ باید عدد صحیح بین ۱ و ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.')
      }
      await staff.api('admin/subscription-prices', 'PUT', { planId: String(data.get('planId') ?? ''), amountToman })
    },
    onSuccess: async () => {
      setError('')
      setNotice('تعرفهٔ اشتراک ذخیره شد و برای خرید بعدی اعمال می‌شود.')
      await client.invalidateQueries({ queryKey: ['admin-subscription-prices'] })
    },
    onError: cause => { setNotice(''); setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد.') },
  })
  const plans = preview
    ? [{ id: 'weekly', title: 'شروع', days: 15, priceToman: 1290000 }, { id: 'monthly', title: 'همراه', days: 30, priceToman: 1990000 }, { id: 'quarterly', title: 'VIP', days: 90, priceToman: 8990000 }]
    : query.data ?? []

  return <div className="admin-settings">
    <section className="settings-card">
      <header><div><h2>تعرفه اشتراک</h2><p>قیمت پلن‌های ۱۵، ۳۰ و ۹۰ روزه. خرید اپ همین مبلغ را استفاده می‌کند.</p></div>
        <span className="icon-tile tone-green"><Icon name="wallet" /></span></header>
      <form onSubmit={event => { setError(''); save.mutate(event) }} aria-busy={save.isPending}>
        <label>پلن<select name="planId" defaultValue="" required>
          <option value="" disabled>یک پلن انتخاب کنید</option>
          {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title} · {formatFaNumber(plan.days)} روزه · {formatFaNumber(plan.priceToman)} تومان</option>)}
        </select></label>
        <label>مبلغ جدید (تومان)<input name="amountToman" inputMode="numeric" placeholder="مثلاً ۱۲۹۰۰۰۰" required /></label>
        <p className="settings-note"><Icon name="info" /><span>تعرفهٔ جدید فقط برای خریدهای بعدی است. خرید باز با قیمت قبلی تمام می‌شود.</span></p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="settings-success" role="status">{notice}</p>}
        <footer><button type="submit" disabled={preview || save.isPending || (!preview && query.isLoading)}><Icon name="check" />{save.isPending ? 'در حال ذخیره…' : 'ذخیره تعرفه'}</button></footer>
      </form>
    </section>
  </div>
}
