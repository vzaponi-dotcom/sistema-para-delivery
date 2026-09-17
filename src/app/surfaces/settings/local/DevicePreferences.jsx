import { useState } from 'react'
import Icon from '../../../../components/Icon.jsx'
import PageHeader from '../../../../components/PageHeader.jsx'
import { useTheme } from '../../../../components/themeContext.js'
import { SettingsBackLink, SettingsSwitch } from '../components/SettingsBackAndSwitchControls.jsx'
import {
  formatDeviceTimestamp,
  formatStorageUsage,
  getBrowserLabel,
  getLocalStorageUsageBytes,
  readDevicePreferencesUpdatedAt,
  writeDevicePreferencesUpdatedAt,
} from './devicePreferences.js'
import '../../../../settings.css'

const themeOptions = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'system' },
]

function DevicePreferences({ soundEnabled, onSoundEnabledChange, onNavigate }) {
  const { themePreference, setThemePreference } = useTheme()
  const [devicePersistenceError, setDevicePersistenceError] = useState('')
  const [deviceSaveStatus, setDeviceSaveStatus] = useState('idle')
  const [deviceUpdatedAt, setDeviceUpdatedAt] = useState(() => readDevicePreferencesUpdatedAt())
  const [deviceStorageUsage, setDeviceStorageUsage] = useState(() => getLocalStorageUsageBytes())
  const [deviceBrowser] = useState(() => getBrowserLabel())

  const registerDevicePreferenceSaved = () => {
    const updatedAt = new Date().toISOString()
    writeDevicePreferencesUpdatedAt(typeof window !== 'undefined' ? window.localStorage : null, updatedAt)
    setDeviceUpdatedAt(updatedAt)
    setDeviceStorageUsage(getLocalStorageUsageBytes())
    setDevicePersistenceError('')
    setDeviceSaveStatus('saved')
  }
  const reportDevicePersistenceError = () => {
    setDevicePersistenceError('Não foi possível salvar esta preferência neste dispositivo.')
    setDeviceSaveStatus('error')
  }
  const changeTheme = (value) => {
    const saved = setThemePreference(value)
    if (saved === false) {
      reportDevicePersistenceError()
      return
    }
    registerDevicePreferenceSaved()
  }
  const changeSound = (value) => {
    const saved = onSoundEnabledChange?.(value)
    if (saved === false) {
      reportDevicePersistenceError()
      return
    }
    registerDevicePreferenceSaved()
  }

  return <div className="settings-page device-settings-page">
    <PageHeader
      eyebrow={<SettingsBackLink onClick={() => onNavigate?.('settings-home')} />}
      title="Preferências deste dispositivo"
      description="Aparência, avisos e informações que ficam apenas neste navegador"
    />

    <div className="device-preferences">
      <section className="device-preferences-card" aria-labelledby="device-appearance-title">
        <div className="device-preferences-card-heading">
          <div>
            <p className="section-kicker">Neste dispositivo</p>
            <h2 id="device-appearance-title">Aparência</h2>
            <p>Escolha como o sistema deve aparecer neste dispositivo.</p>
          </div>
          <span className="device-local-badge">Local</span>
        </div>
        <div className="device-preference-row">
          <span className="device-preference-copy">
            <strong>Tema do sistema</strong>
            <small>O modo automático acompanha a preferência do sistema operacional.</small>
          </span>
          <div className="device-theme-options" role="group" aria-label="Tema do sistema">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={themePreference === option.value}
                className={themePreference === option.value ? 'active' : ''}
                onClick={() => changeTheme(option.value)}
              >
                <span
                  data-theme-icon={option.icon}
                  aria-hidden="true"
                  style={{ display: 'inline-flex', marginRight: 7, verticalAlign: 'middle' }}
                >
                  <Icon name={option.icon} size={17} />
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="device-preferences-card" aria-labelledby="device-kitchen-title">
        <div className="device-preferences-card-heading">
          <div>
            <p className="section-kicker">Neste dispositivo</p>
            <h2 id="device-kitchen-title">Avisos da cozinha</h2>
            <p>Controle os avisos sonoros usados neste navegador.</p>
          </div>
        </div>
        <div className="device-preference-row device-sound-row">
          <span className="device-preference-copy">
            <strong>Som de novos pedidos</strong>
            <small>Usa a mesma preferência exibida na Cozinha.</small>
          </span>
          <SettingsSwitch
            id="device-kitchen-sound"
            checked={Boolean(soundEnabled)}
            label="Som de novos pedidos"
            onChange={changeSound}
          />
        </div>
      </section>

      <section className="device-preferences-card" aria-labelledby="device-info-title">
        <div className="device-preferences-card-heading">
          <div>
            <p className="section-kicker">Diagnóstico local</p>
            <h2 id="device-info-title">Informações locais</h2>
            <p>Dados deste navegador que ajudam a entender onde estas preferências estão armazenadas.</p>
          </div>
        </div>
        <dl className="device-local-info">
          <div>
            <dt>Navegador</dt>
            <dd>{deviceBrowser}</dd>
          </div>
          <div>
            <dt>Uso aproximado</dt>
            <dd>{formatStorageUsage(deviceStorageUsage)}</dd>
          </div>
          <div>
            <dt>Última alteração</dt>
            <dd>{formatDeviceTimestamp(deviceUpdatedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className={`device-autosave-status ${deviceSaveStatus === 'saved' ? 'saved' : ''}`} aria-live="polite">
        {deviceSaveStatus === 'saved' ? <>
          <strong>Salvo automaticamente</strong>
          <span>{formatDeviceTimestamp(deviceUpdatedAt)}</span>
        </> : <span>As alterações são salvas automaticamente neste dispositivo.</span>}
      </div>

      {devicePersistenceError && <p className="settings-device-error" role="alert">{devicePersistenceError}</p>}

      <p className="device-preferences-footnote">
        Estas preferências ficam somente neste navegador e não alteram outros dispositivos.
      </p>
    </div>
  </div>
}

export default DevicePreferences
