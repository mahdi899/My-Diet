import { useEffect, useId, useRef, useState } from 'react'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { display, type FoodRow } from './catalog'

function FoodPhotoPreview({ src, name, close }: { src: string; name: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [closing, setClosing] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return <dialog ref={dialog} className="food-photo-preview" data-closing={closing} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); setClosing(true) }}
    onClick={event => { if (event.target === event.currentTarget) setClosing(true) }}>
    <figure onAnimationEnd={event => {
      if (event.target === event.currentTarget && closing) close()
    }}>
      <button type="button" className="icon-button food-photo-close" autoFocus aria-label="بستن پیش‌نمایش عکس"
        onClick={() => setClosing(true)}><Icon name="close" /></button>
      {failed ? <p role="alert">دریافت عکس انجام نشد.</p>
        : <img src={src} alt={name} onError={() => setFailed(true)} />}
      <figcaption id={titleId}>{name}</figcaption>
    </figure>
  </dialog>
}

export function FoodImage({ food }: { food: FoodRow }) {
  const slug = String(food.slug ?? '')
  const filename = /^[a-z0-9_-]{1,80}$/.test(slug) ? slug + '.jpg' : ''
  const stored = typeof food.image === 'string' && /^\/(?!\/)/.test(food.image) ? food.image : ''
  const sources = [...new Set([stored, ...(filename ? ['/foods/' + filename, '/assets/foods/' + filename] : [])].filter(Boolean))]
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const source = sources[attempt]
  const name = display(food.nameFa)
  return source ? <>
    <button type="button" className="food-photo-trigger" aria-label={`بزرگ‌نمایی عکس ${name}`} aria-haspopup="dialog"
      onClick={() => setOpen(true)}>
      <img className="food-thumb" src={source} alt="" width={56} height={56}
        loading="lazy" onError={() => setAttempt(attempt + 1)} />
    </button>
    {open && <FoodPhotoPreview src={source} name={name} close={() => setOpen(false)} />}
  </> : <span className="food-thumb food-thumb-empty"><Icon name="clipboard" /></span>
}
