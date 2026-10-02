import { useState } from 'react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery.js'
import Icon from '../../shared/ui/Icon.jsx'
import { useTheme } from './theme/themeContext.js'
import { resolveTheme } from './theme/theme.js'
import NotificationsEntryPoint from '../notifications/NotificationsEntryPoint.jsx'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { AREA_LABELS, destinationById } from '../navigation/registry.js'
import OperationMenu from './OperationMenu.jsx'
import '../../app-top-bar.css'

export default function AppTopBar({ businessId, businessName, businessHasLogo = false, businessLogoVersion = null, user, onSwitchCompany, onPlatform, onSwitchUser, onLogout, logoutDisabled = false }) {
  const mobile = useMediaQuery('(max-width: 820px)')
  const { activeTab, granted } = useNavigation()
  const { themePreference, setThemePreference } = useTheme()
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = resolveTheme(themePreference, prefersDark) === 'dark'
  const [themeError, setThemeError] = useState(false)
  const themeAction = dark ? 'Ativar tema claro' : 'Ativar tema escuro'
  const destination = destinationById.get(activeTab)
  const operationName = String(businessName || '').trim() || 'Operação'
  const areaLabel = AREA_LABELS[destination?.area] || destination?.label || 'Início'

  return <header className="app-topbar">
    {mobile
      ? <div className="app-topbar-brand"><img src="/brand/mesiva-logo.svg" alt="Mesiva" width="160" height="52" /></div>
      : <div className="app-topbar-context" aria-label={`Localização: ${areaLabel}`}><span>{destination?.area === 'finance' ? 'Gestão' : 'Operação'}</span><span aria-hidden="true">/</span><strong>{areaLabel}</strong></div>}
    <div className="app-topbar-actions">
      {granted?.has('preferences.local') && <div className="app-theme-control">
        <button type="button" className="app-theme-toggle" aria-label={themeAction} title={themeAction} onClick={() => setThemeError(setThemePreference(dark ? 'light' : 'dark') === false)}>
          <Icon name={dark ? 'sun' : 'moon'} size={20} />
        </button>
        {themeError && <span className="app-theme-error" role="alert">Não foi possível salvar o tema neste dispositivo. Tente novamente.</span>}
      </div>}
      <NotificationsEntryPoint businessId={businessId} />
      <OperationMenu
        businessName={operationName}
        businessHasLogo={businessHasLogo}
        businessLogoVersion={businessLogoVersion}
        user={user} onSwitchCompany={onSwitchCompany} onPlatform={onPlatform} onSwitchUser={onSwitchUser} onLogout={onLogout}
        logoutDisabled={logoutDisabled}
      />
    </div>
  </header>
}
