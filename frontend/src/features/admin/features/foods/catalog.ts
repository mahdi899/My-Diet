import { asRecord } from '@shared/utils'
import { staff } from '../../session'

export const foodPath = 'admin/foods'
export type FoodRow = Record<string, unknown>
export const categories: Record<string, string> = {
  breakfast: 'صبحانه', main: 'غذای اصلی', side: 'مخلفات', soup: 'سوپ و آش', salad: 'سالاد',
  protein: 'پروتئین', carb: 'نان و غلات', dairy: 'لبنیات', fruit: 'میوه', snack: 'میان‌وعده', drink: 'نوشیدنی', dessert: 'دسر',
}
export const meals: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' }
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
  ['ab_havij', 'آب‌هویج تازه', 'drink', ['snack'], '۱ لیوان', 90, 2, 20, 0, []],
  ['adasi', 'عدسی', 'breakfast', ['breakfast', 'lunch', 'dinner'], '۱ کاسه (۳۰۰ گرم) با نان', 290, 14, 42, 7, ['gluten']],
  ['adas_polo', 'عدس‌پلو', 'main', ['lunch', 'dinner'], '۱ پرس با کشمش و ماست', 600, 18, 102, 13, []],
  ['albaloo_polo_morgh', 'آلبالوپلو با مرغ', 'main', ['lunch', 'dinner'], '۱ ران مرغ + ۱٫۵ کفگیر برنج', 700, 36, 86, 22, []],
  ['anar', 'انار', 'fruit', ['snack'], '۱ عدد متوسط', 130, 3, 29, 2, []],
  ['angoor', 'انگور', 'fruit', ['snack'], '۱ خوشه کوچک', 100, 1, 26, 0, []],
].map(([slug, nameFa, category, mealTypes, servingLabel, kcal, proteinG, carbsG, fatG, allergens], index) => ({
  slug, nameFa, category, mealTypes, servingLabel, kcal, proteinG, carbsG, fatG, allergens,
  costTier: index === 3 ? 2 : 1, active: index !== 5,
}))
