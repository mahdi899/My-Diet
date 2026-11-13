const paths: Record<string, string[]> = {
  grid: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  medical: ['M8 3H5a2 2 0 0 0-2 2v5a5 5 0 0 0 10 0V5a2 2 0 0 0-2-2', 'M18 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  clipboard: ['M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3', 'M9 2h6v4H9z'],
  wallet: ['M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15V8'],
  star: ['m12 3 2.78 5.63L21 9.53l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z'],
  message: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7'],
  headphones: ['M3 14v-3a9 9 0 0 1 18 0v3', 'M3 13h4v7H5a2 2 0 0 1-2-2v-5Z'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'],
  sparkles: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
  sliders: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3'],
  history: ['M3 12a9 9 0 1 0 2.7-6.4L3 8', 'M3 3v5h5M12 7v5l3 2'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z', 'M3 11h18'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['m6 6 12 12M6 18 18 6'],
  logout: ['M9 21H4V3h5M9 12h12m-4-4 4 4-4 4'],
  leaf: ['M12 22V10M12 15C3 15 1 8 2 3c8 0 12 4 10 12Z'],
  arrow: ['M19 12H5m6-6-6 6 6 6'],
  shield: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z'],
  check: ['m5 12 4 4L19 6'],
  plus: ['M12 5v14M5 12h14'],
}

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const draw = paths[name] ?? paths.grid ?? []
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {draw.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
