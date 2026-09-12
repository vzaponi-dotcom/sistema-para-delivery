import PageHeader from '../components/PageHeader'
import PrintingSettingsContent from '../components/PrintingSettingsContent'
import AreaNavigation from '../components/AreaNavigation'
import { useTheme } from '../components/themeContext.js'
import '../area-navigation.css'

const themeOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
]

function Settings({ section, settings, printing, granted, implemented, onNavigate, soundEnabled, onSoundEnabledChange }) {
  const { themePreference, setThemePreference } = useTheme()
  return (
    <div className="settings-page">
      <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />

      <PageHeader
        eyebrow="Configurações"
        title={section === 'settings-device' ? 'Preferências deste dispositivo' : 'Impressão'}
        description={section === 'settings-device'
          ? 'Ajustes locais deste navegador e dispositivo'
          : 'Regras do negócio, estação e impressora local'}
      />

      {section === 'settings-printing' && (
        <PrintingSettingsContent printing={printing} settings={settings} granted={granted} />
      )}

      {section === 'settings-device' && (
        <section className="device-preferences" aria-labelledby="device-preferences-title">
          <div>
            <p className="section-kicker">Neste dispositivo</p>
            <h2 id="device-preferences-title">Aparência e avisos da cozinha</h2>
          </div>
          <div className="device-preference-card">
            <span>Tema</span>
            <div className="device-theme-options" role="group" aria-label="Tema do sistema">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={themePreference === option.value}
                  className={themePreference === option.value ? 'active' : ''}
                  onClick={() => setThemePreference(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="device-preference-card device-sound-preference">
            <span><strong>Som de novos pedidos</strong><small>Usa a mesma preferência exibida na Cozinha.</small></span>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => onSoundEnabledChange(event.target.checked)}
            />
          </label>
        </section>
      )}
    </div>
  )
}

export default Settings
