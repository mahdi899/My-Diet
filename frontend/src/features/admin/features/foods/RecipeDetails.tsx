import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import type { FoodRow } from './catalog'
import { AdminIcon as Icon } from '../../components/AdminIcon'

export interface RecipeIngredient { name: string; quantity: number; unit: string; category: string }
export const ingredientGroups: Record<string, string> = { produce: 'میوه و سبزی', dairy: 'لبنیات', protein: 'پروتئین', grains: 'غلات', pantry: 'چاشنی و مواد انباری', other: 'سایر' }

export function IngredientRows({ ingredients, onChange }: { ingredients: RecipeIngredient[]; onChange: (next: RecipeIngredient[]) => void }) {
  const update = (index: number, patch: Partial<RecipeIngredient>) => onChange(ingredients.map((item, i) => i === index ? { ...item, ...patch } : item))
  return <section className="recipe-ingredients"><div className="recipe-section-heading"><div><h3>مواد اولیهٔ هر سهم</h3><p>مقدارها برای یک نفر هستند.</p></div><button type="button" className="secondary" onClick={() => onChange([...ingredients, { name: '', quantity: 1, unit: 'g', category: 'other' }])}><Icon name="plus" />افزودن ماده</button></div>
    {ingredients.map((item, index) => <div className="recipe-ingredient-row" key={index}>
      <label><span className="sr-only">نام ماده {index + 1}</span><input required maxLength={160} value={item.name} placeholder="نام ماده" onChange={event => update(index, { name: event.target.value })} /></label>
      <label><span className="sr-only">مقدار ماده {index + 1}</span><input type="number" min="0.00001" step="any" required dir="ltr" value={Number(item.quantity.toFixed(5))} onChange={event => update(index, { quantity: Number(event.target.value) })} /></label>
      <label><span className="sr-only">واحد ماده {index + 1}</span><input required value={item.unit} aria-label={`واحد ماده ${index + 1}`} dir="ltr" onChange={event => update(index, { unit: event.target.value })} /></label>
      <label><span className="sr-only">گروه ماده {index + 1}</span><select value={item.category} onChange={event => update(index, { category: event.target.value })}>{Object.entries(ingredientGroups).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" className="recipe-remove" aria-label={`حذف ${item.name || 'ماده'}`} disabled={ingredients.length === 1} onClick={() => onChange(ingredients.filter((_, i) => i !== index))}><Icon name="close" /></button>
    </div>)}
  </section>
}

export function readIngredients(food: FoodRow | null): RecipeIngredient[] {
  const rows = asRows(food?.ingredients)
  return rows.map(item => ({ name: String(item.name ?? ''), quantity: Number(item.quantity ?? 1), unit: String(item.unit ?? 'g'), category: String(item.category ?? 'other') }))
}

export function RecipeDetails({ recipe }: { recipe: FoodRow }) {
  const metadata = asRecord(recipe.metadata) ?? {}
  const paragraphs = String(recipe.instructions ?? '').trim().split(/\n\s*\n/)
  const steps = (paragraphs.shift() ?? '').split(/\n(?=\d+\.\s)/).map(step => step.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
  const microSection = String(recipe.sourceMarkdown ?? '').match(/### ۲۴ شاخص[^\n]*\n([\s\S]*?)(?=\n### |$)/)?.[1] ?? ''
  const nutrients = microSection.split('\n').filter(line => line.startsWith('|') && !line.includes('---')).slice(1).map(line => line.split('|').slice(1, -1).map(cell => cell.trim())).filter(cells => cells.length === 4)
  return <section className="recipe-details"><div className="recipe-section-heading"><h3>دستور پخت</h3><span>{formatFaNumber(Number(recipe.cookMinutes))} دقیقه پخت · {formatFaNumber(Number(recipe.servings))} سهم در رسپی اصلی</span></div>
    <ol className="recipe-steps">{steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    {paragraphs.length > 0 && <details className="recipe-extra"><summary>نکته‌های تهیه</summary>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>}
    {!!metadata['منطقه غذا در ایران'] && <p className="recipe-region"><strong>منطقه: </strong>{String(metadata['منطقه غذا در ایران'])}</p>}
    {nutrients.length > 0 && <details className="recipe-extra"><summary>ریز‌مغذی‌های برآوردی ({formatFaNumber(nutrients.length)} شاخص)</summary><p>مقادیر تخمینی‌اند و حاصل آزمایش این غذا نیستند.</p><div className="recipe-nutrients"><table><thead><tr><th>شاخص</th><th>هر سهم</th><th>در ۱۰۰ گرم</th></tr></thead><tbody>{nutrients.map(([label, , serving, per100]) => <tr key={label}><td>{label}</td><td>{serving}</td><td>{per100}</td></tr>)}</tbody></table></div></details>}
  </section>
}
