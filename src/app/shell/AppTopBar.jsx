import Icon from '../../shared/ui/Icon'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import OperationMenu from './OperationMenu.jsx'
import OperationLogo from './OperationLogo.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, businessName, businessHasLogo = false, businessLogoVersion = null, onLogout, logoutDisabled = false }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const operationName = String(businessName || '').trim() || 'Operação'
  const brandTitle = mobile ? 'Mesiva' : operationName
  const brandSubtitle = mobile ? 'Seu delivery no controle' : 'Gestão do delivery'

  return <header className="app-topbar">
    <div className="app-topbar-brand" aria-label={`${brandTitle}, ${brandSubtitle}`}>
      <span className="app-topbar-brand-icon" aria-hidden="true">
        {mobile
          ? <Icon name="meal" size={23} />
          : <OperationLogo
              hasLogo={businessHasLogo}
              version={businessLogoVersion}
              className="app-topbar-operation-logo"
              fallback={<Icon name="meal" size={23} />}
            />}
      </span>
      <span className="app-topbar-brand-copy">
        <strong>{brandTitle}</strong>
        <span className="app-topbar-brand-subtitle">{brandSubtitle}</span>
      </span>
    </div>
    <div className="app-topbar-actions">
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu
        businessName={operationName}
        businessHasLogo={businessHasLogo}
        businessLogoVersion={businessLogoVersion}
        showLogo={mobile}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  </header>
}
