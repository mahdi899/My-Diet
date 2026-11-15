import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { categories, costs, meals, seasons, foodPath, foodError, values, downloadFoodFile, type FoodRow } from './catalog'
import { IngredientRows, RecipeDetails, readIngredients } from './RecipeDetails'

function Dialog({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = ref.current; element?.showModal(); return () => element?.close() }, [])
  return <dialog ref={ref} className="food-dialog" aria-labelledby="food-dialog-title" onCancel={event => {
    event.preventDefault()
    if (!busy) close()
  }}>
    <header><h2 id="food-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="بستن" disabled={busy} onClick={close}><Icon name="close" /></button></header>
    {children}
  </dialog>
}

function Actions({ busy, preview, title, close }: { busy: boolean; preview: boolean; title: string; close: () => void }) {
  return <div className="actions"><button type="submit" disabled={busy || preview}>{busy ? 'در حال انجام…' : title}</button>
    <button type="button" className="secondary" disabled={busy} onClick={close}>انصراف</button></div>
}

async function jpeg(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('عکس JPG، PNG یا WebP تا ۸ مگابایت انتخاب کنید.')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('پردازش عکس انجام نشد.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    image.close()
  }
}

const numeric = [
  ['servingG', 'وزن پرس (گرم)', 0, '0.1'], ['kcal', 'انرژی (کیلوکالری)', 0, '1'],
  ['proteinG', 'پروتئین (گرم)', 0, '0.1'], ['carbsG', 'کربوهیدرات (گرم)', 0, '0.1'],
  ['fatG', 'چربی (گرم)', 0, '0.1'], ['fiberG', 'فیبر (گرم)', 0, '0.1'], ['prepMinutes', 'آماده‌سازی (دقیقه)', 30, '1'],
] as const
const split = (text: string) => text.split(/[,،|]/).map(value => value.trim()).filter(Boolean)

export function FoodEditor({ food, preview, close, saved }: { food: FoodRow | null; preview: boolean; close: () => void; saved: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recipe, setRecipe] = useState<FoodRow | null>(null)
  useEffect(() => {
    if (!food?.slug || preview) return
    let current = true
    staff.api(`${foodPath}/${encodeURIComponent(String(food.slug))}`).then(result => {
      if (current) setRecipe(asRecord(asRecord(result)?.recipe))
    }).catch(() => { if (current) setRecipe(null) })
    return () => { current = false }
  }, [food?.slug, preview])
  const [ingredients, setIngredients] = useState(() => readIngredients(food))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || preview) return
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    setBusy(true)
    setError('')
    try {
      if (!ingredients.length || ingredients.some(item => !item.name.trim() || !item.unit.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new Error('نام، مقدار مثبت و واحد هر ماده را کامل کنید.')
      if (!data.getAll('mealTypes').length) throw new Error('حداقل یک وعده را انتخاب کنید.')
      const slug = String(food?.slug ?? read('slug'))
      const file = data.get('photo')
      const nutritionValues = Object.fromEntries(numeric.map(([key]) => [key, key === 'servingG' && !read(key) ? null : Number(read(key))]))
      const nutritionChanged = food && (numeric.some(([key]) => key !== 'prepMinutes' && nutritionValues[key] !== food[key])
        || JSON.stringify(ingredients.map(item => [item.name, item.quantity, item.unit, item.category]))
          !== JSON.stringify(asRows(food.ingredients).map(item => [item.name, item.quantity, item.unit, item.category])))
      const tags = split(read('tags'))
      await staff.api(food ? `${foodPath}/${encodeURIComponent(slug)}` : foodPath, food ? 'PUT' : 'POST', {
        slug, nameFa: read('nameFa'), category: read('category'), mealTypes: data.getAll('mealTypes'), servingLabel: read('servingLabel'),
        ...nutritionValues, allergens: split(read('allergens')), tags: nutritionChanged ? tags.filter(tag => tag !== 'recipe_estimate') : tags,
        regions: split(read('regions')), seasons: data.getAll('seasons'), ingredients, costTier: Number(read('costTier')), active: read('active') === 'true',
        image: read('image') || null,
        ...(file instanceof File && file.size ? { imageData: await jpeg(file) } : {}),
        ...(food?.nutrition ? { nutrition: nutritionChanged ? null : food.nutrition } : {}),
      })
      saved(food ? 'غذا ذخیره شد.' : 'غذای جدید اضافه شد.')
    } catch (cause) { setError(foodError(cause)) }
    finally { setBusy(false) }
  }
  return <Dialog title={food ? `ویرایش «${food.nameFa}»` : 'غذای جدید'} busy={busy} close={close}>
    <form onSubmit={submit}>
      <div className="food-editor-grid">
        <label>نام فارسی<input name="nameFa" defaultValue={String(food?.nameFa ?? '')} required /></label>
        <label>شناسهٔ لاتین (slug)<input name="slug" dir="ltr" pattern="[a-z][a-z0-9_]{1,63}" defaultValue={String(food?.slug ?? '')} disabled={!!food} required /></label>
        <label>دسته<select name="category" defaultValue={String(food?.category ?? 'main')}>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        <label>پرس<input name="servingLabel" defaultValue={String(food?.servingLabel ?? '')} required /></label>
        <label>عکس غذا<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label>مسیر عکس موجود<input name="image" dir="ltr" defaultValue={String(food?.image ?? '')} /></label>
        {numeric.map(([key, name, fallback, step]) => <label key={key}>{name}<input type="number" name={key} min={0} step={step}
          defaultValue={String(food?.[key] ?? (key === 'servingG' ? '' : fallback))} required={key !== 'servingG'} /></label>)}
        <label>هزینه<select name="costTier" defaultValue={String(food?.costTier ?? 2)}>{Object.entries(costs).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        <label>وضعیت<select name="active" defaultValue={String(food?.active ?? true)}><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
        {([['allergens', 'آلرژن‌ها'], ['tags', 'برچسب‌ها'], ['regions', 'مناطق']] as const).map(([key, name]) => <label key={key}>{name} (با ویرگول)<input name={key} dir="ltr" defaultValue={values(food?.[key]).join(', ')} /></label>)}
      </div>
      {([['mealTypes', 'وعده‌ها', meals], ['seasons', 'فصل‌ها', seasons]] as const).map(([key, title, options]) =>
        <fieldset className="food-checks" key={key}><legend>{title}</legend>{Object.entries(options).map(([value, name]) =>
          <label key={value}><input name={key} type="checkbox" value={value} defaultChecked={values(food?.[key] ?? (key === 'mealTypes' ? ['lunch'] : [])).includes(value)} />{name}</label>)}</fieldset>)}
      <IngredientRows ingredients={ingredients} onChange={setIngredients} />
      {recipe && <RecipeDetails recipe={recipe} />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Actions busy={busy} preview={preview} title="ذخیره" close={close} />
    </form>
  </Dialog>
}

export function CatalogImport({ replace, preview, close, saved }: { replace: boolean; preview: boolean; close: () => void; saved: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState<{ foods: FoodRow[]; expectedRevision: string; operationId: string } | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || preview) return
    const file = new FormData(event.currentTarget).get('catalog')
    if (!(file instanceof File) || !file.size) return
    setBusy(true)
    setError('')
    try {
      if (!replace) {
        const result = asRecord(await staff.api(foodPath + '/import', 'POST', { csv: await file.text() }))
        saved(`${formatFaNumber(Number(result?.created ?? 0))} غذای جدید و ${formatFaNumber(Number(result?.updated ?? 0))} به‌روزرسانی شد.`)
      } else if (!prepared) {
        if (file.size > 2_000_000) throw new Error('حداکثر حجم فایل JSON دو مگابایت است.')
        const items = asRecord(JSON.parse(await file.text()))?.foods
        const foods = asRows(items)
        if (!Array.isArray(items) || !foods.length || foods.length !== items.length || foods.length > 1000 ||
          foods.some(food => typeof food.slug !== 'string' || !food.nameFa || !food.servingLabel || typeof food.kcal !== 'number' || !Number.isFinite(food.kcal) || !asRows(food.ingredients).length) ||
          new Set(foods.map(food => food.slug)).size !== foods.length) throw new Error('فهرست غذاها یا اطلاعات هر غذا کامل و معتبر نیست.')
        const result = asRecord(await staff.api(foodPath + '/revision'))
        if (typeof result?.revision !== 'string') throw new Error('نسخهٔ فعلی کاتالوگ دریافت نشد.')
        setPrepared({ foods, expectedRevision: result.revision, operationId: crypto.randomUUID() })
      } else {
        const result = asRecord(await staff.api(foodPath + '/replace', 'POST', prepared))
        const backupId = String(result?.backupId ?? prepared.operationId)
        try {
          const backup = await staff.api(`${foodPath}/backups/${encodeURIComponent(backupId)}`)
          downloadFoodFile(`food-catalog-backup-${backupId}.json`, JSON.stringify(backup, null, 2), 'application/json')
          saved(`${formatFaNumber(prepared.foods.length)} غذا جایگزین و پشتیبان دانلود شد.`)
        } catch {
          saved(`کاتالوگ جایگزین شد. دانلود پشتیبان انجام نشد. شناسهٔ پشتیبان: ${backupId}`)
        }
      }
    } catch (cause) { setError(foodError(cause)) }
    finally { setBusy(false) }
  }
  return <Dialog title={replace ? 'جایگزینی کاتالوگ غذا' : 'درون‌ریزی فایل CSV'} busy={busy} close={close}>
    <form onSubmit={submit}>
      <p className="info-note">{replace ? 'غذاهای فعلی با محتوای فایل جایگزین می‌شوند. نسخهٔ قبلی روی سرور پشتیبان‌گیری می‌شود.' : 'غذاهای دارای شناسهٔ یکسان به‌روز می‌شوند و غذاهای جدید اضافه می‌شوند.'}</p>
      <label>فایل {replace ? 'JSON' : 'CSV'}<input type="file" name="catalog" accept={replace ? '.json,application/json' : '.csv,text/csv'} required disabled={busy} onChange={() => { setPrepared(null); setError('') }} /></label>
      {prepared && <><p role="status">{formatFaNumber(prepared.foods.length)} غذا آمادهٔ جایگزینی است.</p>
        <ul className="food-replace-list">{prepared.foods.map(food => <li key={String(food.slug)}>{String(food.nameFa)} · {String(food.servingLabel)} · {formatFaNumber(Number(food.kcal))} kcal</li>)}</ul></>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Actions busy={busy} preview={preview} title={replace ? prepared ? 'تأیید جایگزینی کاتالوگ' : 'بررسی فایل' : 'درون‌ریزی'} close={close} />
    </form>
  </Dialog>
}
