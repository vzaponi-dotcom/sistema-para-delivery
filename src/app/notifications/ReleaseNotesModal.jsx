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
})

const resolveReleaseIcon = (key) => releaseIcons[key] ?? 'details'

export function ReleaseNotesContent({ notification, showTitle = true }) {
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
  return <Modal
    title={automatic ? 'Novidades do Gestão Delivery' : notification.title}
    onClose={onClose}
    className="release-notes-modal"
    footer={automatic ? <div className="release-notes-actions">
      <Button type="button" onClick={onAcknowledge}>Entendi</Button>
      <Button type="button" variant="secondary" onClick={onOpenHistory}>Ver histórico</Button>
    </div> : undefined}
  >
    <ReleaseNotesContent notification={notification} showTitle={false} />
    {automatic && <p className="release-notes-once">Este aviso será exibido apenas uma vez neste dispositivo.</p>}
  </Modal>
}
