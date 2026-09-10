import { useState } from 'react'
import '../mobile-navigation.css'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { useTheme } from './themeContext.js'

const directItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'comandas', label: 'Comandas', icon: 'clipboard' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
]

const themeOptions = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'system' },
]

const themeCycle = ['light', 'dark', 'system']

function MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled = false }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { themePreference, setThemePreference } = useTheme()
  const moreActive = activeTab === 'products' || activeTab === 'history' || activeTab === 'receivables' || activeTab === 'finance' || activeTab === 'tables'
  const currentThemeOption = themeOptions.find((option) => option.value === themePreference) || themeOptions[2]
  const nextThemePreference = themeCycle[(themeCycle.indexOf(currentThemeOption.value) + 1) % themeCycle.length]

  const navigate = (id) => {
    onNavigate(id)
    setMoreOpen(false)
  }

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {directItems.map((item) => (
          <button key={item.id} type="button" className={activeTab === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={20} /><span>{item.label}</span>
          </button>
        ))}
        <button type="button" className={moreActive ? 'mobile-nav-item active' : 'mobile-nav-item'} aria-current={moreActive ? 'page' : undefined} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <Icon name="menu" size={20} /><span>Mais</span>
        </button>
      </nav>

      <BottomSheet open={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)}>
        <div className="mobile-more-links">
          <button type="button" className={activeTab === 'products' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('products')}>
            <Icon name="products" size={20} /><span>Produtos</span>
          </button>
          <button type="button" className={activeTab === 'history' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('history')}>
            <Icon name="receipt" size={20} /><span>Histórico</span>
          </button>
          <button type="button" className={activeTab === 'receivables' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('receivables')}>
            <Icon name="wallet" size={20} /><span>A Receber</span>
          </button>
          <button type="button" className={activeTab === 'finance' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('finance')}>
            <Icon name="finance" size={20} /><span>Financeiro</span>
          </button>
          <button type="button" className={activeTab === 'tables' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('tables')}>
            <Icon name="table" size={20} /><span>Mesas</span>
          </button>
        </div>

        <div className="mobile-more-theme">
          <span className="mobile-more-label">Tema</span>
          <button type="button" className="theme-cycle-button" aria-label={`Tema atual: ${currentThemeOption.label}. Clique para alternar`} title="Clique para alternar o tema" onClick={() => setThemePreference(nextThemePreference)}>
            <Icon name={currentThemeOption.icon} size={18} />
            <span>{currentThemeOption.label}</span>
          </button>
        </div>

        {onLogout && <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>Sair do sistema</button>}
      </BottomSheet>
    </>
  )
}

export default MobileNavigation
