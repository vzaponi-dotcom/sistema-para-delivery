import Icon from '../../components/Icon'
import { DESKTOP_NAV_GROUPS, destinationById } from '../navigation/registry.js'
import { resolveNavigationEntry } from '../navigation/resolution.js'
import { useNavigation } from '../navigation/NavigationContext.jsx'

function Sidebar({ onLogout, logoutDisabled = false }) {
  const { activeTab, activeMobileEntry, granted, implemented, requestNavigation } = useNavigation()
  const visibleGroups = DESKTOP_NAV_GROUPS.map((group) => ({ ...group, items: group.items.map((item) => resolveNavigationEntry(item, granted, implemented)).filter(Boolean) })).filter((group) => group.items.length)
  const isActive = (item) => activeMobileEntry
    ? (item.area || item.id) === activeMobileEntry
    : item.area ? destinationById.get(activeTab)?.area === item.area : activeTab === item.id
  return <aside className="sidebar">
    <div className="sidebar-brand"><div className="sidebar-logo" aria-hidden="true"><Icon name="meal" size={24} /></div><div><strong>Amor &amp; Sabor</strong><span>Gestão do delivery</span></div></div>
    <nav className="sidebar-nav" aria-label="Menu principal">
      {visibleGroups.map((group) => <section className="sidebar-group" key={group.label} aria-label={group.label}>
        <span className="sidebar-group-label">{group.label}</span>
        {group.items.map((item) => { const active = isActive(item); return <button key={item.id} type="button" className={active ? 'sidebar-link active' : 'sidebar-link'} aria-current={active ? 'page' : undefined} onClick={() => requestNavigation(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button> })}
      </section>)}
    </nav>
    <div className="sidebar-footer"><span>Operação</span><strong>Comida caseira, gestão simples.</strong>{onLogout && <button className="sidebar-logout" type="button" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}</div>
  </aside>
}

export default Sidebar
