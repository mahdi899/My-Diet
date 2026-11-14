import reference from '../data/reference.json'

export function AdminIcon({ name, className = 'icon' }: { name: string; className?: string }) {
  const icons: Record<string, string[]> = reference.icons
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>{(icons[name === 'arrow' ? 'arrow-left' : name] ?? icons.grid ?? []).map(path => <path key={path} d={path} />)}</svg>
}
