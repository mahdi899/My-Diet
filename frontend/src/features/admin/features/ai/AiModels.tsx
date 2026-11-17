import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { asRows } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AiBadge, AiCard, AiDialog, AiForm, AiLoad, AiNote, aiApi, date, errorText, id, itemRows, num, outcomes, poolTitles, str, usd, useAiData, type Row } from './AiUi'

const kinds: Record<string, string> = { openrouter: 'OpenRouter', closerouter: 'CloseRouter', openai_compatible: 'سازگار با OpenAI' }
const baseUrls: Record<string, string> = { openrouter: 'https://openrouter.ai/api/v1', closerouter: 'https://api.closerouter.dev/v1', openai_compatible: '' }
const strategies = { priority: 'به ترتیب اولویت', cost_first: 'ارزان‌ترین اول', weighted: 'وزنی (پخش بار)' }
const sampleModel = 'deepseek/deepseek-v4.1-flash-1017'
const demoProvider = { id: 'preview-provider', name: 'OpenRouter آزمایشی', kind: 'openrouter', active: true, hasKey: true, keyHint: '…demo', baseUrl: 'https://openrouter.ai/api/v1', models: [{ id: 'preview-model', model: sampleModel, name: sampleModel, priceInMicrosPerM: 6000, priceOutMicrosPerM: 500000 }] }
const demoPools = Object.keys(poolTitles).map((code, index) => ({
  code, strategy: 'priority', temperature: [0.1, 0.5, 0.2, 0.3, 0.3][index], maxTokens: [700, 1200, 1200, 6000, 6000][index],
  timeoutMs: [30000, 60000, 60000, 90000, 90000][index], maxAttempts: [2, 3, 3, 4, 4][index], enabled: true,
  members: [{ id: 'preview-' + code, providerId: demoProvider.id, providerName: demoProvider.name, model: sampleModel, enabled: true, weight: 1,
    priceInMicrosPerM: 6000, priceOutMicrosPerM: 500000, totalOk: index < 3 ? 1 : 0, totalFail: index < 3 ? 0 : 1,
    consecutiveFailures: index < 3 ? 0 : 1, lastErrorCode: index < 3 ? '' : 'empty_completion' }],
}))

type ProviderModal = { kind: 'edit' | 'delete'; provider?: Row }

type Quote = { inn: number; out: number; free: boolean }
type QuoteBook = { quotes: Record<string, Quote>; state: Record<string, 'loading' | 'ready' | 'error'> }

function modelCostLabel(model: Row) {
  const inn = Number(model.priceInMicrosPerM ?? 0)
  const out = Number(model.priceOutMicrosPerM ?? 0)
  if (model.free === true || (inn === 0 && out === 0)) return 'رایگان'
  return `ورودی ${usd(inn, 3)}/M · خروجی ${usd(out, 3)}/M`
}

function useCatalogQuotes(providers: Row[], preview: boolean): QuoteBook {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [state, setState] = useState<Record<string, 'loading' | 'ready' | 'error'>>({})
  const key = providers.map(provider => str(provider.id)).join('|')
  useEffect(() => {
    if (preview || key === '') return
    let cancel = false
    for (const provider of providers) {
      const providerId = str(provider.id)
      setState(prev => ({ ...prev, [providerId]: 'loading' }))
      aiApi('providers/' + id(providerId) + '/models?limit=2000')
        .then(data => {
          if (cancel) return
          const next: Record<string, Quote> = {}
          for (const row of itemRows(data)) {
            next[providerId + '\n' + str(row.id)] = { inn: Number(row.priceInMicrosPerM ?? 0), out: Number(row.priceOutMicrosPerM ?? 0), free: row.free === true }
          }
          setQuotes(prev => ({ ...prev, ...next }))
          setState(prev => ({ ...prev, [providerId]: 'ready' }))
        })
        .catch(() => { if (!cancel) setState(prev => ({ ...prev, [providerId]: 'error' })) })
    }
    return () => { cancel = true }
  }, [preview, key])
  return { quotes, state }
}

function livePrice(book: QuoteBook, providerId: string, model: string, preview: boolean, stored?: Row) {
  if (preview && stored) return modelCostLabel(stored)
  const status = book.state[providerId]
  if (status !== 'ready' && status !== 'error') return 'در حال دریافت قیمت از سرویس…'
  const quote = book.quotes[providerId + '\n' + model]
  if (!quote) return status === 'error' ? 'قیمت از سرویس دریافت نشد' : 'این مدل در فهرست فعلی سرویس نیست'
  return modelCostLabel({ priceInMicrosPerM: quote.inn, priceOutMicrosPerM: quote.out, free: quote.free })
}

function ProviderRow({ provider, edit }: { provider: Row; edit: (kind: 'edit' | 'delete') => void }) {
  return <div className="ai-provider">
    <div className="ai-row">
      <div className="ai-row-info"><strong>{str(provider.name)}</strong><small><bdi>{str(provider.baseUrl)}</bdi></small></div>
      <div className="ai-inline-actions"><AiBadge tone={provider.active ? 'good' : 'neutral'}>{provider.active ? 'فعال' : 'غیرفعال'}</AiBadge>
        <AiBadge tone="neutral">{kinds[str(provider.kind)] ?? str(provider.kind)}</AiBadge>
        <AiBadge tone={provider.hasKey ? 'good' : 'bad'}>{provider.hasKey ? `کلید ${str(provider.keyHint)}` : 'بدون کلید'}</AiBadge>
        <button type="button" className="secondary" onClick={() => edit('edit')}><Icon name="sliders" />ویرایش</button>
        <button type="button" className="secondary ai-danger" onClick={() => edit('delete')}><Icon name="trash" />حذف</button>
      </div>
    </div>
  </div>
}

function ProviderDialog({ selection, preview, close, saved }: { selection: ProviderModal; preview: boolean; close: () => void; saved: (message: string) => void }) {
  const provider = selection.provider
  const endpoint = provider ? 'providers/' + id(provider.id) : 'providers'
  const [selectedKind, setSelectedKind] = useState(str(provider?.kind || 'openrouter'))
  const [baseUrl, setBaseUrl] = useState(str(provider?.baseUrl || baseUrls.openrouter))
  const [showKey, setShowKey] = useState(false)
  
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
      {preview && <AiNote>ذخیره در حالت پیش‌نمایش غیرفعال است. از بالای صفحه «بازگشت به داده‌های واقعی» را بزنید.</AiNote>}
      <label>نوع سرویس<select name="kind" value={selectedKind} disabled={!!provider} onChange={(event) => {
        const kind = event.target.value
        setSelectedKind(kind)
        setBaseUrl(baseUrls[kind] || '')
      }}>
        {Object.entries(kinds).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label>نام نمایشی<input name="name" defaultValue={str(provider?.name)} required /></label>
      <label>نشانی API<input name="baseUrl" type="url" dir="ltr" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://openrouter.ai/api/v1" /></label>
      <label>{provider ? 'کلید API جدید (اختیاری)' : 'کلید API'}
        <div className="password-field"><input name="apiKey" type={showKey ? 'text' : 'password'} dir="ltr" autoComplete="new-password" /><button type="button" className="icon-button" aria-label={showKey ? 'پنهان کردن کلید' : 'نمایش کلید'} aria-pressed={showKey} onClick={() => setShowKey(value => !value)}><Icon name="eye" className="icon" /></button></div>
        <small>کلید بعد از ذخیره نمایش داده نمی‌شود.</small></label>
      <label>نشانی سایت (اختیاری)<input name="httpReferer" dir="ltr" defaultValue={str(provider?.httpReferer)} /></label>
      <label>نام برنامه (اختیاری)<input name="appTitle" defaultValue={str(provider?.appTitle ?? 'سبزینه')} /></label>
      {provider && <label>وضعیت<select name="active" defaultValue={String(!!provider.active)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>}
    </AiForm>
  </AiDialog>
}

const poolFields = [
  ['temperature', 'دما', 0, 2, 0.05], ['maxTokens', 'سقف توکن خروجی', 200, 32000, 1],
  ['timeoutS', 'مهلت هر تلاش (ثانیه)', 5, 300, 1], ['maxAttempts', 'حداکثر تلاش', 1, 10, 1],
] as const

function MemberDialog({ providers, preview, close, add }: { providers: Row[]; preview: boolean; close: () => void; add: (member: Row) => void }) {
  const [providerId, setProviderId] = useState(str(providers[0]?.id))
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Row[]>(preview ? [{ id: sampleModel, name: sampleModel, priceInMicrosPerM: 6000, priceOutMicrosPerM: 500000 }] : [])
  const [loading, setLoading] = useState(!preview)
  const [failure, setFailure] = useState('')
  const source = providers.find(provider => str(provider.id) === providerId)
  const term = query.trim().toLowerCase()
  const shown = items.filter(model => !term || (str(model.id) + ' ' + str(model.name)).toLowerCase().includes(term))
  useEffect(() => {
    if (preview || !providerId) return
    let cancel = false
    setLoading(true)
    aiApi('providers/' + id(providerId) + '/models?limit=2000')
      .then(data => { if (!cancel) { setItems(itemRows(data)); setFailure('') } })
      .catch(error => { if (!cancel) { setItems([]); setFailure(errorText(error)) } })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [preview, providerId])
  return <AiDialog title="افزودن مدل به استخر" close={close}>
    <div className="ai-form ai-catalog">
      <label>سرویس<select value={providerId} onChange={event => { setProviderId(event.target.value); setQuery('') }}>
        {providers.map(provider => <option key={str(provider.id)} value={str(provider.id)}>{str(provider.name)}</option>)}
      </select></label>
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی مدل</span>
        <input type="search" placeholder="جست‌وجوی نام یا شناسهٔ مدل…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="ai-model-picker" role="listbox" aria-label="فهرست زندهٔ مدل‌ها">
        {loading && <p>در حال دریافت مدل‌ها و قیمت از سرویس…</p>}
        {!loading && failure && <p role="alert">{failure}</p>}
        {!loading && !failure && !shown.length && <p>مدلی با این عبارت پیدا نشد.</p>}
        {shown.map(model => {
          const key = str(model.id)
          return <button type="button" role="option" key={key} disabled={preview} onClick={() => add({ providerId, providerName: source?.name, model: key, enabled: true, weight: 1 })}>
            <bdi>{key}</bdi>
            <small className="ai-model-cost"><bdi dir="ltr">{modelCostLabel(model)}</bdi></small>
          </button>
        })}
      </div>
      <button type="button" className="secondary" onClick={close}>انصراف</button>
    </div>
  </AiDialog>
}

function PoolCard({ pool, providers, preview, refresh, notify, quotes }: { pool: Row; providers: Row[]; preview: boolean; refresh: () => Promise<unknown>; notify: (message: string) => void; quotes: QuoteBook }) {
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
        <div className="ai-row-info"><strong><bdi>{str(member.model)}</bdi></strong><small>{str(member.providerName)} · <bdi dir="ltr">{livePrice(quotes, str(member.providerId), str(member.model), preview, member)}</bdi></small></div>
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
  const providers = itemRows(providerQuery.data)
  const quotes = useCatalogQuotes(providers, preview || !providerQuery.data)
  if (!providerQuery.data || !poolQuery.data) return <AiLoad error={providerQuery.error || poolQuery.error} retry={() => void refresh()} />
  const pools = itemRows(poolQuery.data)
  const ordered = [...pools].sort((a, b) => Object.keys(poolTitles).indexOf(str(a.code)) - Object.keys(poolTitles).indexOf(str(b.code)))
  return <>
    {notice && <p className="info-note" role="status">{notice}</p>}
    <AiCard title="سرویس‌ها و کلیدها" description="هر سرویس یک نشانی و یک کلید دارد. مدل و قیمت لحظه‌ای را داخل استخر، از فهرست همان سایت انتخاب می‌کنید."
      action={<button type="button" onClick={() => setModal({ kind: 'edit' })}><Icon name="plus" />افزودن سرویس</button>}>
      {!providers.length && <p className="ai-feedback">هنوز سرویسی ثبت نشده است.</p>}
      {providers.map(provider => <ProviderRow key={str(provider.id)} provider={provider} edit={kind => setModal({ kind, provider })} />)}
    </AiCard>
    {ordered.map(pool => <PoolCard key={str(pool.code)} pool={pool} providers={providers} preview={preview} refresh={refresh} notify={setNotice} quotes={quotes} />)}
    {modal && <ProviderDialog selection={modal} preview={preview} close={() => setModal(null)} saved={message => {
      setModal(null); setNotice(message); void refresh()
    }} />}
  </>
}
