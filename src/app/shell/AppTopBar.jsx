import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { AREA_LABELS, destinationById } from '../navigation/registry.js'
import OperationMenu from './OperationMenu.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, businessName, businessHasLogo = false, businessLogoVersion = null, onLogout, logoutDisabled = false }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const { activeTab } = useNavigation()
  const destination = destinationById.get(activeTab)
  const operationName = String(businessName || '').trim() || 'Operação'
  const areaLabel = AREA_LABELS[destination?.area] || destination?.label || 'Início'

  return <header className="app-topbar">
    {mobile
      ? <div className="app-topbar-brand"><img src="/brand/mesiva-logo.svg" alt="Mesiva" width="160" height="52" /></div>
      : <div className="app-topbar-context" aria-label={`Localização: ${areaLabel}`}><span>{destination?.area === 'finance' ? 'Gestão' : 'Operação'}</span><span aria-hidden="true">/</span><strong>{areaLabel}</strong></div>}
    <div className="app-topbar-actions">
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu
        businessName={operationName}
        businessHasLogo={businessHasLogo}
        businessLogoVersion={businessLogoVersion}
        onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  </header>
}
