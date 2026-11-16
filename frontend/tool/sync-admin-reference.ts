import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { runInNewContext } from 'node:vm'

// Pinned upstream assets; React owns rendering, navigation, and events.
const revision = '4c317b42364b96407558b47f4de7410a0f7821d5'
const root = fileURLToPath(new URL('../../', import.meta.url))
const frontend = fileURLToPath(new URL('../', import.meta.url))
const read = (path: string): Buffer => execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, maxBuffer: 20 * 1024 * 1024 })
const source = read('admin/ui.js').toString()
const metadata = source.slice(source.indexOf('const pageMeta = ') + 17, source.indexOf('const iconPaths = ')).trim().replace(/;$/, '')
const icons = source.slice(source.indexOf('const iconPaths = ') + 18, source.indexOf('function element(')).trim().replace(/;$/, '')
interface ReferencePage {
  title: string
  icon: string
  group: string
  description: string
}

function parseRecord<T>(expression: string, valid: (value: unknown) => value is T): Record<string, T> {
  const result: unknown = runInNewContext(`(${expression})`, {}, { timeout: 1000 })
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid reference data')
  const entries = Object.entries(result)
  if (!entries.every(([, value]) => valid(value))) throw new Error('Invalid reference entry')
  return Object.fromEntries(entries) as Record<string, T>
}

const data = {
  pages: parseRecord(metadata, (value): value is ReferencePage => {
    if (!value || typeof value !== 'object') return false
    return ['title', 'icon', 'group', 'description'].every(key => typeof (value as Record<string, unknown>)[key] === 'string')
  }),
  icons: parseRecord(icons, (value): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')),
}
mkdirSync(`${frontend}src/features/admin/data`, { recursive: true })
writeFileSync(`${frontend}src/features/admin/data/reference.json`, JSON.stringify(data, null, 2) + '\n')
mkdirSync(`${frontend}src/features/admin/styles`, { recursive: true })
const css = postcss.parse(read('admin/style.css').toString())
css.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
  rule.selectors = rule.selectors.map(selector => {
    if (selector === ':root' || selector === 'body' || selector === 'html') return '.admin-reference'
    return `.admin-reference ${selector.replace(/body\.menu-open/g, '.menu-open')}`
  })
})
css.walkDecls(decl => { decl.value = decl.value.replaceAll('/admin/fonts/', '/admin-assets/fonts/') })
writeFileSync(`${frontend}src/features/admin/styles/reference.css`, css.toString())
// Branding is owned by the approved current assets, not this legacy revision.
for (const path of ['fonts/Vazirmatn-Regular.ttf', 'fonts/Vazirmatn-Bold.ttf']) {
  mkdirSync(`${frontend}public/admin-assets/${path.includes('/') ? 'fonts' : ''}`, { recursive: true })
  writeFileSync(`${frontend}public/admin-assets/${path}`, read(`admin/${path}`))
}
