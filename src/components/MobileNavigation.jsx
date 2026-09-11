import '../mobile-navigation.css'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { NAVIGATION_DESTINATIONS, resolveArea, resolveDestination } from '../app/navigation.js'

const directEntries = [{ area: 'orders', label: 'Pedidos', icon: 'orders' }, { id: 'comandas', label: 'Comandas', icon: 'clipboard' }, { area: 'finance', label: 'Financeiro', icon: 'finance' }]
const moreEntries = [{ id: 'print-queue', icon: 'printer' }, { id: 'clients', icon: 'clients' }, { id: 'products', icon: 'products' }, { id: 'tables', icon: 'table' }, { area: 'settings', icon: 'settings', label: 'Configurações' }]
const destinationById = new Map(NAVIGATION_DESTINATIONS.map((destination) => [destination.id, destination]))
const resolveEntry = (item, granted, implemented) => {
  const id = item.area ? resolveArea(item.area, granted, implemented) : resolveDestination(item.id, granted, implemented).status === 'allowed' && item.id
  return id ? { ...item, id, label: item.label || destinationById.get(id).label } : null
}

function MobileNavigation({ activeTab, activeMobileEntry, granted, implemented, moreOpen, onOpenMore, onCloseMore, onNavigate, onLogout, logoutDisabled = false }) {
  const directItems = directEntries.map((item) => resolveEntry(item, granted, implemented)).filter(Boolean)
  const moreItems = moreEntries.map((item) => resolveEntry(item, granted, implemented)).filter(Boolean)
  const currentEntry = activeMobileEntry || destinationById.get(activeTab)?.mobileEntry
  const moreActive = currentEntry === 'more'
  return <>
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {directItems.map((item) => {
        const active = currentEntry === (item.area || item.id)
        return <button key={item.id} type="button" className={active ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>
      })}
      <button type="button" className={moreActive ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={moreActive ? 'page' : undefined} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={onOpenMore}><Icon name="menu" size={20} /><span>Mais</span></button>
    </nav>
    <BottomSheet open={moreOpen} title="Mais opções" onClose={onCloseMore}>
      <div className="mobile-more-links">{moreItems.map((item) => <button key={item.id} type="button" className={activeTab === item.id ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</div>
      {onLogout && <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>Sair</button>}
    </BottomSheet>
  </>
}

export default MobileNavigation
