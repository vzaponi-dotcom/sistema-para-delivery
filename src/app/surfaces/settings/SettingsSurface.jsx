import { useEffect } from 'react'
import PageHeader from '../../../components/PageHeader.jsx'
import PrintingSettingsContent from '../../../components/PrintingSettingsContent.jsx'
import AreaNavigation from '../../navigation/AreaNavigation.jsx'
import { hasCapability } from '../../access.js'
import { usePolicyEditing } from '../../policy-editing/policyEditingContext.js'
import SettingsHome from './SettingsHome.jsx'
import OperationSettings from './OperationSettings.jsx'
import PaymentSettings from './PaymentSettings.jsx'
import CancellationSettings from './CancellationSettings.jsx'
import FinanceCategorySettings from './FinanceCategorySettings.jsx'
import DevicePreferences from './local/DevicePreferences.jsx'
import SettingsConflictReview from './components/SettingsConflictReview.jsx'
import { SettingsBackLink } from './components/SettingsBackAndSwitchControls.jsx'
import { createPrintingSettingsAdapter } from './printingSettingsAdapter.js'
import '../../../area-navigation.css'

const policyForSection = (section) => {
  if (section === 'settings-operations' || section === 'settings-modalities') return ['operations']
  if (section === 'settings-payments') return ['paymentMethods']
  if (section === 'settings-cancellations') return ['cancellationReasons']
  if (section === 'settings-finance-categories') return ['financeCategories']
  return null
}

export function SettingsSurface({
  section,
  printing,
  granted,
  implemented,
  onNavigate,
  soundEnabled,
  onSoundEnabledChange,
  onSuccessMessage,
}) {
  const policyEditing = usePolicyEditing()
  const {
    resources, load, edit, save, discard, reconcile, reviewConflict,
    activeConflict, acceptActiveConflict, dismissActiveConflict,
  } = policyEditing
  const selectedPolicy = policyForSection(section)?.[0] || null
  const printingRoute = section === 'settings-printing'
  const canViewPrintPolicy = hasCapability(granted, 'printing.settings.view') || hasCapability(granted, 'printing.settings')
  const canViewPrintStation = hasCapability(granted, 'printing.station.view') || hasCapability(granted, 'printing.station.configure')
  const stationId = printing?.localStation?.id
  const printingSettings = printingRoute ? createPrintingSettingsAdapter({ policyEditing, printing, stationId }) : null

  useEffect(() => {
    if (selectedPolicy) void load(selectedPolicy)
  }, [load, selectedPolicy])
  useEffect(() => {
    if (!printingRoute) return
    if (canViewPrintPolicy) void load('printingPolicy')
    if (canViewPrintStation && stationId) void load('stationConfiguration', stationId)
    if (canViewPrintStation) void load('stationPrimary')
  }, [canViewPrintPolicy, canViewPrintStation, load, printingRoute, stationId])

  const cancel = async (policyId, scopeId) => {
    const discarded = discard(policyId, scopeId)
    if (discarded === false) return false
    onNavigate?.('settings-home')
    return true
  }
  const savePolicy = async (policyId, successMessage, scopeId) => {
    const saved = await save(policyId, scopeId)
    if (saved === true) onSuccessMessage?.(successMessage)
    return saved
  }
  const review = async (policyId, scopeId) => reviewConflict(policyId, scopeId)
  const withActiveConflict = (content) => <>{content}{activeConflict && <SettingsConflictReview
    key={activeConflict.reviewId || activeConflict.currentRevision}
    review={activeConflict}
    onAccept={acceptActiveConflict}
    onClose={dismissActiveConflict}
  />}</>

  if (section === 'settings-home') return withActiveConflict(<SettingsHome granted={granted} implemented={implemented} onNavigate={onNavigate} />)
  if (selectedPolicy === 'operations') return withActiveConflict(<div className="settings-page operation-settings-page">
    <OperationSettings
      onNavigateHome={() => onNavigate?.('settings-home')}
      resourceState={resources.operations}
      readOnly={!(granted instanceof Set && granted.has('operations.settings.manage'))}
      initialSection={section === 'settings-modalities' ? 'modalities' : 'timing'}
      onEdit={(draft) => edit('operations', draft)}
      onSave={() => savePolicy('operations', 'Configurações de operação salvas com sucesso')}
      onDiscard={() => cancel('operations')}
      onReconcile={() => reconcile('operations')}
      onReload={() => load('operations')}
      onReviewConflict={() => review('operations')}
    />
  </div>)
  if (selectedPolicy === 'paymentMethods') return withActiveConflict(<div className="settings-page">
    <PaymentSettings
      resourceState={resources.paymentMethods}
      readOnly={!(granted instanceof Set && granted.has('payments.settings.manage'))}
      onEdit={(draft) => edit('paymentMethods', draft)}
      onSave={() => savePolicy('paymentMethods', 'Configurações de pagamento salvas com sucesso')}
      onDiscard={() => cancel('paymentMethods')}
      onReconcile={() => reconcile('paymentMethods')}
      onReload={() => load('paymentMethods')}
      onReviewConflict={() => review('paymentMethods')}
      onNavigateHome={() => onNavigate?.('settings-home')}
    />
  </div>)
  if (selectedPolicy === 'cancellationReasons') return withActiveConflict(<div className="settings-page">
    <CancellationSettings
      resourceState={resources.cancellationReasons}
      readOnly={!(granted instanceof Set && granted.has('orders.settings.manage'))}
      onEdit={(draft) => edit('cancellationReasons', draft)}
      onSave={() => savePolicy('cancellationReasons', 'Motivos de cancelamento salvos com sucesso')}
      onDiscard={() => cancel('cancellationReasons')}
      onReconcile={() => reconcile('cancellationReasons')}
      onReload={() => load('cancellationReasons')}
      onReviewConflict={() => review('cancellationReasons')}
      onNavigateHome={() => onNavigate?.('settings-home')}
    />
  </div>)
  if (selectedPolicy === 'financeCategories') return withActiveConflict(<div className="settings-page">
    <FinanceCategorySettings
      resourceState={resources.financeCategories}
      readOnly={!(granted instanceof Set && granted.has('finance.categories.manage'))}
      onEdit={(draft) => edit('financeCategories', draft)}
      onSave={() => savePolicy('financeCategories', 'Categorias financeiras salvas com sucesso')}
      onDiscard={() => cancel('financeCategories')}
      onReconcile={() => reconcile('financeCategories')}
      onReload={() => load('financeCategories')}
      onReviewConflict={() => review('financeCategories')}
      onNavigateHome={() => onNavigate?.('settings-home')}
    />
  </div>)
  if (printingRoute) return withActiveConflict(<div className="settings-page printing-settings-page">
    <PageHeader
      eyebrow={<SettingsBackLink onClick={() => onNavigate?.('settings-home')} />}
      title="Impressão de pedidos"
      description="Regras do negócio, estação e impressora local"
    />
    <PrintingSettingsContent printing={printing} settings={printingSettings} granted={granted} />
  </div>)
  if (section === 'settings-device') return withActiveConflict(<DevicePreferences
    soundEnabled={soundEnabled}
    onSoundEnabledChange={onSoundEnabledChange}
    onNavigate={onNavigate}
  />)
  return withActiveConflict(<div className="settings-page"><AreaNavigation area="settings" /></div>)
}

export default SettingsSurface
