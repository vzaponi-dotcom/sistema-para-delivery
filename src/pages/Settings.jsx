import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import PrintingSettingsContent from '../components/PrintingSettingsContent'
import AreaNavigation from '../components/AreaNavigation'
import SettingsHome from './SettingsHome'
import OperationSettings from './OperationSettings'
import PaymentSettings from './PaymentSettings'
import CancellationSettings from './CancellationSettings'
import FinanceCategorySettings from './FinanceCategorySettings'
import { useTheme } from '../components/themeContext.js'
import { hasCapability } from '../app/access.js'
import '../area-navigation.css'

const themeOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
]

function Settings({ section, settings, printing, granted, implemented, onNavigate, soundEnabled, onSoundEnabledChange, operationSettings, businessSettings = operationSettings, onSettingsConflictReview }) {
  const { themePreference, setThemePreference } = useTheme()
  const [devicePersistenceError, setDevicePersistenceError] = useState('')
  const operationRoute = section === 'settings-operations' || section === 'settings-modalities'
  const operationLoad = operationSettings?.load
  const paymentRoute = section === 'settings-payments'
  const cancellationRoute = section === 'settings-cancellations'
  const financeCategoryRoute = section === 'settings-finance-categories'
  const printingRoute = section === 'settings-printing'
  const canViewPrintPolicy = hasCapability(granted, 'printing.settings.view') || hasCapability(granted, 'printing.settings')
  const canViewPrintStation = hasCapability(granted, 'printing.station.view') || hasCapability(granted, 'printing.station.configure')
  const paymentLoad = businessSettings?.load
  useEffect(() => {
    if (operationRoute) void operationLoad?.('operations')
  }, [operationLoad, operationRoute])
  useEffect(() => {
    if (paymentRoute) void paymentLoad?.('paymentMethods')
  }, [paymentLoad, paymentRoute])
  useEffect(() => {
    if (cancellationRoute) void paymentLoad?.('cancellationReasons')
  }, [cancellationRoute, paymentLoad])
  useEffect(() => {
    if (financeCategoryRoute) void paymentLoad?.('financeCategories')
  }, [financeCategoryRoute, paymentLoad])
  useEffect(() => {
    if (!printingRoute) return
    if (canViewPrintPolicy) void paymentLoad?.('printingPolicy')
    const stationId = printing?.localStation?.id
    if (canViewPrintStation && stationId) void paymentLoad?.('stationConfiguration', stationId)
    if (canViewPrintStation) void paymentLoad?.('stationPrimary')
  }, [canViewPrintPolicy, canViewPrintStation, paymentLoad, printing?.localStation?.id, printingRoute])
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
  const reviewCancellationConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('cancellationReasons')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const reviewFinanceCategoryConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('financeCategories')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const changeTheme = (value) => {
    const saved = setThemePreference(value)
    setDevicePersistenceError(saved === false ? 'Não foi possível salvar esta preferência neste dispositivo.' : '')
  }
  const changeSound = (value) => {
    const saved = onSoundEnabledChange?.(value)
    setDevicePersistenceError(saved === false ? 'Não foi possível salvar esta preferência neste dispositivo.' : '')
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
  if (cancellationRoute) return <div className="settings-page">
    <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />
    <CancellationSettings
      resourceState={businessSettings?.resources?.cancellationReasons}
      readOnly={!(granted instanceof Set && granted.has('orders.settings.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('cancellationReasons', draft)}
      onSave={() => businessSettings?.save?.('cancellationReasons')}
      onDiscard={() => businessSettings?.discard?.('cancellationReasons')}
      onReconcile={() => businessSettings?.reconcile?.('cancellationReasons')}
      onReload={() => businessSettings?.load?.('cancellationReasons')}
      onReviewConflict={reviewCancellationConflict}
    />
  </div>
  if (financeCategoryRoute) return <div className="settings-page">
    <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />
    <FinanceCategorySettings
      resourceState={businessSettings?.resources?.financeCategories}
      readOnly={!(granted instanceof Set && granted.has('finance.categories.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('financeCategories', draft)}
      onSave={() => businessSettings?.save?.('financeCategories')}
      onDiscard={() => businessSettings?.discard?.('financeCategories')}
      onReconcile={() => businessSettings?.reconcile?.('financeCategories')}
      onReload={() => businessSettings?.load?.('financeCategories')}
      onReviewConflict={reviewFinanceCategoryConflict}
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
                  onClick={() => changeTheme(option.value)}
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
              onChange={(event) => changeSound(event.target.checked)}
            />
          </label>
          {devicePersistenceError && <p className="settings-device-error" role="alert">{devicePersistenceError}</p>}
        </section>
      )}
    </div>
  )
}

export default Settings
