import Modal from '../../shared/ui/Modal'
import Button from '../../shared/ui/Button'

const formatDate = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))

export function ReleaseNotesContent({ notification }) {
  return <article className="release-notes-content">
    <time dateTime={notification.publishedAt}>{formatDate(notification.publishedAt)}</time>
    <h3>{notification.title}</h3>
    <p>{notification.summary}</p>
    {Array.isArray(notification.sections) && notification.sections.map((section, index) => <section key={`${section.title}-${index}`}>
      <h4>{section.title}</h4>
      <p>{section.body}</p>
    </section>)}
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
    <ReleaseNotesContent notification={notification} />
    {automatic && <p className="release-notes-once">Este aviso será exibido apenas uma vez neste dispositivo.</p>}
  </Modal>
}
