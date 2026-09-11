import Icon from './Icon'
import { resolveArea, resolveDestination } from '../app/navigation.js'

const groups = [
  { label: 'OPERAÇÃO', items: [{ area: 'orders', label: 'Pedidos', icon: 'orders' }, { id: 'comandas', label: 'Comandas', icon: 'clipboard' }, { id: 'print-queue', label: 'Fila de impressão', icon: 'printer' }] },
  { label: 'FINANCEIRO', items: [{ id: 'dashboard', label: 'Visão geral', icon: 'dashboard' }, { id: 'receivables', label: 'A receber', icon: 'wallet' }, { id: 'finance', label: 'Movimentações', icon: 'finance' }] },
  { label: 'CADASTROS', items: [{ id: 'clients', label: 'Clientes', icon: 'clients' }, { id: 'products', label: 'Produtos e preços', icon: 'products' }, { id: 'tables', label: 'Mesas', icon: 'table' }] },
  { label: 'CONFIGURAÇÕES', items: [{ area: 'settings', label: 'Configurações', icon: 'settings' }] },
]
const activeAreas = { orders: new Set(['orders', 'history', 'new-order']), settings: new Set(['settings-printing', 'settings-device']) }

function Sidebar({ activeTab, activeNavigationEntry, granted, implemented, onNavigate, onLogout, logoutDisabled = false }) {
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.flatMap((item) => {
    const id = item.area ? resolveArea(item.area, granted, implemented) : resolveDestination(item.id, granted, implemented).status === 'allowed' && item.id
    return id ? [{ ...item, id }] : []
  }) })).filter((group) => group.items.length)
  return <aside className="sidebar">
    <div className="sidebar-brand"><div className="sidebar-logo" aria-hidden="true"><Icon name="meal" size={24} /></div><div><strong>Amor &amp; Sabor</strong><span>Gestão do delivery</span></div></div>
    <nav className="sidebar-nav" aria-label="Menu principal">
      {visibleGroups.map((group) => <section className="sidebar-group" key={group.label} aria-label={group.label}>
        <span className="sidebar-group-label">{group.label}</span>
        {group.items.map((item) => {
          const active = activeNavigationEntry
            ? (item.area || item.id) === activeNavigationEntry
            : item.area ? activeAreas[item.area]?.has(activeTab) : activeTab === item.id
          return <button key={item.id} type="button" className={active ? 'sidebar-link active' : 'sidebar-link'} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>
        })}
      </section>)}
    </nav>
    <div className="sidebar-footer"><span>Operação</span><strong>Comida caseira, gestão simples.</strong>{onLogout && <button className="sidebar-logout" type="button" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}</div>
  </aside>
}

export default Sidebar
