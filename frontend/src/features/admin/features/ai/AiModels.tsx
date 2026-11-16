import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { asRows } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AiBadge, AiCard, AiDialog, AiForm, AiLoad, AiNote, aiApi, date, errorText, id, itemRows, num, outcomes, poolTitles, str, usd, useAiData, type Row } from './AiUi'

const kinds: Record<string, string> = { openrouter: 'OpenRouter', openai_compatible: 'سازگار با OpenAI' }
const strategies = { priority: 'به ترتیب اولویت', cost_first: 'ارزان‌ترین اول', weighted: 'وزنی (پخش بار)' }
const sampleModel = 'deepseek/deepseek-v4.1-flash-1017'
const demoProvider = { id: 'preview-provider', name: 'OpenRouter آزمایشی', kind: 'openrouter', active: true, hasKey: true, keyHint: '…demo', baseUrl: 'https://openrouter.ai/api/v1' }
const demoPools = Object.keys(poolTitles).map((code, index) => ({
  code, strategy: 'priority', temperature: [0.1, 0.5, 0.2, 0.3, 0.3][index], maxTokens: [700, 1200, 1200, 6000, 6000][index],
  timeoutMs: [30000, 60000, 60000, 90000, 90000][index], maxAttempts: [2, 3, 3, 4, 4][index], enabled: true,
  members: [{ id: 'preview-' + code, providerId: demoProvider.id, providerName: demoProvider.name, model: sampleModel, enabled: true, weight: 1,
    priceInMicrosPerM: 6000, priceOutMicrosPerM: 500000, totalOk: index < 3 ? 1 : 0, totalFail: index < 3 ? 0 : 1,
    consecutiveFailures: index < 3 ? 0 : 1, lastErrorCode: index < 3 ? '' : 'empty_completion' }],
}))

type ProviderModal = { kind: 'edit' | 'delete'; provider?: Row }

function ProviderRow({ provider, model, preview, edit }: { provider: Row; model: string; preview: boolean; edit: (kind: 'edit' | 'delete') => void }) {
  const test = useMutation({ mutationFn: async (): Promise<Row & { elapsedMs: number }> => {
    const started = performance.now()
    const result = await aiApi('providers/' + id(provider.id) + '/test', 'POST', { model })
    return { ...result, elapsedMs: Math.round(performance.now() - started) }
  } })
  const result = test.data
  return <div className="ai-provider" aria-busy={test.isPending}>
    <div className="ai-row">
      <div className="ai-row-info"><strong>{str(provider.name)}</strong><small><bdi>{str(provider.baseUrl)}</bdi></small></div>
      <div className="ai-inline-actions"><AiBadge tone={provider.active ? 'good' : 'neutral'}>{provider.active ? 'فعال' : 'غیرفعال'}</AiBadge>
        <AiBadge tone="neutral">{kinds[str(provider.kind)] ?? str(provider.kind)}</AiBadge>
        <AiBadge tone={provider.hasKey ? 'good' : 'bad'}>{provider.hasKey ? `کلید ${str(provider.keyHint)}` : 'بدون کلید'}</AiBadge>
        <button type="button" className="secondary" disabled={preview || !provider.hasKey || test.isPending}
          aria-label={`تست اتصال ${str(provider.name)}`} onClick={() => test.mutate()}><Icon name="send" />{test.isPending ? 'در حال تست…' : 'تست'}</button>
        <button type="button" className="secondary" disabled={test.isPending} onClick={() => edit('edit')}><Icon name="sliders" />ویرایش</button>
        <button type="button" className="secondary ai-danger" disabled={test.isPending} onClick={() => edit('delete')}><Icon name="trash" />حذف</button>
      </div>
    </div>
    <div aria-live="polite" aria-atomic="true">
      {test.isPending ? <p className="ai-test-result">در حال ارسال درخواست واقعی به مدل <bdi>{model}</bdi>…</p>
        : test.isError ? <p className="ai-test-result" data-tone="bad" role="alert">تست انجام نشد: {errorText(test.error)}</p>
        : result && <div className="ai-test-result" data-tone={result.ok ? 'good' : 'bad'}>
          <strong>{result.ok ? 'اتصال برقرار است؛ پاسخ واقعی دریافت شد.' : 'اتصال ناموفق بود.'}</strong>
          <small><bdi>{model}</bdi> · {num(result.elapsedMs)} میلی‌ثانیه</small>
          {result.ok ? <p dir="auto">{str(result.answer)}</p>
            : <p>{outcomes[str(result.outcome)] ?? 'سرویس پاسخ معتبر نداد.'} <bdi>{str(result.errorCode)}</bdi></p>}
        </div>}
    </div>
  </div>
}

function ProviderDialog({ selection, preview, close, saved }: { selection: ProviderModal; preview: boolean; close: () => void; saved: (message: string) => void }) {
  const provider = selection.provider
  const endpoint = provider ? 'providers/' + id(provider.id) : 'providers'
  if (selection.kind === 'delete') return <AiDialog title="حذف سرویس" close={close}>
    <AiForm preview={preview} close={close} label="حذف سرویس" submit={async () => { await aiApi(endpoint, 'DELETE'); saved('سرویس حذف شد.') }}>
      <AiNote>سرویس «{str(provider?.name)}» حذف می‌شود. حذف سرویسِ مورداستفاده در استخر توسط سرور رد می‌شود.</AiNote>
    </AiForm>
  </AiDialog>
  return <AiDialog title={provider ? 'ویرایش سرویس' : 'افزودن سرویس هوش مصنوعی'} close={close}>
    <AiForm preview={preview} close={close} submit={async data => {
      const read = (key: string) => str(data.get(key)).trim()
      await aiApi(endpoint, provider ? 'PUT' : 'POST', {
        name: read('name'), ...(provider ? { active: read('active') === 'true' } : { kind: read('kind') }),
        ...(read('baseUrl') ? { baseUrl: read('baseUrl') } : {}),
        ...(read('apiKey') ? { apiKey: read('apiKey') } : {}),
        httpReferer: read('httpReferer'), appTitle: read('appTitle'),
      })
      saved('سرویس ذخیره شد.')
    }}>
      <label>نوع سرویس<select name="kind" defaultValue={str(provider?.kind || 'openrouter')} disabled={!!provider}>
        {Object.entries(kinds).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label>نام نمایشی<input name="name" defaultValue={str(provider?.name)} required /></label>
      <label>نشانی API<input name="baseUrl" type="url" dir="ltr" defaultValue={str(provider?.baseUrl)} placeholder="https://openrouter.ai/api/v1" /></label>
      <label>{provider ? 'کلید API جدید (اختیاری)' : 'کلید API'}<input name="apiKey" type="password" dir="ltr" autoComplete="new-password" />
        <small>کلید بعد از ذخیره نمایش داده نمی‌شود.</small></label>
      <label>نشانی سایت (اختیاری)<input name="httpReferer" dir="ltr" defaultValue={str(provider?.httpReferer)} /></label>
      <label>نام برنامه (اختیاری)<input name="appTitle" defaultValue={str(provider?.appTitle ?? 'سبزینه')} /></label>
      {provider && <label>وضعیت<select name="active" defaultValue={String(!!provider.active)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>}
    </AiForm>
  </AiDialog>
}

function applyCatalogPrices(row: Row, setPriceIn: (value: string) => void, setPriceOut: (value: string) => void) {
  setPriceIn(String(Number(row.priceInMicrosPerM ?? 0) / 1e6))
  setPriceOut(String(Number(row.priceOutMicrosPerM ?? 0) / 1e6))
}

function MemberDialog({ providers, close, add, preview }: { providers: Row[]; close: () => void; add: (row: Row) => void; preview: boolean }) {
  const [providerId, setProviderId] = useState(str(providers[0]?.id))
  const [model, setModel] = useState('')
  const [priceIn, setPriceIn] = useState('0')
  const [priceOut, setPriceOut] = useState('0')
  const catalog = useMutation({ mutationFn: (provider: string) => aiApi('providers/' + id(provider) + '/models?limit=500') })
  const models = itemRows(catalog.data)
  const needle = model.trim().toLowerCase()
  const visible = models.filter(row => {
    const label = `${str(row.id)} ${str(row.name)}`.toLowerCase()
    return needle === '' || label.includes(needle)
  })
  return <AiDialog title="افزودن مدل به استخر" close={close}>
    <AiForm preview={false} close={close} label="افزودن مدل" submit={async data => {
      const name = model.trim()
      if (!name || !providerId) throw new Error('سرویس و شناسهٔ مدل را وارد کنید.')
      add({ providerId, providerName: providers.find(provider => provider.id === providerId)?.name, model: name, weight: Number(data.get('weight')),
        enabled: true, priceInMicrosPerM: Math.round(Number(priceIn) * 1e6), priceOutMicrosPerM: Math.round(Number(priceOut) * 1e6) })
    }}>
      <label>سرویس<select value={providerId} onChange={event => { setProviderId(event.target.value); setModel(''); catalog.reset() }}>
        {providers.map(provider => <option key={str(provider.id)} value={str(provider.id)}>{str(provider.name)}</option>)}
      </select></label>
      <label>شناسهٔ مدل<input dir="ltr" value={model} required placeholder="جست‌وجو یا وارد کردن شناسه" onChange={event => {
        const value = event.target.value
        setModel(value)
        const hit = models.find(row => row.id === value)
        if (hit) applyCatalogPrices(hit, setPriceIn, setPriceOut)
      }} /></label>
      <button type="button" className="secondary" disabled={preview || catalog.isPending} onClick={() => catalog.mutate(providerId)}>{catalog.isPending ? 'در حال دریافت…' : 'دریافت فهرست زندهٔ مدل‌ها'}</button>
      {catalog.isError && <p role="alert">{errorText(catalog.error)}</p>}
      {models.length > 0 && <div className="ai-model-picker" role="listbox" aria-label="فهرست مدل‌ها" style={{ height: Math.min(280, 46 + Math.max(visible.length, 1) * 84), minHeight: Math.min(280, 46 + Math.max(visible.length, 1) * 84) }}>
        <p>{visible.length ? `${num(visible.length)} از ${num(models.length)} مدل. برای انتخاب، روی مدل بزنید.` : 'مدلی با این عبارت پیدا نشد. شناسه را دستی وارد کنید.'}</p>
        {visible.map(row => {
          const modelId = str(row.id)
          const name = str(row.name)
          return <button type="button" role="option" aria-selected={model === modelId} key={modelId} onClick={() => { setModel(modelId); applyCatalogPrices(row, setPriceIn, setPriceOut) }}>
            <bdi>{modelId}</bdi>
            <small>
              {name && name !== modelId && <bdi>{name}</bdi>}
              <span>ورودی <bdi>{usd(row.priceInMicrosPerM, 3)}</bdi></span>
              <span>خروجی <bdi>{usd(row.priceOutMicrosPerM, 3)}</bdi></span>
            </small>
          </button>
        })}
      </div>}
      <label>قیمت ورودی (دلار برای هر میلیون توکن)<input type="number" min={0} step="any" value={priceIn} onChange={event => setPriceIn(event.target.value)} required /></label>
      <label>قیمت خروجی (دلار برای هر میلیون توکن)<input type="number" min={0} step="any" value={priceOut} onChange={event => setPriceOut(event.target.value)} required /></label>
      <label>وزن<input name="weight" type="number" min={1} max={100} defaultValue={1} required /></label>
    </AiForm>
  </AiDialog>
}

const poolFields = [
  ['temperature', 'دما', 0, 2, 0.05], ['maxTokens', 'سقف توکن خروجی', 200, 32000, 1],
  ['timeoutS', 'مهلت هر تلاش (ثانیه)', 5, 300, 1], ['maxAttempts', 'حداکثر تلاش', 1, 10, 1],
] as const

function PoolCard({ pool, providers, preview, refresh, notify }: { pool: Row; providers: Row[]; preview: boolean; refresh: () => Promise<unknown>; notify: (message: string) => void }) {
  const [draft, setDraft] = useState<Row[] | null>(null)
  const [adding, setAdding] = useState(false)
  const members = draft ?? asRows(pool.members)
  const endpoint = 'pools/' + id(pool.code)
  const action = useMutation({
    mutationFn: async (task: { kind: 'save' | 'test' | 'reset'; member?: Row }) => {
      if (task.kind === 'test') return aiApi(endpoint + '/test', 'POST')
      if (task.kind === 'reset') await aiApi('members/' + id(task.member?.id) + '/reset-health', 'POST')
      else await aiApi(endpoint + '/members', 'PUT', { members: members.map(member => ({
        providerId: member.providerId, model: member.model, enabled: member.enabled, weight: member.weight,
        priceInMicrosPerM: member.priceInMicrosPerM, priceOutMicrosPerM: member.priceOutMicrosPerM,
      })) })
      await refresh()
      if (task.kind === 'save') setDraft(null)
      notify(task.kind === 'save' ? 'مدل‌های استخر ذخیره شدند.' : 'وضعیت سلامت بازنشانی شد.')
    },
  })
  function move(index: number, delta: number) {
    const updated = [...members]
    const [member] = updated.splice(index, 1)
    if (!member) return
    updated.splice(index + delta, 0, member)
    setDraft(updated)
  }
  return <AiCard title={poolTitles[str(pool.code)] ?? str(pool.title)} description={<>کد استخر <bdi>{str(pool.code)}</bdi> · اگر مدل اول خطا بدهد، مدل بعدی صدا زده می‌شود.</>}>
    <AiForm key={JSON.stringify([pool.strategy, pool.temperature, pool.maxTokens, pool.timeoutMs, pool.maxAttempts, pool.enabled])}
      preview={preview} label="ذخیرهٔ تنظیمات استخر" submit={async data => {
        await aiApi(endpoint, 'PUT', { strategy: data.get('strategy'), temperature: Number(data.get('temperature')),
          maxTokens: Number(data.get('maxTokens')), timeoutMs: Number(data.get('timeoutS')) * 1000, maxAttempts: Number(data.get('maxAttempts')), enabled: data.get('enabled') === 'true' })
        await refresh(); notify('تنظیمات استخر ذخیره شد.')
      }}>
      <div className="ai-pool-fields"><label>راهبرد انتخاب<select name="strategy" defaultValue={str(pool.strategy)}>
        {Object.entries(strategies).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {poolFields.map(([key, label, min, max, step]) => <label key={key}>{label}<input name={key} type="number" min={min} max={max} step={step}
          defaultValue={key === 'timeoutS' ? Math.round(Number(pool.timeoutMs) / 1000) : str(pool[key])} required /></label>)}
        <label>وضعیت<select name="enabled" defaultValue={String(!!pool.enabled)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
      </div>
    </AiForm>
    {!members.length && <p className="ai-feedback">این استخر هنوز مدلی ندارد.</p>}
    {members.map((member, index) => {
      const cooldown = Date.parse(str(member.cooldownUntil)) > Date.now()
      const failures = Number(member.consecutiveFailures ?? 0)
      return <div className="ai-row ai-member-row" key={str(member.id || `${member.providerId}/${member.model}`)}>
        <span className="users-current">{num(index + 1)}</span>
        <div className="ai-row-info"><strong><bdi>{str(member.model)}</bdi></strong><small>{str(member.providerName)} · ورودی {usd(member.priceInMicrosPerM, 3)} · خروجی {usd(member.priceOutMicrosPerM, 3)} در هر میلیون توکن</small></div>
        <div className="ai-row-info"><AiBadge tone={cooldown ? 'bad' : failures ? 'warn' : 'good'}>{cooldown ? `در استراحت تا ${date(member.cooldownUntil)}` : failures ? `${num(failures)} خطای پیاپی` : 'سالم'}</AiBadge>
          <small>موفق {num(member.totalOk)} · ناموفق {num(member.totalFail)}{member.lastErrorCode ? ' · ' + str(member.lastErrorCode) : ''}</small></div>
        <div className="ai-inline-actions">
          <button type="button" className="secondary icon-button" aria-label="افزایش اولویت" disabled={index === 0 || action.isPending} onClick={() => move(index, -1)}><Icon name="chevron-right" /></button>
          <button type="button" className="secondary icon-button" aria-label="کاهش اولویت" disabled={index === members.length - 1 || action.isPending} onClick={() => move(index, 1)}><Icon name="chevron-left" /></button>
          <button type="button" className="secondary" disabled={action.isPending} onClick={() => setDraft(members.map((row, i) => i === index ? { ...row, enabled: !row.enabled } : row))}>{member.enabled ? 'غیرفعال' : 'فعال'}</button>
          <button type="button" className="secondary icon-button ai-danger" aria-label="برداشتن مدل از استخر" disabled={action.isPending} onClick={() => setDraft(members.filter((_, i) => i !== index))}><Icon name="trash" /></button>
          {Boolean(member.id) && <button type="button" className="secondary" disabled={preview || action.isPending} onClick={() => action.mutate({ kind: 'reset', member })}>پاک‌کردن خطا</button>}
        </div>
      </div>
    })}
    <div className="ai-pool-tools">
      <button type="button" className="secondary" disabled={!providers.length || action.isPending} onClick={() => setAdding(true)}><Icon name="plus" />افزودن مدل</button>
      <button type="button" disabled={preview || !draft || action.isPending} onClick={() => action.mutate({ kind: 'save' })}><Icon name="check" />ذخیرهٔ ترتیب و مدل‌ها</button>
      <button type="button" className="secondary" disabled={preview || action.isPending} onClick={() => action.mutate({ kind: 'test' })}><Icon name="send" />آزمایش استخر</button>
    </div>
    {action.isError && <p className="ai-feedback" role="alert">{errorText(action.error)}</p>}
    {action.data && <p className="ai-feedback" role="status">{action.data.ok ? 'استخر پاسخ داد.' : 'استخر پاسخی نگرفت.'} {asRows(action.data.chain).map(row => `${str(row.model)} · ${outcomes[str(row.outcome)] ?? str(row.outcome)}`).join('، ') || str(action.data.errorCode)}</p>}
    {adding && <MemberDialog providers={providers} preview={preview} close={() => setAdding(false)} add={member => {
      if (members.some(row => row.providerId === member.providerId && row.model === member.model)) throw new Error('این مدل از همین سرویس در استخر وجود دارد.')
      setDraft([...members, member]); setAdding(false)
    }} />}
  </AiCard>
}

export function AiModels({ preview }: { preview: boolean }) {
  const providerQuery = useAiData('providers', { items: [demoProvider] }, preview)
  const poolQuery = useAiData('pools', { items: demoPools }, preview)
  const [modal, setModal] = useState<ProviderModal | null>(null)
  const [notice, setNotice] = useState('')
  const refresh = () => Promise.all([providerQuery.refetch(), poolQuery.refetch()])
  if (!providerQuery.data || !poolQuery.data) return <AiLoad error={providerQuery.error || poolQuery.error} retry={() => void refresh()} />
  const providers = itemRows(providerQuery.data)
  const pools = itemRows(poolQuery.data)
  const ordered = [...pools].sort((a, b) => Object.keys(poolTitles).indexOf(str(a.code)) - Object.keys(poolTitles).indexOf(str(b.code)))
  return <>
    {notice && <p className="info-note" role="status">{notice}</p>}
    <AiCard title="سرویس‌ها و کلیدها" description="هر سرویس یک نشانی و یک کلید دارد؛ مدل‌ها را در استخرها به آن‌ها وصل می‌کنید."
      action={<button type="button" onClick={() => setModal({ kind: 'edit' })}><Icon name="plus" />افزودن سرویس</button>}>
      {!providers.length && <p className="ai-feedback">هنوز سرویسی ثبت نشده است.</p>}
      <AiNote>تست، یک درخواست کوتاه واقعی به مدل ارسال می‌کند و هزینهٔ جزئی دارد.</AiNote>
      {providers.map(provider => {
        const member = pools.flatMap(pool => asRows(pool.members)).find(row => row.providerId === provider.id && row.enabled)
        return <ProviderRow key={str(provider.id)} provider={provider} model={str(member?.model || sampleModel)} preview={preview}
          edit={kind => setModal({ kind, provider })} />
      })}
    </AiCard>
    {ordered.map(pool => <PoolCard key={str(pool.code)} pool={pool} providers={providers} preview={preview} refresh={refresh} notify={setNotice} />)}
    {modal && <ProviderDialog selection={modal} preview={preview} close={() => setModal(null)} saved={message => {
      setModal(null); setNotice(message); void refresh()
    }} />}
  </>
}
