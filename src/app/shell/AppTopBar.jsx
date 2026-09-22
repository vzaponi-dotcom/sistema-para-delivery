import Icon from '../../shared/ui/Icon'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import OperationMenu from './OperationMenu.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, onLogout, logoutDisabled = false }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const brandTitle = mobile ? 'Gestão Delivery' : 'Amor & Sabor'
  const brandSubtitle = mobile ? 'Seu delivery no controle' : 'Gestão do delivery'

  return <header className="app-topbar">
    <div className="app-topbar-brand" aria-label={`${brandTitle}, ${brandSubtitle}`}>
      <span className="app-topbar-brand-icon" aria-hidden="true"><Icon name="meal" size={23} /></span>
      <span className="app-topbar-brand-copy">
        <strong>{brandTitle}</strong>
        <span className="app-topbar-brand-subtitle">{brandSubtitle}</span>
      </span>
    </div>
    <div className="app-topbar-actions">
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  </header>
}
