import Icon from '../../shared/ui/Icon'
import { ReleaseNotesContent } from './ReleaseNotesModal.jsx'

const formatDate = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))

export default function NotificationCenter({ notifications, visibleCount, isRead, onOpen, onLoadMore, detailNotification, onBack, mobile = false }) {
  if (mobile && detailNotification) return <div className="notification-mobile-detail">
    <button type="button" className="notification-back" onClick={onBack}>Voltar</button>
    <ReleaseNotesContent notification={detailNotification} />
  </div>

  return <div className="notification-center">
    <p className="notification-center-intro">Fique por dentro das novidades do Gestão Delivery.</p>
    {notifications.length === 0 && <p>Nenhuma notificação no momento.</p>}
    <ul className="notification-list">
      {notifications.slice(0, visibleCount).map((item) => {
        const read = isRead(item.id)
        return <li key={item.id} className="notification-list-item">
          <button type="button" className={read ? 'notification-item is-read' : 'notification-item is-unread'} aria-label={item.title} onClick={() => onOpen(item.id)}>
            <span className="notification-item-icon"><Icon name={item.type === 'release' ? 'bell' : 'details'} size={19} /></span>
            <span className="notification-item-copy">
              <strong>{item.title}</strong>
              <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
              <span className="notification-item-summary">{item.summary}</span>
              {!read && <span className="notification-unread-marker">Não lida</span>}
            </span>
          </button>
        </li>
      })}
    </ul>
    {visibleCount < notifications.length && <button type="button" className="notification-load-more" onClick={onLoadMore}>Ver mais notificações</button>}
  </div>
}
