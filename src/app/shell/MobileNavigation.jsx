import '../../mobile-navigation.css'
import BottomSheet from '../../shared/ui/BottomSheet'
import Icon from '../../shared/ui/Icon'
import { MOBILE_DIRECT_ENTRIES, MOBILE_MORE_ENTRIES, destinationById } from '../navigation/registry.js'
import { resolveNavigationEntry } from '../navigation/resolution.js'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { getNavigationBadge } from './navigationBadges.js'
import '../../navigation-badges.css'

function MobileNavigation({ onLogout, logoutDisabled = false, badges = {} }) {
  const { activeTab, activeMobileEntry, granted, implemented, moreOpen, requestNavigation, openMore, closeMore } = useNavigation()
  const directItems = MOBILE_DIRECT_ENTRIES.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean)
  const moreItems = MOBILE_MORE_ENTRIES.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean)
  const currentEntry = activeMobileEntry || destinationById.get(activeTab)?.mobileEntry
  const moreActive = currentEntry === 'more'
  return <>
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {directItems.map((item) => { const active = currentEntry === (item.area || item.id); const badge = getNavigationBadge(item, badges); return <button key={item.id} type="button" className={active ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={active ? 'page' : undefined} aria-label={badge?.ariaLabel} onClick={() => requestNavigation(item.id)}><span className="navigation-icon-wrap"><Icon name={item.icon} size={20} />{badge && <span className="navigation-badge" aria-hidden="true">{badge.text}</span>}</span><span>{item.label}</span></button> })}
      <button type="button" className={moreActive ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={moreActive ? 'page' : undefined} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={openMore}><Icon name="menu" size={20} /><span>Mais</span></button>
    </nav>
    <BottomSheet open={moreOpen} title="Mais opções" onClose={closeMore}>
      <div className="mobile-more-links">{moreItems.map((item) => <button key={item.id} type="button" className={activeTab === item.id ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => requestNavigation(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</div>
      {onLogout && <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>Sair</button>}
    </BottomSheet>
  </>
}

export default MobileNavigation
