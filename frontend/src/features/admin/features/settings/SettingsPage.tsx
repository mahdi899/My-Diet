import { type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import './settings.css'

function SettingsCard({ title, description, icon, note, saveLabel, preview, submit, children }: {
  title: string; description: string; icon: 'wallet' | 'star'; note: string; saveLabel: string
  preview: boolean; submit: (data: FormData) => Promise<unknown>; children: ReactNode
}) {
  const save = useMutation({ mutationFn: submit })
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview && !save.isPending) save.mutate(new FormData(event.currentTarget))
  }
  return <section className="settings-card">
    <header><div><h2>{title}</h2><p>{description}</p></div>
      <span className={`icon-tile tone-${icon === 'wallet' ? 'green' : 'amber'}`}><Icon name={icon} /></span></header>
    <form onSubmit={handleSubmit} onChange={() => { if (!save.isPending) save.reset() }} aria-busy={save.isPending}>
      {children}
      <p className="settings-note"><Icon name="info" /><span>{note}</span></p>
      {save.isError && <p className="form-error" role="alert">{save.error.message}</p>}
      {save.isSuccess && <p className="settings-success" role="status">{title} ذخیره شد.</p>}
      <footer><button type="submit" disabled={preview || save.isPending}><Icon name="check" />{save.isPending ? 'در حال ذخیره…' : saveLabel}</button></footer>
    </form>
  </section>
}

function amount(data: FormData, minimum: number) {
  const raw = toEnglishDigits(String(data.get('amountToman') ?? '')).trim()
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > 100_000_000) {
    throw new Error(`مبلغ باید عدد صحیح بین ${minimum === 0 ? '۰' : '۱'} و ۱۰۰٬۰۰۰٬۰۰۰ تومان باشد.`)
  }
  return value
}

export function SettingsPage({ preview }: { preview: boolean }) {
  return <div className="admin-settings">
    <SettingsCard title="تعرفه خدمات" description="قیمت هر خدمت به تومان ثبت می‌شود." icon="wallet"
      note="تعرفهٔ جدید برای خریدهای بعدی اعمال می‌شود." saveLabel="ذخیره تعرفه" preview={preview}
      submit={async data => staff.api('admin/prices', 'PUT', { serviceCode: String(data.get('serviceCode') ?? ''), amountToman: amount(data, 1) })}>
      <label>انتخاب خدمت<select name="serviceCode" defaultValue="" required>
        <option value="" disabled>یک خدمت انتخاب کنید</option>
        <option value="new_plan">برنامه جدید</option>
        <option value="ai_revision">بازنگری هوش مصنوعی</option>
        <option value="specialist_revision">بازنگری پزشک</option>
      </select></label>
      <label>مبلغ خدمت (تومان)<input name="amountToman" inputMode="numeric" placeholder="مثلاً ۲۵۰۰۰۰" required /></label>
    </SettingsCard>
    <SettingsCard title="پاداش هفتگی" description="انگیزه‌ای برای ادامهٔ مسیر سلامت." icon="star"
      note="مبلغ پاداش به تومان است. برای پاداش بدون مبلغ، صفر وارد کنید. کمپین روزهای پیاپی در بخش جداگانه تنظیم می‌شود."
      saveLabel="ذخیره پاداش" preview={preview}
      submit={async data => staff.api('admin/reward', 'PUT', { amountToman: amount(data, 0) })}>
      <label>مبلغ پاداش (تومان)<input name="amountToman" inputMode="numeric" placeholder="مثلاً ۲۰۰۰۰" required /></label>
    </SettingsCard>
  </div>
}
