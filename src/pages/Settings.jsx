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

function Settings({ section, settings, printing, granted, implemented, onNavigate, soundEnabled, onSoundEnabledChange, operationSettings, businessSettings = operationSettings, onSettingsConflictReview, onSuccessMessage, onCancelOperation, onCancelPayment }) {
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
  const saveOperation = async () => {
    const saved = await operationSettings?.save?.('operations')
    if (saved === true) onSuccessMessage?.('Configurações de operação salvas com sucesso')
    return saved
  }
  const reviewPaymentConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('paymentMethods')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const savePayment = async () => {
    const saved = await businessSettings?.save?.('paymentMethods')
    if (saved === true) onSuccessMessage?.('Configurações de pagamento salvas com sucesso')
    return saved
  }
  const cancelPayment = async () => {
    if (onCancelPayment) return onCancelPayment()
    const discarded = await businessSettings?.discard?.('paymentMethods')
    if (discarded === false) return false
    onNavigate?.('settings-home')
    return true
  }
  const reviewCancellationConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('cancellationReasons')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const saveCancellation = async () => {
    const saved = await businessSettings?.save?.('cancellationReasons')
    if (saved === true) onSuccessMessage?.('Motivos de cancelamento salvos com sucesso')
    return saved
  }
  const cancelCancellation = async () => {
    const discarded = await businessSettings?.discard?.('cancellationReasons')
    if (discarded === false) return false
    onNavigate?.('settings-home')
    return true
  }
  const reviewFinanceCategoryConflict = async () => {
    const review = await businessSettings?.reviewConflict?.('financeCategories')
    if (review) onSettingsConflictReview?.(review)
    return review
  }
  const saveFinanceCategories = async () => {
    const saved = await businessSettings?.save?.('financeCategories')
    if (saved === true) onSuccessMessage?.('Categorias financeiras salvas com sucesso')
    return saved
  }
  const cancelFinanceCategories = async () => {
    const discarded = await businessSettings?.discard?.('financeCategories')
    if (discarded === false) return false
    onNavigate?.('settings-home')
    return true
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
  if (operationRoute) return <div className="settings-page operation-settings-page">
    <OperationSettings
      onNavigateHome={() => onNavigate?.('settings-home')}
      resourceState={operationSettings?.resources?.operations}
      readOnly={!(granted instanceof Set && granted.has('operations.settings.manage'))}
      initialSection={section === 'settings-modalities' ? 'modalities' : 'timing'}
      onEdit={(draft) => operationSettings?.edit?.('operations', draft)}
      onSave={saveOperation}
      onDiscard={onCancelOperation || (() => operationSettings?.discard?.('operations'))}
      onReconcile={() => operationSettings?.reconcile?.('operations')}
      onReload={() => operationSettings?.load?.('operations')}
      onReviewConflict={reviewOperationConflict}
    />
  </div>
  if (paymentRoute) return <div className="settings-page">
    <PaymentSettings
      resourceState={businessSettings?.resources?.paymentMethods}
      readOnly={!(granted instanceof Set && granted.has('payments.settings.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('paymentMethods', draft)}
      onSave={savePayment}
      onDiscard={cancelPayment}
      onReconcile={() => businessSettings?.reconcile?.('paymentMethods')}
      onReload={() => businessSettings?.load?.('paymentMethods')}
      onReviewConflict={reviewPaymentConflict}
      onNavigateHome={() => onNavigate?.('settings-home')}
    />
  </div>
  if (cancellationRoute) return <div className="settings-page">
    <CancellationSettings
      resourceState={businessSettings?.resources?.cancellationReasons}
      readOnly={!(granted instanceof Set && granted.has('orders.settings.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('cancellationReasons', draft)}
      onSave={saveCancellation}
      onDiscard={cancelCancellation}
      onReconcile={() => businessSettings?.reconcile?.('cancellationReasons')}
      onReload={() => businessSettings?.load?.('cancellationReasons')}
      onReviewConflict={reviewCancellationConflict}
      onNavigateHome={() => onNavigate?.('settings-home')}
    />
  </div>
  if (financeCategoryRoute) return <div className="settings-page">
    <FinanceCategorySettings
      resourceState={businessSettings?.resources?.financeCategories}
      readOnly={!(granted instanceof Set && granted.has('finance.categories.manage'))}
      onEdit={(draft) => businessSettings?.edit?.('financeCategories', draft)}
      onSave={saveFinanceCategories}
      onDiscard={cancelFinanceCategories}
      onReconcile={() => businessSettings?.reconcile?.('financeCategories')}
      onReload={() => businessSettings?.load?.('financeCategories')}
      onReviewConflict={reviewFinanceCategoryConflict}
      onNavigateHome={() => onNavigate?.('settings-home')}
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
