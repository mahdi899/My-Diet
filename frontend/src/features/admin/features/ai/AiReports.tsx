import { useState } from 'react'
import { asRecord, asRows } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AiBadge, AiCard, AiForm, AiLoad, AiMetrics, AiNote, AiTable, aiApi, date, itemRows, num, outcomes, str, usd, useAiData } from './AiUi'

const budgetFields = [
  ['dailyCapMicros', 'سقف هزینهٔ روزانه'], ['monthlyCapMicros', 'سقف هزینهٔ ماهانه'], ['perRequestCapMicros', 'سقف هزینهٔ هر درخواست برنامه'],
] as const
const demoUsage = {
  todayMicros: 0, monthMicros: 3700, dailyShare: null, alert: 'ok',
  controls: { dailyCapMicros: null, monthlyCapMicros: null, perRequestCapMicros: null, perUserDailyDrafts: 5, killSwitch: false },
  byModel: [{ model: 'deepseek/deepseek-v4.1-flash-1017', calls: 16, ok: 5, tokens: 8774, costMicros: 3700 },
    { model: 'openai/gpt-4o-mini', calls: 1, ok: 0, tokens: 0, costMicros: 0 }],
  daily: [{ day: '2026-11-12', calls: 7, costMicros: 3600 }, { day: '2026-11-14', calls: 5, costMicros: 100 }, { day: '2026-11-15', calls: 1, costMicros: 0 }],
}
const demoLedger = { items: ['ok', 'ok', 'rejected', 'timeout'].map((outcome, i) => ({
  id: 'preview-call-' + i, task: 'pool_test', model: 'deepseek/deepseek-v4.1-flash-1017', createdAt: '2026-11-14T07:26:00Z',
  outcome, costMicros: outcome === 'ok' ? 10 : 0, tokensIn: outcome === 'ok' ? 23 : 0, tokensOut: outcome === 'ok' ? 4 : 0, latencyMs: 1270 - i * 151,
})) }
const demoQuality = { totals: { drafted: 0, total: 0, failed: 0, skipped: 0, avgCostMicros: 0, avgLatencyMs: 0 }, items: [] }
const reasons: Record<string, string> = {
  high_risk: 'پرونده پرخطر', kill_switch: 'کلید توقف اضطراری', cost_cap: 'سقف هزینهٔ روزانه', monthly_cap: 'سقف هزینهٔ ماهانه',
  user_quota: 'سهمیهٔ روزانهٔ کاربر', invalid_draft: 'خروجی مدل قابل‌استفاده نبود', budget_blocked: 'سقف هزینهٔ درخواست',
}
const alerts: Record<string, string> = { ok: 'سالم', warning: 'نزدیک سقف', blocked: 'سقف پر شده', killed: 'کلید توقف روشن است' }
const money = (value: unknown) => <bdi dir="ltr">{usd(value, 6)}</bdi>

export function AiBudget({ preview }: { preview: boolean }) {
  const usage = useAiData('usage', demoUsage, preview)
  const ledger = useAiData('ledger?limit=60', demoLedger, preview)
  const [notice, setNotice] = useState('')
  if (!usage.data) return <AiLoad error={usage.error} retry={() => void usage.refetch()} />
  const data = usage.data
  const controls = asRecord(data.controls) ?? {}
  return <>
    <AiMetrics icon="wallet" entries={[
      ['هزینه تأییدشده امروز', money(data.confirmedTodayMicros ?? data.todayMicros), 'طبق هزینه برگشتی سرویس', 'green'],
      ['مصرف ۳۰ روز اخیر', money(data.monthMicros), controls.monthlyCapMicros == null ? 'بدون سقف ماهانه' : 'سقف ' + usd(controls.monthlyCapMicros, 2), 'amber'],
      ['درصد سقف روزانه', data.dailyShare == null ? '—' : num(Math.round(Number(data.dailyShare) * 100)) + '٪', 'امروز، به وقت تهران', 'blue'],
      ['وضعیت', alerts[str(data.alert)] ?? '—', 'کلید توقف و سقف‌ها را پایین‌تر تنظیم کنید', 'rose'],
    ]} />
    {notice && <p className="info-note" role="status">{notice}</p>}
    <AiNote>هزینه تأییدشده از پاسخ سرویس خوانده می‌شود؛ برآورد امروز: {money(data.estimatedTodayMicros)}. گزارش فقط مصرف ثبت‌شده این برنامه را پوشش می‌دهد، نه کل حساب CloseRouter یا تست‌های قدیمی ثبت‌نشده.</AiNote>
    <AiCard title="سقف‌ها و کلید توقف" description="مبلغ‌ها به دلار آمریکا. خالی‌گذاشتن یعنی بدون سقف."
      action={<span className="icon-tile tone-green"><Icon name="shield" /></span>}>
      <AiForm key={JSON.stringify(controls)} preview={preview} submit={async form => {
        const limits = Object.fromEntries(budgetFields.map(([key]) => {
          const value = str(form.get(key))
          const micros = Math.round(Number(value) * 1e6)
          if (value !== '' && (!Number.isSafeInteger(micros) || micros < 0)) throw new Error('مبلغ سقف معتبر نیست.')
          return [key, value === '' ? null : micros]
        }))
        await aiApi('budget', 'PUT', { ...limits, perUserDailyDrafts: Number(form.get('quota')), killSwitch: form.get('kill') === 'true' })
        await usage.refetch(); setNotice('سقف‌ها و کلید توقف ذخیره شدند.')
      }}>
        {budgetFields.map(([key, label]) => <label key={key}>{label}<input name={key} type="number" min={0} step="0.000001" dir="ltr"
          defaultValue={controls[key] == null ? '' : String(Number(controls[key]) / 1e6)} /></label>)}
        <label>حداکثر پیش‌نویس AI برای هر کاربر در روز<input name="quota" type="number" min={0} max={100} defaultValue={str(controls.perUserDailyDrafts)} required /></label>
        <label>کلید توقف اضطراری<select name="kill" defaultValue={String(!!controls.killSwitch)}><option value="false">خاموش (AI فعال)</option><option value="true">روشن (همه به متخصص می‌روند)</option></select></label>
        <AiNote>با پر شدن سقف یا روشن شدن کلید توقف، درخواست‌های تازه بدون پیش‌نویس به متخصص می‌رسند. هشدار ۸۰٪ در تاریخچهٔ فعالیت ثبت می‌شود.</AiNote>
      </AiForm>
    </AiCard>
    <AiTable title="مصرف به تفکیک مدل (۳۰ روز)" description="تعداد فراخوانی، موفقیت، توکن و هزینهٔ واقعی" rows={asRows(data.byModel)} empty="هنوز مصرفی ثبت نشده"
      columns={ [['مدل', row => <bdi>{str(row.model)}</bdi>], ['فراخوانی', row => num(row.calls)], ['موفق', row => num(row.ok)], ['توکن', row => num(row.tokens)], ['هزینه', row => money(row.costMicros)]] } />
    <AiTable title="هزینهٔ روزانه" rows={asRows(data.daily).slice().reverse()} empty="هنوز مصرفی ثبت نشده"
      columns={ [['روز', row => <bdi>{str(row.day)}</bdi>], ['فراخوانی', row => num(row.calls)], ['هزینه', row => money(row.costMicros)]] } />
    {ledger.data ? <AiTable title="آخرین فراخوانی‌ها" description="هر تلاش یک ردیف دارد؛ فراخوانی‌های ناموفق هم ثبت می‌شوند."
      rows={itemRows(ledger.data)} empty="فراخوانی‌ای ثبت نشده" searchable columns={[
        ['زمان', row => date(row.createdAt)], ['مدل', row => <bdi>{str(row.model)}</bdi>], ['کار', row => <bdi>{str(row.task)}</bdi>],
        ['نتیجه', row => <AiBadge tone={row.outcome === 'ok' ? 'good' : 'bad'}>{outcomes[str(row.outcome)] ?? str(row.outcome)}</AiBadge>],
        ['توکن', row => num(Number(row.tokensIn ?? 0) + Number(row.tokensOut ?? 0))], ['هزینه', row => money(row.costMicros)], ['تأخیر', row => `${num(row.latencyMs)} ms`],
        ['منبع هزینه', row => row.costSource === 'provider' ? 'تأیید سرویس' : row.costSource === 'estimate' ? 'برآورد' : 'نامشخص'],
      ]} /> : <AiLoad error={ledger.error} retry={() => void ledger.refetch()} />}
  </>
}

export function AiQuality({ preview }: { preview: boolean }) {
  const query = useAiData('generations?limit=100', demoQuality, preview)
  if (!query.data) return <AiLoad error={query.error} retry={() => void query.refetch()} />
  const totals = asRecord(query.data.totals) ?? {}
  return <>
    <AiMetrics icon="sparkles" entries={[
      ['پیش‌نویس موفق (۳۰ روز)', num(totals.drafted), `از ${num(totals.total)} درخواست`, 'green'],
      ['شکست یا دستی', num(Number(totals.failed ?? 0) + Number(totals.skipped ?? 0)), `${num(totals.failed)} شکست · ${num(totals.skipped)} ردشده با سقف/ریسک`, 'rose'],
      ['میانگین هزینه', <bdi dir="ltr">{usd(totals.avgCostMicros, 3)}</bdi>, 'برای هر پیش‌نویس موفق', 'amber'],
      ['میانگین زمان', `${num(Math.round(Number(totals.avgLatencyMs ?? 0) / 1000))} ثانیه`, 'از ارسال تا پیش‌نویس', 'blue'],
    ]} />
    <AiNote>«هشدار اعتبارسنج» یعنی پیش‌نویس از نظر ایمنی درست بوده ولی از نظر انرژی، پروتئین یا تنوع باید بررسی شود. بازبین نظر مشورتی می‌دهد.</AiNote>
    <AiTable title="آخرین پیش‌نویس‌ها" rows={itemRows(query.data)} empty="هنوز پیش‌نویسی ساخته نشده" searchable columns={[
      ['زمان', row => date(row.createdAt)], ['درخواست', row => <bdi title={str(row.requestId)}>{str(row.requestId).slice(0, 8) || '—'}</bdi>],
      ['وضعیت', row => <AiBadge tone={row.status === 'drafted' ? 'good' : row.status === 'failed' ? 'bad' : 'warn'}>
        {row.status === 'drafted' ? 'پیش‌نویس شد' : row.status === 'failed' ? 'شکست' : 'دستی'}
      </AiBadge>], ['علت', row => reasons[str(row.reason)] ?? (str(row.reason) || '—')],
      ['مدل', row => <bdi>{str(row.model) || '—'}</bdi>], ['تلاش', row => row.attempts ? `${num(row.attempts)} (${num(row.failedAttempts)} ناموفق)` : '—'],
      ['هشدار اعتبارسنج', row => num(row.validatorWarnings)], ['بازبین', row => ({ ok: 'تأیید', concerns: 'نگرانی', unavailable: 'در دسترس نبود' })[str(row.critic)] ?? '—'],
      ['هزینه', row => money(row.costMicros)], ['پرامپت', row => row.promptVersion ? num(row.promptVersion) : '—'],
    ]} />
  </>
}
