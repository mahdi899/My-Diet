import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { faDigits } from '../../domain/questionnaire'
import { Minus, Plus } from 'lucide-react'

function HoldButton({ direction, value, limit, onSelect, label, children }: {
  direction: -1 | 1
  value: number
  limit: number
  onSelect: (value: number) => void
  label?: string
  children: ReactNode
}) {
  const timer = useRef<number>()
  const repeated = useRef(false)
  const stop = () => window.clearTimeout(timer.current)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <button
      type="button"
      aria-label={[label, direction === 1 ? 'یک واحد بیشتر' : 'یک واحد کمتر'].filter(Boolean).join('، ')}
      aria-disabled={value === limit}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        stop()
        repeated.current = false
        if (value === limit) return
        event.currentTarget.setPointerCapture(event.pointerId)
        let next = value
        let delay = 115
        const repeat = () => {
          repeated.current = true
          next += direction
          onSelect(next)
          if (next === limit) return
          delay = Math.max(45, delay * .86)
          timer.current = window.setTimeout(repeat, delay)
        }
        timer.current = window.setTimeout(repeat, 300)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onBlur={stop}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (value !== limit && (event.detail === 0 || !repeated.current)) onSelect(value + direction)
        repeated.current = false
      }}
    >{children}</button>
  )
}

export function NumberWheel({ min, max, unit, value, onChange, label, clock = false }: {
  min: number
  max: number
  unit: string
  value: number
  onChange: (value: number) => void
  label?: string
  clock?: boolean
}) {
  const wheel = useRef<HTMLDivElement>(null)
  const initial = useRef(value)
  const drag = useRef<{ pointer: number; y: number; value: number; moved: boolean } | null>(null)
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  const clockPeriod = (number: number) => number === 0 ? 'نیمه‌شب' : number < 12 ? 'صبح' : number === 12 ? 'ظهر' : number < 18 ? 'عصر' : 'شب'
  const clockHour = (number: number) => faDigits(number % 12 || 12)
  const format = (number: number) => clock ? `${clockHour(number)} ${clockPeriod(number)}` : faDigits(number)

  function rowHeight() {
    return wheel.current?.firstElementChild?.getBoundingClientRect().height ?? 48
  }

  useLayoutEffect(() => {
    if (wheel.current) wheel.current.scrollTop = (initial.current - min) * rowHeight()
  }, [min])

  function select(number: number) {
    const next = Math.max(min, Math.min(max, number))
    if (wheel.current) wheel.current.scrollTop = (next - min) * rowHeight()
    onChange(next)
  }

  return (
    <div className="quiz-number-picker">
      <div className="quiz-number-controls">
        {!clock && <HoldButton direction={-1} value={value} limit={min} onSelect={select} label={label}><Minus size={19} /></HoldButton>}
        <div className="quiz-number-frame">
          <div className="quiz-number-highlight" aria-hidden="true"><span>{unit}</span></div>
        <div
          ref={wheel}
          className="quiz-number-wheel"
          role="spinbutton"
          tabIndex={0}
          aria-label={label}
          aria-labelledby={label ? undefined : 'quiz-question-title'}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${format(value)} ${unit}`.trim()}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button !== 0) return
            drag.current = { pointer: event.pointerId, y: event.clientY, value, moved: false }
          }}
          onPointerMove={(event) => {
            const gesture = drag.current
            if (!gesture || gesture.pointer !== event.pointerId || !(event.buttons & 1)) return
            const distance = gesture.y - event.clientY
            if (!gesture.moved && Math.abs(distance) < 5) return
            if (!gesture.moved) {
              gesture.moved = true
              event.currentTarget.setPointerCapture(event.pointerId)
            }
            const next = Math.max(min, Math.min(max, gesture.value + Math.round(distance / 22)))
            if (next !== value) select(next)
          }}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }}
          onLostPointerCapture={() => { drag.current = null }}
          onScroll={(event) => {
            const next = Math.max(min, Math.min(max, min + Math.round(event.currentTarget.scrollTop / rowHeight())))
            if (next !== value) onChange(next)
          }}
          onKeyDown={(event) => {
            const next = { ArrowUp: value + 1, ArrowDown: value - 1, PageUp: value + 10, PageDown: value - 10, Home: min, End: max }[event.key]
            if (next == null) return
            event.preventDefault()
            select(next)
          }}
        >
          {values.map((number) => (
            <div key={number} aria-hidden="true" className={number === value ? 'is-current' : undefined} onClick={() => select(number)}>
              {clock ? <span className="quiz-clock-time">{clockHour(number)} <small>{clockPeriod(number)}</small></span> : format(number)}
            </div>
          ))}
        </div>
        </div>
        {!clock && <HoldButton direction={1} value={value} limit={max} onSelect={select} label={label}><Plus size={19} /></HoldButton>}
      </div>
    </div>
  )
}
