import Icon from '../../shared/ui/Icon'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import OperationMenu from './OperationMenu.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, onLogout, logoutDisabled = false }) {
  return <header className="app-topbar">
    <div className="app-topbar-brand" aria-label="Gestão Delivery">
      <span className="app-topbar-brand-icon" aria-hidden="true"><Icon name="meal" size={23} /></span>
      <span className="app-topbar-brand-copy">
        <strong>Gestão Delivery</strong>
        <span className="app-topbar-brand-subtitle">Seu delivery no controle</span>
      </span>
    </div>
    <div className="app-topbar-actions">
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  </header>
}
