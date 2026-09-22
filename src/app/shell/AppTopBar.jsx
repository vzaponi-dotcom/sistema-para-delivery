import Icon from '../../shared/ui/Icon'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import OperationMenu from './OperationMenu.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, onLogout, logoutDisabled = false }) {
  return <header className="app-topbar">
    <div className="app-topbar-brand" aria-label="Gestão Delivery">
      <Icon name="meal" size={20} />
      <strong>Gestão Delivery</strong>
    </div>
    <div className="app-topbar-actions">
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu onLogout={onLogout} logoutDisabled={logoutDisabled} />
    </div>
  </header>
}
