import { useEffect, useRef, useState } from 'react'
import Modal from '../../shared/ui/Modal'
import Button from '../../shared/ui/Button'
import Icon from '../../shared/ui/Icon'

const formatDate = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
const releaseIcons = Object.freeze({
  orders: 'orders',
  clipboard: 'clipboard',
  notifications: 'bell',
  bell: 'bell',
  layout: 'system',
  window: 'system',
  navigation: 'menu',
  kitchen: 'chef-hat',
  pairing: 'shield',
  notes: 'note',
  realtime: 'clock',
  sound: 'volume-on',
  security: 'shield',
})

const resolveReleaseIcon = (key) => releaseIcons[key] ?? 'details'

export function ReleaseTour({ notification, automatic = false, onClose, onAcknowledge }) {
  const slides = notification.slides ?? []
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)
  const lastIndex = Math.max(0, slides.length - 1)
  const slide = slides[index] ?? slides[0]
  const last = index === lastIndex
  const canClose = typeof onClose === 'function'

  useEffect(() => setIndex(0), [notification.id])

  const previous = () => setIndex((value) => Math.max(0, value - 1))
  const next = () => setIndex((value) => Math.min(lastIndex, value + 1))
  const finish = () => {
    if (automatic) onAcknowledge?.()
    else onClose?.()
  }
  const skip = () => {
    if (automatic) onAcknowledge?.()
    else onClose?.()
  }

  const onTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null
  }
  const onTouchEnd = (event) => {
    const start = touchStart.current
    touchStart.current = null
    const end = event.changedTouches?.[0]?.clientX
    if (!Number.isFinite(start) || !Number.isFinite(end)) return
    const delta = end - start
    if (Math.abs(delta) < 42) return
    if (delta < 0 && !last) next()
    if (delta > 0 && index > 0) previous()
  }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight' && !last) next()
    if (event.key === 'ArrowLeft' && index > 0) previous()
  }

  if (!slide) return null
  const icon = resolveReleaseIcon(slide.icon)

  return <article
    className="release-tour"
    data-horizontal-interaction="true"
    onTouchStart={onTouchStart}
    onTouchEnd={onTouchEnd}
    onKeyDown={onKeyDown}
  >
    <div className="release-tour-heading">
      <div>
        <h3>{notification.title}</h3>
        <p>{notification.summary}</p>
      </div>
      <span className="release-tour-counter">Slide {index + 1} de {slides.length}</span>
    </div>

    <div className="release-tour-media" tabIndex={0} aria-label={`Slide ${index + 1} de ${slides.length}: ${slide.title}`}>
      <img src={slide.image} alt={slide.imageAlt} style={{ objectPosition: slide.imagePosition }} draggable="false" />
      {index > 0 && <button type="button" className="release-tour-media-nav is-previous" aria-label="Slide anterior" onClick={previous}>‹</button>}
      {!last && <button type="button" className="release-tour-media-nav is-next" aria-label="Próximo slide" onClick={next}>›</button>}
    </div>

    <div className="release-tour-copy">
      <span className="release-tour-icon" data-icon={icon}><Icon name={icon} size={21} /></span>
      <div className="release-tour-copy-text">
        <h4>{slide.title}</h4>
        <p>{slide.description}</p>
      </div>
    </div>

    <div className="release-tour-navigation">
      <div className="release-tour-left-action">
        {index > 0
          ? <Button type="button" variant="secondary" onClick={previous}>Anterior</Button>
          : automatic
            ? <Button type="button" variant="secondary" onClick={skip}>Pular</Button>
            : canClose
              ? <Button type="button" variant="secondary" onClick={skip}>Fechar</Button>
              : null}
      </div>
      <div className="release-tour-dots" aria-label="Progresso da apresentação">
        {slides.map((item, itemIndex) => <button
          key={item.title}
          type="button"
          className={`release-tour-dot${itemIndex === index ? ' is-active' : ''}`}
          aria-label={`Ir para slide ${itemIndex + 1}`}
          aria-current={itemIndex === index ? 'step' : undefined}
          onClick={() => setIndex(itemIndex)}
        />)}
      </div>
      <div className="release-tour-right-action">
        {!last && <Button type="button" onClick={next}>Próximo</Button>}
        {last && (automatic || canClose) && <Button type="button" onClick={finish}>{automatic ? 'Entendi' : 'Fechar'}</Button>}
      </div>
    </div>
  </article>
}

export function ReleaseNotesContent({ notification, showTitle = true }) {
  if (notification.slides?.length) return <ReleaseTour notification={notification} />

  return <article className="release-notes-content">
    <header className="release-notes-heading">
      {showTitle && <h3>{notification.title}</h3>}
      <time dateTime={notification.publishedAt}>{formatDate(notification.publishedAt)}</time>
    </header>
    <p className="release-notes-summary">{notification.summary}</p>
    <ul className="release-notes-list">
      {(notification.items ?? []).map((item, index) => {
        const icon = resolveReleaseIcon(item.icon)
        return <li key={`${item.title}-${index}`} className="release-notes-item">
          <span className="release-notes-item-icon" data-icon={icon}><Icon name={icon} size={20} /></span>
          <div className="release-notes-item-copy">
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        </li>
      })}
    </ul>
    <footer className="release-notes-brand">
      <span className="release-notes-brand-product"><Icon name="bolt" size={13} /> Gestão Delivery</span>
      <span className="release-notes-brand-divider" aria-hidden="true" />
      <span>sempre evoluindo com você</span>
    </footer>
  </article>
}

export default function ReleaseNotesModal({ notification, mode, onClose, onAcknowledge, onOpenHistory }) {
  if (!notification) return null
  const automatic = mode === 'automatic'
  const tour = Array.isArray(notification.slides) && notification.slides.length > 0

  return <Modal
    title={automatic ? 'Novidades do Gestão Delivery' : notification.title}
    onClose={onClose}
    className={tour ? 'release-notes-modal release-notes-tour-modal' : 'release-notes-modal'}
    footer={!tour && automatic ? <div className="release-notes-actions">
      <Button type="button" onClick={onAcknowledge}>Entendi</Button>
      <Button type="button" variant="secondary" onClick={onOpenHistory}>Ver histórico</Button>
    </div> : undefined}
  >
    {tour
      ? <ReleaseTour notification={notification} automatic={automatic} onClose={onClose} onAcknowledge={onAcknowledge} />
      : <ReleaseNotesContent notification={notification} showTitle={automatic} />}
  </Modal>
}
