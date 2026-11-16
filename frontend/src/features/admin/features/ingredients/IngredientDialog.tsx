import { useEffect, useRef, useState, type FormEvent } from 'react'
import { staff } from '../../session'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { foodError } from '../foods/catalog'

export type Ingredient = { code: string; nameFa: string; category: string; nutritionReference: string | null; recipeCount: number }
export const categories: Record<string, string> = { dairy: 'لبنیات', grains: 'غلات', other: 'سایر', pantry: 'خواربار', produce: 'سبزی و میوه', protein: 'پروتئین' }

export function IngredientDialog({ item, mode, preview, close, saved }: { item: Ingredient; mode: 'edit' | 'delete'; preview: boolean; close: () => void; saved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      const endpoint = `admin/ingredients/${encodeURIComponent(item.code)}`
      await staff.api(mode === 'edit' ? endpoint : endpoint + '/delete', mode === 'edit' ? 'PUT' : 'POST', mode === 'edit' ? { nameFa: data.get('nameFa'), category: data.get('category'), nutritionReference: data.get('nutritionReference') } : { confirmation: 'حذف ماده' })
      saved()
    } catch (cause) { setError(foodError(cause)) }
    finally { setBusy(false) }
  }
  return <dialog ref={ref} className="food-dialog ingredient-dialog" aria-labelledby="ingredient-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close() }}><header><h2 id="ingredient-dialog-title">{mode === 'edit' ? 'ویرایش مادهٔ اولیه' : 'حذف مادهٔ اولیه'}</h2><button type="button" className="icon-button" aria-label="بستن" disabled={busy} onClick={close}><Icon name="close" /></button></header><form onSubmit={submit}>
    {preview && <p className="info-note">این داده آزمایشی است؛ تغییرات ذخیره نمی‌شوند.</p>}
    {mode === 'edit' ? <><div className="food-editor-grid"><label>کد ماده<input value={item.code} readOnly dir="ltr" /></label><label>تعداد رسپی‌ها<input value={item.recipeCount.toLocaleString('fa-IR')} readOnly /></label><label>نام ماده<input name="nameFa" defaultValue={item.nameFa} required minLength={2} maxLength={160} /></label><label>دسته<select name="category" defaultValue={item.category}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label>مرجع تغذیه<textarea name="nutritionReference" defaultValue={item.nutritionReference ?? ''} rows={3} maxLength={2000} /></label>{item.recipeCount > 0 && <p className="info-note">این ماده مشترک است؛ ویرایش نام و دسته در غذاهای مرتبط نیز اعمال می‌شود.</p>}</> : <><p>مادهٔ «{item.nameFa}» حذف شود؟</p>{item.recipeCount > 0 && <p className="info-note">این ماده در {item.recipeCount.toLocaleString('fa-IR')} رسپی استفاده شده است. برای حذف، ابتدا آن را از رسپی‌ها حذف یا جایگزین کنید.</p>}</>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="actions"><button type="button" className="secondary" autoFocus={mode === 'delete'} disabled={busy} onClick={close}>انصراف</button><button type="submit" className={mode === 'delete' ? 'danger' : ''} disabled={busy || preview || (mode === 'delete' && item.recipeCount > 0)}>{busy ? 'در حال انجام…' : mode === 'edit' ? 'ذخیره تغییرات' : 'تأیید حذف'}</button></div>
  </form></dialog>
}
