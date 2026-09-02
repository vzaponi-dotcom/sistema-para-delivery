import { useState } from 'react'
import '../mobile-navigation.css'
import BottomSheet from './BottomSheet'
import Icon from './Icon'
import { useTheme } from './themeContext.js'

const directItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'orders', label: 'Pedidos', icon: 'orders' },
  { id: 'clients', label: 'Clientes', icon: 'clients' },
  { id: 'products', label: 'Produtos', icon: 'products' },
]

const themeOptions = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'system' },
]

function MobileNavigation({ activeTab, onNavigate, onLogout, logoutDisabled = false }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { themePreference, setThemePreference } = useTheme()
  const moreActive = activeTab === 'receivables' || activeTab === 'finance'

  const navigate = (id) => {
    onNavigate(id)
    setMoreOpen(false)
  }

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {directItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeTab === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={moreActive ? 'mobile-nav-item active' : 'mobile-nav-item'}
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu" size={20} />
          <span>Mais</span>
        </button>
      </nav>

      <BottomSheet open={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)}>
        <div className="mobile-more-links">
          <button type="button" className={activeTab === 'receivables' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('receivables')}>
            <Icon name="wallet" size={20} />
            <span>A Receber</span>
          </button>
          <button type="button" className={activeTab === 'finance' ? 'mobile-more-action active' : 'mobile-more-action'} onClick={() => navigate('finance')}>
            <Icon name="finance" size={20} />
            <span>Financeiro</span>
          </button>
        </div>

        <div className="mobile-more-theme">
          <span className="mobile-more-label">Tema</span>
          <div className="theme-segmented-control" role="group" aria-label="Tema do sistema">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={themePreference === option.value ? 'theme-option active' : 'theme-option'}
                aria-pressed={themePreference === option.value}
                onClick={() => setThemePreference(option.value)}
              >
                <Icon name={option.icon} size={16} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {onLogout && (
          <button type="button" className="mobile-more-logout" onClick={onLogout} disabled={logoutDisabled}>
            Sair do sistema
          </button>
        )}
      </BottomSheet>
    </>
  )
}

export default MobileNavigation
