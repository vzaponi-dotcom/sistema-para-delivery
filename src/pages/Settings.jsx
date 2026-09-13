import { useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import PrintingSettingsContent from '../components/PrintingSettingsContent'
import AreaNavigation from '../components/AreaNavigation'
import SettingsHome from './SettingsHome'
import OperationSettings from './OperationSettings'
import PaymentSettings from './PaymentSettings'
import { useTheme } from '../components/themeContext.js'
import '../area-navigation.css'

const themeOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
]

function Settings({ section, settings, printing, granted, implemented, onNavigate, soundEnabled, onSoundEnabledChange, operationSettings, businessSettings = operationSettings, onSettingsConflictReview }) {
  const { themePreference, setThemePreference } = useTheme()
  const operationRoute = section === 'settings-operations' || section === 'settings-modalities'
  const operationLoad = operationSettings?.load
  const paymentRoute = section === 'settings-payments'
  const paymentLoad = businessSettings?.load
  useEffect(() => {
    if (operationRoute) void operationLoad?.('operations')
  }, [operationLoad, operationRoute])
  useEffect(() => {
    if (paymentRoute) void paymentLoad?.('paymentMethods')
  }, [paymentLoad, paymentRoute])
  const reviewOperationConflict = async () => {
    const review = await operationSettings?.reviewConflict?.('operations')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const reviewPaymentConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('paymentMethods')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  if (section === 'settings-home') return <SettingsHome granted={granted} implemented={implemented} onNavigate={onNavigate} />
  if (operationRoute) return <div className="settings-page">
    <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />
    <OperationSettings
      resourceState={operationSettings?.resources?.operations}
      readOnly={!(granted instanceof Set && granted.has('operations.settings.manage'))}
      initialSection={section === 'settings-modalities' ? 'modalities' : 'timing'}
      onEdit={(draft) => operationSettings?.edit?.('operations', draft)}
      onSave={() => operationSettings?.save?.('operations')}
      onDiscard={() => operationSettings?.discard?.('operations')}
      onReconcile={() => operationSettings?.reconcile?.('operations')}
      onReload={() => operationSettings?.load?.('operations')}
      onReviewConflict={reviewOperationConflict}
    />
  </div>
  if (paymentRoute) return <div className="settings-page">
    <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />
    <PaymentSettings
      resourceState={businessSettings?.resources?.paymentMethods}
      readOnly={!(granted instanceof Set && granted.has('payments.settings.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('paymentMethods', draft)}
      onSave={() => businessSettings?.save?.('paymentMethods')}
      onDiscard={() => businessSettings?.discard?.('paymentMethods')}
      onReconcile={() => businessSettings?.reconcile?.('paymentMethods')}
      onReload={() => businessSettings?.load?.('paymentMethods')}
      onReviewConflict={reviewPaymentConflict}
    />
  </div>
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
