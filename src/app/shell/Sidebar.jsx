import Icon from '../../shared/ui/Icon'
import { DESKTOP_NAV_GROUPS, destinationById } from '../navigation/registry.js'
import { resolveNavigationEntry } from '../navigation/resolution.js'
import { useNavigation } from '../navigation/NavigationContext.jsx'
import { getNavigationBadge } from './navigationBadges.js'
import '../../navigation-badges.css'

function Sidebar({ badges = {} }) {
  const { activeTab, activeMobileEntry, granted, implemented, requestNavigation } = useNavigation()
  const visibleGroups = DESKTOP_NAV_GROUPS.map((group) => ({ ...group, items: group.items.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean) })).filter((group) => group.items.length)
  const isActive = (item) => activeMobileEntry
    ? (item.area || item.id) === activeMobileEntry
    : item.area ? destinationById.get(activeTab)?.area === item.area : activeTab === item.id
  return <aside className="sidebar">
    <nav className="sidebar-nav" aria-label="Menu principal">
      {visibleGroups.map((group) => <section className="sidebar-group" key={group.label} aria-label={group.label}>
        <span className="sidebar-group-label">{group.label}</span>
        {group.items.map((item) => { const active = isActive(item); const badge = getNavigationBadge(item, badges); return <button key={item.id} type="button" className={active ? 'sidebar-link active' : 'sidebar-link'} aria-current={active ? 'page' : undefined} aria-label={badge?.ariaLabel} onClick={() => requestNavigation(item.id)}><span className="navigation-icon-wrap"><Icon name={item.icon} size={20} /></span><span className="sidebar-link-label">{badge && <span className="navigation-badge" aria-hidden="true">{badge.text}</span>}<span>{item.label}</span></span></button> })}
      </section>)}
    </nav>
    <div className="sidebar-footer"><span>Operação</span><strong>Comida caseira, gestão simples.</strong></div>
  </aside>
}

export default Sidebar
