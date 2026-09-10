import '../theme-controls.css'
import Icon from './Icon'
import { useTheme } from './themeContext.js'

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'comandas', label: 'Comandas', icon: 'clipboard' },
  { id: 'history', label: 'Histórico', icon: 'receipt' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
  { id: 'products', label: 'Produtos', icon: 'products' },
  { id: 'receivables', label: 'A Receber', icon: 'wallet' },
  { id: 'finance', label: 'Financeiro', icon: 'finance' },
  { id: 'tables', label: 'Mesas', icon: 'table' },
]

const themeOptions = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'system' },
]

function Sidebar({ activeTab, onNavigate, onLogout, logoutDisabled = false }) {
  const { themePreference, setThemePreference } = useTheme()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" aria-hidden="true"><Icon name="meal" size={24} /></div>
        <div><strong>Amor &amp; Sabor</strong><span>Gestão do delivery</span></div>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {navigation.map((item) => (
          <button key={item.id} type="button" className={activeTab === item.id ? 'sidebar-link active' : 'sidebar-link'} aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
            <Icon name={item.icon} size={20} /><span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>Operação</span><strong>Comida caseira, gestão simples.</strong>
        <div className="theme-picker">
          <span className="theme-picker-label">Tema</span>
          <div className="theme-segmented-control" role="group" aria-label="Tema do sistema">
            {themeOptions.map((option) => (
              <button key={option.value} type="button" className={themePreference === option.value ? 'theme-option active' : 'theme-option'} aria-pressed={themePreference === option.value} title={`Usar tema ${option.label.toLowerCase()}`} onClick={() => setThemePreference(option.value)}>
                <Icon name={option.icon} size={16} />{option.label}
              </button>
            ))}
          </div>
        </div>
        {onLogout && <button className="sidebar-logout" type="button" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}
      </div>
    </aside>
  )
}

export default Sidebar
