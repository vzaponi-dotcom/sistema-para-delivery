import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import PrintingSettingsContent from '../components/PrintingSettingsContent'
import AreaNavigation from '../components/AreaNavigation'
import { SettingsBackLink, SettingsSwitch } from '../components/SettingsControls.jsx'
import SettingsHome from './SettingsHome'
import OperationSettings from './OperationSettings'
import PaymentSettings from './PaymentSettings'
import CancellationSettings from './CancellationSettings'
import FinanceCategorySettings from './FinanceCategorySettings'
import { useTheme } from '../components/themeContext.js'
import { hasCapability } from '../app/access.js'
import '../area-navigation.css'

const DEVICE_PREFERENCES_UPDATED_AT_KEY = 'delivery-device-preferences-updated-at'

const themeOptions = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
]

function getBrowserLabel(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const browsers = [
    { pattern: /Edg\/(\d+)/, name: 'Microsoft Edge' },
    { pattern: /OPR\/(\d+)/, name: 'Opera' },
    { pattern: /Firefox\/(\d+)/, name: 'Mozilla Firefox' },
    { pattern: /Chrome\/(\d+)/, name: 'Google Chrome' },
    { pattern: /Version\/(\d+).*Safari\//, name: 'Safari' },
  ]
  for (const browser of browsers) {
    const match = userAgent.match(browser.pattern)
    if (match) return `${browser.name} ${match[1]}`
  }
  return 'Navegador atual'
}

function readDevicePreferencesUpdatedAt() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(DEVICE_PREFERENCES_UPDATED_AT_KEY) || ''
  } catch {
    return ''
  }
}

function getLocalStorageUsageBytes(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return null
  try {
    let characters = 0
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || ''
      const value = storage.getItem(key) || ''
      characters += key.length + value.length
    }
    return characters * 2
  } catch {
    return null
  }
}

function formatStorageUsage(bytes) {
  if (bytes == null) return 'Indisponível'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
}

function formatDeviceTimestamp(value) {
  if (!value) return 'Ainda não registrada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ainda não registrada'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function Settings({ section, settings, printing, granted, implemented, onNavigate, soundEnabled, onSoundEnabledChange, operationSettings, businessSettings = operationSettings, onSettingsConflictReview, onSuccessMessage, onCancelOperation, onCancelPayment }) {
  const { themePreference, setThemePreference } = useTheme()
  const [devicePersistenceError, setDevicePersistenceError] = useState('')
  const [deviceSaveStatus, setDeviceSaveStatus] = useState('idle')
  const [deviceUpdatedAt, setDeviceUpdatedAt] = useState(() => readDevicePreferencesUpdatedAt())
  const [deviceStorageUsage, setDeviceStorageUsage] = useState(() => getLocalStorageUsageBytes())
  const [deviceBrowser] = useState(() => getBrowserLabel())
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
  const registerDevicePreferenceSaved = () => {
    const updatedAt = new Date().toISOString()
    try {
      window.localStorage.setItem(DEVICE_PREFERENCES_UPDATED_AT_KEY, updatedAt)
    } catch {
      // The preference itself was already persisted; timestamp metadata is best effort.
    }
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
  if (printingRoute) return <div className="settings-page printing-settings-page">
    <PageHeader
      eyebrow={<SettingsBackLink onClick={() => onNavigate?.('settings-home')} />}
      title="Impressão de pedidos"
      description="Regras do negócio, estação e impressora local"
    />
    <PrintingSettingsContent printing={printing} settings={settings} granted={granted} onReviewConflict={onSettingsConflictReview} />
  </div>
  if (section === 'settings-device') return (
    <div className="settings-page device-settings-page">
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
          {deviceSaveStatus === 'saved' ? (
            <>
              <strong>Salvo automaticamente</strong>
              <span>{formatDeviceTimestamp(deviceUpdatedAt)}</span>
            </>
          ) : (
            <span>As alterações são salvas automaticamente neste dispositivo.</span>
          )}
        </div>

        {devicePersistenceError && <p className="settings-device-error" role="alert">{devicePersistenceError}</p>}

        <p className="device-preferences-footnote">
          Estas preferências ficam somente neste navegador e não alteram outros dispositivos.
        </p>
      </div>
    </div>
  )
  return (
    <div className="settings-page">
      <AreaNavigation area="settings" activeTab={section} granted={granted} implemented={implemented} onNavigate={onNavigate} />
    </div>
  )
}

export default Settings
