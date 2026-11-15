import { asRecord } from '@shared/utils'
import { staff } from '../../session'

export const foodPath = 'admin/foods'
export type FoodRow = Record<string, unknown>
export const categories: Record<string, string> = {
  breakfast: 'صبحانه', main: 'غذای اصلی', side: 'مخلفات', soup: 'سوپ و آش', salad: 'سالاد',
  protein: 'پروتئین', carb: 'نان و غلات', dairy: 'لبنیات', fruit: 'میوه', snack: 'میان‌وعده', drink: 'نوشیدنی', dessert: 'دسر',
}
export const meals: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده', side: 'کنار غذا' }
export const costs: Record<string, string> = { 1: 'ارزان', 2: 'متوسط', 3: 'گران' }
export const seasons = { spring: 'بهار', summer: 'تابستان', autumn: 'پاییز', winter: 'زمستان' }
export const values = (input: unknown) => Array.isArray(input) ? input.map(String) : []
export const display = (input: unknown) => String(input ?? '') || '—'
export const foodError = (cause: unknown) => cause instanceof Error ? cause.message : 'عملیات انجام نشد.'

export function downloadFoodFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportFoodFile(kind: 'csv' | 'json') {
  if (kind === 'json') {
    downloadFoodFile('food-catalog-backup.json', JSON.stringify(await staff.api(foodPath + '/export.json'), null, 2), 'application/json')
    return
  }
  const result = asRecord(await staff.api(foodPath + '/export'))
  if (typeof result?.csv !== 'string') throw new Error('خروجی CSV معتبر نیست.')
  downloadFoodFile('sabzine-foods.csv', result.csv, 'text/csv;charset=utf-8')
}

export const sampleFoods: FoodRow[] = [
  ['ir_0001', 'نان نخودچی', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۳۱ گرم', 176, 3.9, 18.2, 9.8, []],
  ['ir_0002', 'نان برنجی کرمانشاهی', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۳۷ گرم', 187, 1.6, 24.6, 9.2, []],
  ['ir_0003', 'نان پنجره‌ای', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۳۷ گرم', 113, 2.3, 13.6, 5.4, []],
  ['ir_0004', 'قطاب گردویی خانگی', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۳۹ گرم', 185, 3.2, 20.7, 10.3, ['nuts']],
  ['ir_0005', 'کلمپه خرمایی کرمان', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۶۱ گرم', 271, 4.2, 35.2, 13.6, []],
  ['ir_0006', 'کماج سهن کرمان', 'dessert', ['snack', 'side'], 'یک سهم؛ حدود ۶۰ گرم', 238, 4.6, 35, 10.2, []],
].map(([slug, nameFa, category, mealTypes, servingLabel, kcal, proteinG, carbsG, fatG, allergens], index) => ({
  slug, nameFa, category, mealTypes, servingLabel, kcal, proteinG, carbsG, fatG, allergens,
  costTier: index === 3 ? 2 : 1, active: index !== 5,
}))
