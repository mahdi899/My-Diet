import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { asRows } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AiBadge, AiCard, AiDialog, AiForm, AiLoad, AiNote, aiApi, errorText, id, itemRows, num, outcomes, poolTitles, str, usd, useAiData, type Row } from './AiUi'

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

function modelCostLabel(model: Row) {
  const inn = Number(model.priceInMicrosPerM ?? 0)
  const out = Number(model.priceOutMicrosPerM ?? 0)
  if (model.free === true || (inn === 0 && out === 0)) return 'رایگان'
  return `ورودی ${usd(inn, 3)}/M · خروجی ${usd(out, 3)}/M`
}

function ProviderRow({ provider, preview, edit, refresh, notify }: { provider: Row; preview: boolean; edit: (kind: 'edit' | 'delete') => void; refresh: () => Promise<unknown>; notify: (message: string) => void }) {
  const [adding, setAdding] = useState(false)
  const saved = asRows(provider.models)
  const remove = useMutation({
    mutationFn: (modelId: string) => aiApi('providers/' + id(provider.id) + '/models/' + id(modelId), 'DELETE'),
    onSuccess: async () => { notify('مدل از سرویس حذف شد.'); await refresh() },
  })
  return <div className="ai-provider" aria-busy={remove.isPending}>
    <div className="ai-row">
      <div className="ai-row-info"><strong>{str(provider.name)}</strong><small><bdi>{str(provider.baseUrl)}</bdi></small></div>
      <div className="ai-inline-actions"><AiBadge tone={provider.active ? 'good' : 'neutral'}>{provider.active ? 'فعال' : 'غیرفعال'}</AiBadge>
        <AiBadge tone="neutral">{kinds[str(provider.kind)] ?? str(provider.kind)}</AiBadge>
        <AiBadge tone={provider.hasKey ? 'good' : 'bad'}>{provider.hasKey ? `کلید ${str(provider.keyHint)}` : 'بدون کلید'}</AiBadge>
        <button type="button" disabled={preview} aria-label={`افزودن مدل به ${str(provider.name)}`} onClick={() => setAdding(true)}><Icon name="plus" />افزودن</button>
        <button type="button" className="secondary" onClick={() => edit('edit')}><Icon name="sliders" />ویرایش</button>
        <button type="button" className="secondary ai-danger" onClick={() => edit('delete')}><Icon name="trash" />حذف</button>
      </div>
    </div>
    {saved.length ? <ul className="ai-saved-models">
      {saved.map(model => <li key={str(model.id)}>
        <div className="ai-row-info"><strong><bdi>{str(model.model)}</bdi></strong>{str(model.name) && str(model.name) !== str(model.model) && <small>{str(model.name)}</small>}</div>
        <button type="button" className="secondary ai-danger" disabled={preview || remove.isPending} aria-label={`حذف ${str(model.model)}`} onClick={() => remove.mutate(str(model.id))}><Icon name="trash" />حذف</button>
      </li>)}
    </ul> : <p className="ai-saved-empty">هنوز مدلی به این سرویس اضافه نشده است.</p>}
    {remove.isError && <p className="ai-feedback" role="alert">{errorText(remove.error)}</p>}
    {adding && <AddModelDialog provider={provider} preview={preview} close={() => setAdding(false)} added={async message => { notify(message); await refresh() }} />}
  </div>
}

function AddModelDialog({ provider, preview, close, added }: { provider: Row; preview: boolean; close: () => void; added: (message: string) => Promise<unknown> }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState('')
  const [catalogTotal, setCatalogTotal] = useState(0)
  const owned = new Set(asRows(provider.models).map(model => str(model.model)))
  const term = query.trim().toLowerCase()
  const shown = items.filter(model => !term || (str(model.id) + ' ' + str(model.name)).toLowerCase().includes(term))
  const totalCount = catalogTotal || items.length
  const countLabel = term
    ? `${num(shown.length)} از ${num(totalCount)} مدل`
    : `${num(totalCount)} مدل`
  useEffect(() => {
    let cancelled = false
    aiApi('providers/' + id(provider.id) + '/models?limit=2000')
      .then(data => {
        if (!cancelled) {
          const rows = itemRows(data)
          setItems(rows)
          setCatalogTotal(Number.isFinite(Number(data.total)) ? Number(data.total) : rows.length)
          setFailure('')
        }
      })
      .catch(error => { if (!cancelled) setFailure(errorText(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider.id])
  async function choose(model: Row) {
    const key = str(model.id)
    setBusy(key)
    setFailure('')
    try {
      const price = (value: unknown) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0
      await aiApi('providers/' + id(provider.id) + '/models', 'POST', {
        model: key, name: str(model.name || key),
        priceInMicrosPerM: price(model.priceInMicrosPerM), priceOutMicrosPerM: price(model.priceOutMicrosPerM),
      })
      await added('مدل به سرویس اضافه شد.')
    } catch (error) {
      setFailure(errorText(error))
    } finally {
      setBusy('')
    }
  }
  return <AiDialog title={`افزودن مدل به ${str(provider.name)}`} close={close}>
    <div className="ai-form ai-catalog">
      <div className="ai-catalog-search">
        <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی مدل</span>
          <input type="search" placeholder="جست‌وجوی نام یا شناسهٔ مدل…" value={query} onChange={event => setQuery(event.target.value)} aria-describedby="ai-catalog-count" />
          {!loading && !failure && <span id="ai-catalog-count" className="ai-catalog-count">{countLabel}</span>}</label>
      </div>
      <div className="ai-model-picker" role="listbox" aria-label="مدل‌های موجود در سرویس">
        {loading && <p>در حال دریافت مدل‌ها از سرویس… (برای OpenRouter ممکن است تا یک دقیقه طول بکشد)</p>}
        {!loading && failure && <p role="alert">{failure}</p>}
        {!loading && !failure && !shown.length && <p>مدلی با این عبارت پیدا نشد.</p>}
        {shown.map(model => {
          const key = str(model.id)
          const taken = owned.has(key)
          const name = str(model.name)
          return <button type="button" role="option" key={key} aria-selected={taken} disabled={preview || taken || busy !== ''} onClick={() => void choose(model)}>
            <bdi>{key}</bdi>
            <small>{name && name !== key ? name : 'شناسهٔ مدل'}{taken ? ' · اضافه شده' : busy === key ? ' · در حال افزودن…' : ''}</small>
            <small className="ai-model-cost"><bdi dir="ltr">{modelCostLabel(model)}</bdi></small>
          </button>
        })}
      </div>
    </div>
  </AiDialog>
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

function PoolCard({ pool, providers, preview, refresh, notify }: { pool: Row; providers: Row[]; preview: boolean; refresh: () => Promise<unknown>; notify: (message: string) => void }) {
  const [draft, setDraft] = useState<Row[] | null>(null)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [availableModels, setAvailableModels] = useState<Row[]>([])
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
      if (task.kind === 'save') { setDraft(null); setSelectedProvider(''); setSelectedModel(''); }
      notify(task.kind === 'save' ? 'مدل‌های مربی ذخیره شدند.' : 'وضعیت سلامت بازنشانی شد.')
    },
  })

  const currentMember = members.find(m => m.id)
  
  return <AiCard title={poolTitles[str(pool.code)] ?? str(pool.title)} description={<>مربی <bdi>{str(pool.code)}</bdi></>}>
    <AiForm key={JSON.stringify([pool.strategy, pool.temperature, pool.maxTokens, pool.timeoutMs, pool.maxAttempts, pool.enabled])}
      preview={preview} label="ذخیرهٔ تنظیمات مربی" submit={async data => {
        await aiApi(endpoint, 'PUT', { strategy: data.get('strategy'), temperature: Number(data.get('temperature')),
          maxTokens: Number(data.get('maxTokens')), timeoutMs: Number(data.get('timeoutS')) * 1000, maxAttempts: Number(data.get('maxAttempts')), enabled: data.get('enabled') === 'true' })
        await refresh(); notify('تنظیمات مربی ذخیره شد.')
      }}>
      <div className="ai-pool-fields"><label>راهبرد انتخاب<select name="strategy" defaultValue={str(pool.strategy)}>
        {Object.entries(strategies).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {poolFields.map(([key, label, min, max, step]) => <label key={key}>{label}<input name={key} type="number" min={min} max={max} step={step}
          defaultValue={key === 'timeoutS' ? Math.round(Number(pool.timeoutMs) / 1000) : str(pool[key])} required /></label>)}
        <label>وضعیت<select name="enabled" defaultValue={String(!!pool.enabled)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
      </div>
    </AiForm>
    
    <div className="ai-pool-model-selector">
      <h3>مدل فعال این مربی</h3>
      {currentMember ? (
        <div className="ai-current-model">
          <div className="ai-row-info">
            <strong><bdi>{str(currentMember.model)}</bdi></strong>
            <small>{str(currentMember.providerName)}</small>
          </div>
          <button type="button" className="secondary" onClick={() => setDraft(members.filter(m => !m.id))}><Icon name="trash" />حذف مدل</button>
        </div>
      ) : <p className="ai-feedback">این مربی هنوز مدلی ندارد.</p>}
      
      <h4>انتخاب مدل جدید</h4>
      <div className="ai-model-form">
        <label>سرویس
          <select value={selectedProvider} onChange={(e) => {
            const providerId = e.target.value
            setSelectedProvider(providerId)
            setSelectedModel('')
            const source = providers.find(item => str(item.id) === providerId)
            setAvailableModels(asRows(source?.models).map(model => ({
              id: model.model, name: model.name, priceInMicrosPerM: model.priceInMicrosPerM, priceOutMicrosPerM: model.priceOutMicrosPerM,
            })))
          }}>
            <option value="">انتخاب سرویس</option>
            {providers.map(provider => <option key={str(provider.id)} value={str(provider.id)}>{str(provider.name)}</option>)}
          </select>
        </label>
        
        {selectedProvider && !availableModels.length && <p className="ai-hint">این سرویس هنوز مدلی ندارد. از دکمهٔ افزودن در ردیف سرویس، مدل را از فهرست سایت انتخاب کنید.</p>}
        {selectedProvider && !!availableModels.length && (
          <label>مدل
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="">انتخاب مدل</option>
              {availableModels.map(model => <option key={str(model.id)} value={str(model.id)}>{str(model.id)}</option>)}
            </select>
          </label>
        )}
        
        <button type="button" disabled={!selectedProvider || !selectedModel || action.isPending} onClick={() => {
          if (selectedProvider && selectedModel) {
            const provider = providers.find(p => str(p.id) === selectedProvider)
            const model = availableModels.find(m => str(m.id) === selectedModel)
            const priceIn = model?.priceInMicrosPerM != null ? Number(model.priceInMicrosPerM) : 0
            const priceOut = model?.priceOutMicrosPerM != null ? Number(model.priceOutMicrosPerM) : 0
            setDraft([{
              providerId: selectedProvider,
              providerName: str(provider?.name),
              model: selectedModel,
              enabled: true,
              weight: 1,
              priceInMicrosPerM: priceIn,
              priceOutMicrosPerM: priceOut,
            }])
          }
        }}><Icon name="plus" />انتخاب این مدل</button>
      </div>
    </div>

    <div className="ai-pool-tools">
      <button type="button" disabled={preview || !draft || action.isPending} onClick={() => action.mutate({ kind: 'save' })}><Icon name="check" />ذخیرهٔ مدل</button>
      <button type="button" className="secondary" disabled={preview || !currentMember || action.isPending} onClick={() => action.mutate({ kind: 'test' })}><Icon name="send" />تست مربی</button>
    </div>
    {action.isError && <p className="ai-feedback" role="alert">{errorText(action.error)}</p>}
    {action.data && <p className="ai-feedback" role="status">{action.data.ok ? 'مربی پاسخ داد.' : 'مربی پاسخی نگرفت.'} {asRows(action.data.chain).map(row => `${str(row.model)} · ${outcomes[str(row.outcome)] ?? str(row.outcome)}`).join('، ') || str(action.data.errorCode)}</p>}
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
    <AiCard title="سرویس‌ها و کلیدها" description="هر سرویس یک نشانی و یک کلید دارد. با افزودن، مدل‌های همان سایت را جست‌وجو و به سرویس وصل می‌کنید."
      action={<button type="button" onClick={() => setModal({ kind: 'edit' })}><Icon name="plus" />افزودن سرویس</button>}>
      {!providers.length && <p className="ai-feedback">هنوز سرویسی ثبت نشده است.</p>}
      {providers.map(provider => <ProviderRow key={str(provider.id)} provider={provider} preview={preview} refresh={refresh} notify={setNotice}
        edit={kind => setModal({ kind, provider })} />)}
    </AiCard>
    {ordered.map(pool => <PoolCard key={str(pool.code)} pool={pool} providers={providers} preview={preview} refresh={refresh} notify={setNotice} />)}
    {modal && <ProviderDialog selection={modal} preview={preview} close={() => setModal(null)} saved={message => {
      setModal(null); setNotice(message); void refresh()
    }} />}
  </>
}
