import BrandLogo from './BrandLogo'
import Icon from './Icon'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
  { id: 'products', label: 'Produtos', icon: 'products' },
  { id: 'receivables', label: 'A Receber', icon: 'wallet' },
  { id: 'finance', label: 'Financeiro', icon: 'finance' },
]

function Sidebar({ activeTab, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo"><BrandLogo variant="mark" /></div>
        <div>
          <strong>Amor &amp; Sabor</strong>
          <span>Gestão do delivery</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeTab === item.id ? 'sidebar-link active' : 'sidebar-link'}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>Operação</span>
        <strong>Comida caseira, gestão simples.</strong>
      </div>
    </aside>
  )
}

export default Sidebar
