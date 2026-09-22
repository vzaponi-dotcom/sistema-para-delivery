import { useState } from 'react'
import BottomSheet from '../../shared/ui/BottomSheet'
import Icon from '../../shared/ui/Icon'
import Modal from '../../shared/ui/Modal'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import { useNotifications } from './useNotifications.js'
import NotificationCenter from './NotificationCenter.jsx'
import ReleaseNotesModal from './ReleaseNotesModal.jsx'
import '../../notification-center.css'

export default function NotificationsEntryPoint(props) {
  if (!String(props.businessId || '').trim()) return null
  return <ScopedNotificationsEntryPoint {...props} />
}

function ScopedNotificationsEntryPoint({ businessId, catalog, storage }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const { notifications, unreadCount, automaticNotification, isRead, markPresented, markRead } = useNotifications({ businessId, catalog, storage })
  const [centerOpen, setCenterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const selected = notifications.find((item) => item.id === selectedId) ?? null
  const bellLabel = unreadCount === 0 ? 'Notificações' : `Notificações, ${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`

  const closeCenter = () => { setCenterOpen(false); setSelectedId(null); setVisibleCount(20) }
  const openNotification = (id) => { markRead(id); setSelectedId(id) }
  const openHistory = () => { markPresented(automaticNotification.id); setCenterOpen(true) }
  const content = <NotificationCenter
    notifications={notifications}
    visibleCount={visibleCount}
    isRead={isRead}
    onOpen={openNotification}
    onLoadMore={() => setVisibleCount((count) => count + 20)}
    detailNotification={selected}
    mobile={mobile}
  />

  return <>
    <button type="button" className="notification-bell icon-button icon-button-neutral" aria-label={bellLabel} aria-haspopup="dialog" aria-expanded={centerOpen} onClick={() => setCenterOpen(true)}>
      <Icon name="bell" size={21} />
      {unreadCount > 0 && <span className="notification-bell-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {mobile
      ? <BottomSheet open={centerOpen} title="Notificações" onClose={closeCenter}>{content}</BottomSheet>
      : centerOpen && <Modal title="Notificações" onClose={closeCenter} className="notification-center-drawer" backdropClassName="notification-center-backdrop">{content}</Modal>}
    {!mobile && selected && <ReleaseNotesModal notification={selected} mode="detail" onClose={() => setSelectedId(null)} />}
    {automaticNotification && <ReleaseNotesModal notification={automaticNotification} mode="automatic" onClose={() => markPresented(automaticNotification.id)} onAcknowledge={() => markRead(automaticNotification.id)} onOpenHistory={openHistory} />}
  </>
}
