import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AiBadge, AiCard, AiDialog, AiForm, AiLoad, AiNote, aiApi, date, id, itemRows, num, str, useAiData, versionTitles, type Row } from './AiUi'

const demo = { items: Object.keys(versionTitles).map(key => ({
  key, version: 1, status: 'active', notes: 'نسخهٔ پایهٔ آزمایشی', createdAt: '2026-11-08T19:00:00Z',
  systemPrompt: 'براساس داده‌های معتبر و قواعد ایمنی، پاسخ ساختاریافته ارائه کن.',
  userTemplate: '{{profile}}',
})) }
type PromptModal = { kind: 'create' | 'view' | 'activate'; key: string; version?: Row }

function PromptTest({ promptKey, preview }: { promptKey: string; preview: boolean }) {
  const test = useMutation({ mutationFn: () => aiApi('prompts/' + id(promptKey) + '/test', 'POST') })
  return <div className="ai-feedback" aria-live="polite">
    <button type="button" className="secondary" disabled={preview || test.isPending} onClick={() => test.mutate()}>{test.isPending ? 'در حال تست واقعی…' : 'تست پرامپت با داده آزمایشی'}</button>
    {test.isError && <p role="alert">{test.error.message}</p>}
    {test.data && <><p>پاسخ معتبر از <bdi>{str(test.data.model)}</bdi> دریافت شد.</p><p dir="auto">{str(test.data.answer)}</p></>}
  </div>
}

export function AiPrompts({ preview }: { preview: boolean }) {
  const query = useAiData('prompts', demo, preview)
  const [modal, setModal] = useState<PromptModal | null>(null)
  const [notice, setNotice] = useState('')
  if (!query.data) return <AiLoad error={query.error} retry={() => void query.refetch()} />
  const close = () => setModal(null)
  function saved(message: string) { close(); setNotice(message); void query.refetch() }
  const rows = itemRows(query.data)
  return <>
    {notice && <p className="info-note" role="status">{notice}</p>}
    {Object.entries(versionTitles).map(([key, title]) => {
      const versions = rows.filter(row => row.key === key)
      const active = versions.find(row => row.status === 'active')
      return <AiCard key={key} title={title} description={active ? `فعال: نسخهٔ ${num(active.version)}` : 'نسخهٔ فعالی وجود ندارد.'}
        action={<button type="button" onClick={() => setModal({ kind: 'create', key, version: active })}><Icon name="plus" />نسخهٔ جدید</button>}>
        {!versions.length && <p className="ai-feedback">هنوز نسخه‌ای ثبت نشده است.</p>}
        {active && <PromptTest promptKey={key} preview={preview} />}
        {versions.map(version => <div className="ai-row" key={str(version.version)}>
          <div className="ai-row-info"><strong>نسخهٔ {num(version.version)}</strong><small>{date(version.createdAt)}{version.notes ? ' · ' + str(version.notes) : ''}</small></div>
          <div className="ai-inline-actions"><AiBadge tone={version.status === 'active' ? 'good' : 'neutral'}>{version.status === 'active' ? 'فعال' : version.status === 'draft' ? 'پیش‌نویس' : 'بازنشسته'}</AiBadge>
            <button type="button" className="secondary" onClick={() => setModal({ kind: 'view', key, version })}>مشاهده</button>
            {version.status !== 'active' && <button type="button" className="secondary" onClick={() => setModal({ kind: 'activate', key, version })}>فعال‌سازی</button>}
          </div>
        </div>)}
      </AiCard>
    })}
    {(modal?.kind === 'create' || modal?.kind === 'view') && <AiDialog title={modal.kind === 'view' ? `ویرایش نسخهٔ ${num(modal.version?.version)} · ${versionTitles[modal.key]}` : `نسخهٔ جدید · ${versionTitles[modal.key]}`} close={close}>
      <AiForm preview={preview} close={close} label="ذخیره به‌عنوان نسخهٔ جدید" submit={async form => {
        await aiApi('prompts/' + id(modal.key), 'POST', { systemPrompt: form.get('systemPrompt'), userTemplate: form.get('userTemplate'), notes: form.get('notes') })
        saved('نسخهٔ جدید ذخیره شد.')
      }}>
        <label>پرامپت سیستم<textarea name="systemPrompt" rows={10} defaultValue={str(modal.version?.systemPrompt)} required /></label>
        <label>قالب پیام کاربر<textarea name="userTemplate" rows={8} dir="ltr" defaultValue={str(modal.version?.userTemplate)} required />
          <small>جاگذارهایی مانند {'{{profile}}'} را حفظ کنید.</small></label>
        <label>یادداشت تغییر<input name="notes" defaultValue={modal.kind === 'view' ? str(modal.version?.notes) : ''} /></label>
        <AiNote>نسخهٔ تازه تا زمان فعال‌سازی در تولید پیش‌نویس استفاده نمی‌شود.</AiNote>
      </AiForm>
    </AiDialog>}
    {modal?.kind === 'activate' && <AiDialog title="فعال‌سازی نسخهٔ پرامپت" close={close}>
      <AiForm preview={preview} close={close} label="فعال‌سازی" submit={async () => {
        await aiApi(`prompts/${id(modal.key)}/${id(modal.version?.version)}/activate`, 'POST')
        saved('نسخه فعال شد.')
      }}><AiNote>نسخهٔ {num(modal.version?.version)} برای {versionTitles[modal.key]} فعال می‌شود.</AiNote></AiForm>
    </AiDialog>}
  </>
}
