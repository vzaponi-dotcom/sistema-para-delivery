import { NAVIGATION_DESTINATIONS, resolveDestination } from '../app/navigation.js'

const areaNames = { orders: 'Pedidos', finance: 'Financeiro', settings: 'Configurações' }

function AreaNavigation({ area, activeTab, granted, implemented, onNavigate }) {
  const destinations = NAVIGATION_DESTINATIONS.filter((destination) => destination.area === area && destination.id !== 'new-order' && resolveDestination(destination.id, granted, implemented).status === 'allowed')
  if (!destinations.length) return null
  return <nav className={`area-navigation${area === 'orders' ? ' area-navigation-orders' : ''}`} aria-label={`Navegação de ${areaNames[area] || area}`}>
    {destinations.map((destination) => <button key={destination.id} type="button" aria-current={activeTab === destination.id ? 'page' : undefined} className={activeTab === destination.id ? 'area-navigation-item active' : 'area-navigation-item'} onClick={() => onNavigate(destination.id)}>{destination.label}</button>)}
  </nav>
}

export default AreaNavigation
