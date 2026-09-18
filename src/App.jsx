import { FinanceWorkspace, calculateReceivedToday, formatTableIdentifierLabel } from './domains/finance/index.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './central-data.css'
import './new-order.css'
import './client-duplicate.css'
import './product-form.css'
import './finance-mobile.css'
import AppShell from './app/shell/AppShell.jsx'
import AppRoot from './app/shell/AppRoot.jsx'
import Button from './components/Button'
import ClientDuplicateModal from './components/ClientDuplicateModal'
import ConfirmationDialog from './components/ConfirmationDialog'
import Modal from './components/Modal'
import RegisterRefundDialog from './components/RegisterRefundDialog'
import ProductForm from './components/ProductForm'
import SystemSelect from './components/SystemSelect'
import {
  cancellationOptionsFromEffective,
  cancellationRevisionFromEffective,
  canReceiveStandaloneOrder,
  formatCancellationDate,
  getOrderRefundState,
  isOrderActive,
  isOrderCancelled,
  NewOrderRoute,
  OrderHistory,
  Orders,
  ordersApi,
  toLocalDateValue,
  useKitchenClock,
  useNewOrderDraft,
  useOrderArrivals,
  useOrderCommands,
} from './domains/orders/index.js'
import {
  Comandas,
  Tables,
  resolveOpenComanda,
  useComandaSelection,
  useTableServiceCommands,
} from './domains/table-service/index.js'
import {
  paymentDefaultFromEffective,
  paymentOptionsFromEffective,
  paymentOptionsWithSelection,
  paymentSelectionNeedsReview,
} from './utils/paymentMethodOptions.js'
import { financeCategoryOptionsFromEffective, financeCategoryRevisionFromEffective } from './utils/financeCategoryOptions.js'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Receivables from './pages/Receivables'
import PrintQueue from './pages/PrintQueue'
import SettingsPolicyBoundary from './app/surfaces/settings/SettingsPolicyBoundary.jsx'
import SettingsSurface from './app/surfaces/settings/SettingsSurface.jsx'
import TableServiceExternalActions from './app/surfaces/table-service/TableServiceExternalActions.jsx'
import { hasCapability, legacyCapabilities } from './app/access.js'
import { resolveDestination } from './app/navigation/resolution.js'
import { NavigationProvider } from './app/navigation/NavigationContext.jsx'
import { useNavigationController } from './app/navigation/useNavigationController.js'
import { useQueryContext } from './app/navigation/useQueryContext.js'
import { useEffectiveBusinessConfig } from './app/useEffectiveBusinessConfig.js'
import { createPolicyNavigationBridge } from './app/policy-editing/policyNavigationBridge.js'
import { useOperationalDataRuntime } from './app/runtime/data/useOperationalDataRuntime.js'
import { useFeedbackRuntime } from './app/runtime/feedback/useFeedbackRuntime.js'
import { useOnlineStatus } from './app/runtime/network/useOnlineStatus.js'
import { useSessionRuntime } from './app/runtime/session/useSessionRuntime.js'
import { findClientDuplicates } from '../shared/clientIdentity.js'
import { formatOrderDisplayNumber } from '../shared/orderDisplayNumber.js'
import { categoryForUi } from '../shared/productCatalog.js'
import { acknowledgeAndOpenSecondCopyPrompt, findOriginSecondCopyPrompt, getSecondCopyPromptTitle, isSecondCopyPromptEligible, readOriginOrderIds, rememberOriginOrderId } from './printing/secondCopyPromptFlow.js'
import { canKeepSecondCopyPromptOpen, canPresentSecondCopyPrompt, usePrintingManager } from './printing/usePrintingManager'
import { removeById } from './utils/dataSync.js'
import { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'
import { getPendingAmount, isOrderPaid } from './utils/paymentWorkflow'
import {
  createClient as createClientApi,
  createProduct as createProductApi,
  deleteClient as deleteClientApi,
  deleteProduct as deleteProductApi,
  refundOrder as refundOrderApi,
  registerPayment as registerPaymentApi,
  registerTableTabPayment as registerTableTabPaymentApi,
  updateClient as updateClientApi,
  updateOrderPaymentPromise as updateOrderPaymentPromiseApi,
  updateProduct as updateProductApi,
} from './api/client'

const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'
const PAYMENT_COLLECTIONS = ['orders', 'movements', 'tableTabs', 'tables']
const IMPLEMENTED_DESTINATIONS = new Set(['orders', 'history', 'new-order', 'comandas', 'print-queue', 'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables', 'settings-home', 'settings-operations', 'settings-modalities', 'settings-payments', 'settings-cancellations', 'settings-finance-categories', 'settings-printing', 'settings-device'])
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const readKitchenSoundPreference = () => {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false' } catch { return true }
}
const emptyProduct = () => ({ category: 'Refeições', presentationType: 'size', presentationValue: 'P', presentationUnit: '', name: '', price: formatBRLCurrencyValue(32) })

function App({ capabilities } = {}) {
  const [requestKey, setRequestKey] = useState(null)
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [duplicateClientDialog, setDuplicateClientDialog] = useState(null)
  const [editingProductId, setEditingProductId] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [refundOrder, setRefundOrder] = useState(null)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [kitchenSoundEnabled, setKitchenSoundEnabled] = useState(readKitchenSoundPreference)
  const [secondCopyPromptJobId, setSecondCopyPromptJobId] = useState(null)
  const [secondCopyPromptBusy, setSecondCopyPromptBusy] = useState(false)
  const [originSecondCopyPromptJobId, setOriginSecondCopyPromptJobId] = useState(null)
  const [originSecondCopyPromptBusy, setOriginSecondCopyPromptBusy] = useState(false)
  const [recoveryDialogMode, setRecoveryDialogMode] = useState(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryDiscardConfirmation, setRecoveryDiscardConfirmation] = useState(false)
  const [originOrderIds, setOriginOrderIds] = useState(() => readOriginOrderIds(typeof window === 'undefined' ? null : window.localStorage))
  const isOnline = useOnlineStatus()
  const {
    toastMessage,
    successMessage,
    setToastMessage,
    setSuccessMessage,
    showSuccessMessage,
  } = useFeedbackRuntime()
  const dismissedOriginSecondCopyJobIdsRef = useRef(new Set())
  const recoveryPromptSeenRef = useRef(false)
  const tableTabPaymentRef = useRef(null)
  const paymentDialogRef = useRef(null)
  const paymentAttemptRef = useRef(null)
  const paymentSequenceRef = useRef(0)
  // Accepted financial obligations outlive dialog/selection ownership. More than
  // one can exist when another comanda starts payment before the first responds.
  const paymentSyncRef = useRef(new Set())
  const [tableTabSync, setTableTabSync] = useState(null)
  const pausedRecoverySecondCopyJobIdRef = useRef(null)
  const previousRecoveryStateRef = useRef(null)
  const effectiveConfigVersionRef = useRef(null)
  const operationalBridgeTargetsRef = useRef({ onUnauthorized: null, settlePaymentOwners: null })
  const sessionRuntimeTargetsRef = useRef({
    refreshBootstrap: async () => {},
    resetOperationalData: () => {},
    resetSyncState: () => {},
    clearApplicationState: () => {},
  })

  const newOrderDraftTargetsRef = useRef({
    canSubmit: () => false,
    commitOfficialEffects: () => {},
    onCommitted: async () => {},
    onSuccess: () => {},
    onError: () => {},
    onConflict: async () => {},
  })
  const orderCommandTargetsRef = useRef({ onError: () => {} })
  const newOrderDraft = useNewOrderDraft({
    submitOrder: ordersApi.createOrder,
    canSubmit: (payload) => newOrderDraftTargetsRef.current.canSubmit(payload),
    commitOfficialEffects: (result) => newOrderDraftTargetsRef.current.commitOfficialEffects(result),
    onCommitted: (result, context) => newOrderDraftTargetsRef.current.onCommitted(result, context),
    onSuccess: (order, context) => newOrderDraftTargetsRef.current.onSuccess(order, context),
    onError: (error) => newOrderDraftTargetsRef.current.onError(error),
    onConflict: (context) => newOrderDraftTargetsRef.current.onConflict(context),
  })

  const refreshBootstrapForSession = useCallback(
    (...args) => sessionRuntimeTargetsRef.current.refreshBootstrap(...args),
    [],
  )
  const resetOperationalDataForSession = useCallback(
    (...args) => sessionRuntimeTargetsRef.current.resetOperationalData(...args),
    [],
  )
  const clearApplicationStateForSession = useCallback(
    (scope) => scope === 'sync'
      ? sessionRuntimeTargetsRef.current.resetSyncState()
      : sessionRuntimeTargetsRef.current.clearApplicationState(),
    [],
  )
  const {
    authState,
    sessionContext,
    sessionGeneration,
    loginError,
    handleLogin,
    handleLogout: handleSessionLogout,
    expireSession,
  } = useSessionRuntime({
    isOnline,
    requestKey,
    setRequestKey,
    resetOperationalData: resetOperationalDataForSession,
    refreshBootstrap: refreshBootstrapForSession,
    onClearApplicationState: clearApplicationStateForSession,
  })

  const granted = useMemo(
    () => capabilities === undefined
      ? (Array.isArray(sessionContext?.capabilities)
          ? new Set(sessionContext.capabilities)
          : legacyCapabilities(authState === 'authenticated'))
      : capabilities,
    [authState, capabilities, sessionContext],
  )
  const { query, patchQuery, resetQueries } = useQueryContext()
  const policyNavigationBridge = useMemo(() => createPolicyNavigationBridge(), [])
  const {
    activeTab,
    moreOpen,
    pendingDestination,
    pendingDiscardKind,
    requestNavigation,
    openMore,
    closeMore,
    confirmDiscard,
    cancelDiscard,
    resetNavigation,
    completeNavigation,
  } = useNavigationController({
    granted,
    implemented: IMPLEMENTED_DESTINATIONS,
    checkoutPending: newOrderDraft.checkoutPending,
    dirtyOrder: newOrderDraft.dirty,
    onDiscardOrder: newOrderDraft.discard,
    getNavigationDraft: policyNavigationBridge.getNavigationDraft,
    discardNavigationDraft: policyNavigationBridge.discardNavigationDraft,
    onFeedback: setToastMessage,
  })
  const operationalLegacyBridges = useMemo(() => ({
    capturePaymentOwners: () => [...paymentSyncRef.current],
    settlePaymentOwners: (owners, receipt) => operationalBridgeTargetsRef.current.settlePaymentOwners?.(owners, receipt),
  }), [])
  const handleOperationalUnauthorized = useCallback((error) => operationalBridgeTargetsRef.current.onUnauthorized?.(error), [])
  const getEffectiveConfigVersion = useCallback(() => effectiveConfigVersionRef.current, [])
  const {
    bootstrapState,
    bootstrapEffectiveConfig,
    clients,
    products,
    orders,
    tables,
    tableTabs,
    movements,
    financeSettings,
    refreshBootstrap,
    refreshBootstrapSilently,
    applyOfficialEffects,
    updateCollection,
    resetOperationalData,
    getSyncGuard,
    getOfficialRevision,
    getOfficialTables,
  } = useOperationalDataRuntime({
    onUnauthorized: handleOperationalUnauthorized,
    globalSyncEnabled: isOnline && authState === 'authenticated',
    ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated',
    effectiveConfigVersion: getEffectiveConfigVersion,
    legacyBridges: operationalLegacyBridges,
  })
  const {
    selection: selectedComanda,
    selectionGeneration: selectedComandaGeneration,
    selectComanda,
    clearComandaSelection,
    resetComandaSelection,
    ownsComandaSelection,
    getComandaSelectionOwner,
  } = useComandaSelection({ tables })
  // Session bootstrap/cleanup needs operational actions, while operational polling
  // needs auth state. Stable render-time targets break that hook-order cycle without
  // moving either responsibility back into App.
  sessionRuntimeTargetsRef.current.refreshBootstrap = refreshBootstrap
  sessionRuntimeTargetsRef.current.resetOperationalData = resetOperationalData

  const effectiveConfigOwner = useMemo(() => authState === 'authenticated'
    && sessionContext?.businessId
    && sessionContext?.settingsContextId
    && Array.isArray(sessionContext.capabilities)
    ? {
        businessId: sessionContext.businessId,
        generation: sessionGeneration,
        settingsContextId: sessionContext.settingsContextId,
        capabilities: [...granted],
      }
    : null, [authState, granted, sessionContext, sessionGeneration])
  const effectiveConfig = useEffectiveBusinessConfig({ owner: effectiveConfigOwner, bootstrapConfig: bootstrapEffectiveConfig })
  const businessConfig = effectiveConfig.config || bootstrapEffectiveConfig
  const paymentOptions = useMemo(() => businessConfig ? paymentOptionsFromEffective(businessConfig) : [], [businessConfig])
  const defaultPaymentMethod = useMemo(() => businessConfig ? paymentDefaultFromEffective(businessConfig) : '', [businessConfig])
  const cancellationOptions = useMemo(() => businessConfig ? cancellationOptionsFromEffective(businessConfig) : [], [businessConfig])
  const cancellationRevision = useMemo(() => cancellationRevisionFromEffective(businessConfig), [businessConfig])
  const financeCategoryOptions = useMemo(() => businessConfig ? financeCategoryOptionsFromEffective(businessConfig) : [], [businessConfig])
  const financeCategoryRevision = useMemo(() => financeCategoryRevisionFromEffective(businessConfig), [businessConfig])
  const modalityOptions = useMemo(() => businessConfig?.operations?.enabledModalities?.map((value) => ({
    value,
    label: value === 'Local' ? 'Consumo no local' : value,
  })) ?? [], [businessConfig])
  const defaultModality = businessConfig?.operations?.defaultModality
  const currentTiming = businessConfig?.operations?.timing
  const paymentMethodNeedsReview = paymentSelectionNeedsReview(paymentOptions, paymentMethod)
  const visiblePaymentOptions = paymentOptionsWithSelection(paymentOptions, paymentMethod)
  useEffect(() => {
    effectiveConfigVersionRef.current = effectiveConfig.config?.version || null
  }, [effectiveConfig.config])
  const canViewOperationalAnalysis = hasCapability(granted, 'orders.history')
    && hasCapability(granted, 'orders.analysis')
  const canCreateOrders = hasCapability(granted, 'orders.create')
  const canFinalizeOrders = hasCapability(granted, 'orders.finalize')
  const canCancelOrders = hasCapability(granted, 'orders.cancel')
  const canAdjustOrders = hasCapability(granted, 'orders.discount')
  const canReceivePayments = hasCapability(granted, 'payments.receive')
  const canRefundPayments = hasCapability(granted, 'payments.refund')
  const canTransferComanda = hasCapability(granted, 'comandas.transfer')
  const canManageClients = hasCapability(granted, 'clients.manage')
  const canManageProducts = hasCapability(granted, 'products.manage')
  const canManageTables = hasCapability(granted, 'tables.manage')
  const canManageMovements = hasCapability(granted, 'finance.movements.manage')
  const canManagePaymentPromises = hasCapability(granted, 'finance.promises.manage')
  const canExecutePrinting = hasCapability(granted, 'printing.execute')
  const canDiscardPrinting = hasCapability(granted, 'printing.discard')
  const canUseLocalPreferences = hasCapability(granted, 'preferences.local')
  const canViewPrintQueue = hasCapability(granted, 'printing.queue')
  const canOpenComanda = resolveDestination('comandas', granted, IMPLEMENTED_DESTINATIONS).status === 'allowed'

  const todayValue = toLocalDateValue()
  const paymentOrder = orders.find((order) => order.id === paymentTarget?.orderId) ?? null
  const paymentOrderEligible = paymentOrder && (paymentTarget?.source
    ? canReceiveStandaloneOrder(paymentOrder, granted, paymentTarget.source)
    : !isOrderPaid(paymentOrder) && !isOrderCancelled(paymentOrder))
  const writesBlockedWithoutOrderCommands = !isOnline || requestKey !== null || newOrderDraft.checkoutPending
  const orderCommands = useOrderCommands({
    orders,
    api: ordersApi,
    canFinalizeOrders,
    canCancelOrders,
    canRefundPayments,
    writesBlocked: writesBlockedWithoutOrderCommands,
    applyOfficialEffects,
    onSuccess: showSuccessMessage,
    onError: (error) => orderCommandTargetsRef.current.onError(error),
  })
  const writesBlocked = writesBlockedWithoutOrderCommands || orderCommands.pending
  const handlePhysicalJobFailure = useCallback(() => {
    setToastMessage('Impressão requer atenção na fila')
  }, [setToastMessage])
  const handleCancelDiscard = useCallback(() => {
    cancelDiscard()
    window.requestAnimationFrame(() => document.querySelector?.('.app-content')?.focus?.())
  }, [cancelDiscard])
  const printing = usePrintingManager({ authenticated: authState === 'authenticated' && bootstrapState === 'ready', isOnline, onPhysicalJobFailure: handlePhysicalJobFailure })
  const {
    jobs: printJobs,
    transportKind: printTransportKind,
    transportReady: printTransportReady,
    printerBlocked,
    printerHealth,
    recoveryState,
    recoveryPendingCount,
    recoveryPromptEligible,
    localStation: localPrintStation,
    acknowledgeSecondCopyPrompt,
  } = printing
  const physicalPrinterReady = printerHealth?.state === 'ready'
  const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders', currentTiming })
  const {
    newOrderIds,
    previewSound: previewKitchenOrderSound,
    reset: resetOrderArrivals,
  } = useOrderArrivals({ active: activeTab === 'orders', orders, now: kitchenNow, soundEnabled: kitchenSoundEnabled })
  const secondCopyPromptJob = printJobs.find((job) => job.id === secondCopyPromptJobId) ?? null
  const secondCopyPromptOrder = orders.find((order) => order.id === secondCopyPromptJob?.orderId) ?? null
  const secondCopyPromptOrderNumber = getSecondCopyPromptTitle(secondCopyPromptJob, secondCopyPromptOrder)
  const originSecondCopyPromptJob = printJobs.find((job) => job.id === originSecondCopyPromptJobId) ?? null
  const originSecondCopyPromptOrder = orders.find((order) => order.id === originSecondCopyPromptJob?.orderId) ?? null
  const originSecondCopyPromptOrderNumber = originSecondCopyPromptOrder ? formatOrderDisplayNumber(originSecondCopyPromptOrder) : 'Pedido'

  const resetSyncState = () => {
    tableTabPaymentRef.current = null
    paymentDialogRef.current = null
    paymentAttemptRef.current = null
    paymentSyncRef.current = new Set()
    setTableTabSync(null)
    effectiveConfigVersionRef.current = null
  }
  sessionRuntimeTargetsRef.current.resetSyncState = resetSyncState

  const clearBusinessData = () => {
    resetNavigation()
    resetQueries()
    resetComandaSelection()
    resetSyncState()
    resetOrderArrivals()
    dismissedOriginSecondCopyJobIdsRef.current = new Set()
    newOrderDraft.reset(); setPaymentTarget(null); setPaymentMethod(''); setRefundOrder(null); setRefundSubmitting(false); setShowClientForm(false); setDuplicateClientDialog(null); setShowProductForm(false); setSecondCopyPromptJobId(null); setSecondCopyPromptBusy(false); setRecoveryDialogMode(null); setRecoveryBusy(false); setRecoveryDiscardConfirmation(false); recoveryPromptSeenRef.current = false; pausedRecoverySecondCopyJobIdRef.current = null; previousRecoveryStateRef.current = null
  }
  sessionRuntimeTargetsRef.current.clearApplicationState = clearBusinessData

  const ownsPaymentSelection = (owner, sourceTables = null) => owner?.guard === getSyncGuard()
    && ownsComandaSelection({
      tableId: owner.tableId,
      tableTabId: owner.tabId,
      selectionGeneration: owner.selectionGeneration,
    }, sourceTables)

  const retirePaymentUI = useCallback(() => {
    const owner = tableTabPaymentRef.current
    if (owner) setRequestKey((current) => current === owner.requestKey ? null : current)
    tableTabPaymentRef.current = null
  }, [])

  useEffect(() => {
    retirePaymentUI()
  }, [selectedComandaGeneration, retirePaymentUI])

  const selectCurrentComanda = (target) => {
    const currentTables = getOfficialTables()
    const identity = resolveOpenComanda(currentTables, target)
    if (!identity) {
      setToastMessage('A comanda mudou ou não está mais disponível. A consulta foi atualizada.')
      void refreshBootstrapSilently()
      return false
    }
    return selectComanda(identity, currentTables)
  }

  newOrderDraftTargetsRef.current = {
    canSubmit: (payload) => canCreateOrders
      && (canAdjustOrders || !payload?.adjustment || payload.adjustment.type === 'none')
      && !writesBlocked,
    commitOfficialEffects: applyOfficialEffects,
    onCommitted: (result, context) => {
      const { order, tableTab, tables: nextTables } = result || {}
      if (context.returnDestination === 'comandas' && tableTab?.id) {
        const table = nextTables?.find((item) => item.isActive && item.occupancy === 'occupied' && item.openTableTab?.id === tableTab.id)
        const identity = table
          ? resolveOpenComanda(nextTables, { tableId: table.id, tableTabId: tableTab.id })
          : null
        if (identity) selectComanda(identity, nextTables)
      }
      if (order?.id) setOriginOrderIds(rememberOriginOrderId(order.id, typeof window === 'undefined' ? null : window.localStorage))
      completeNavigation(context.returnDestination)
    },
    onSuccess: (order) => {
      showSuccessMessage(order.paymentStatus === 'Pago'
        ? 'Pedido salvo e pagamento recebido'
        : (order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido enviado para a fila da cozinha'))
    },
    onConflict: async () => { await refreshBootstrapSilently() },
  }

  const publishPaymentSync = () => {
    const pending = [...paymentSyncRef.current]
    const owner = pending.find((item) => item.syncStatus === 'error') || pending[0]
    setTableTabSync(owner ? { status: owner.syncStatus, tableId: owner.tableId, tabId: owner.tabId } : null)
  }

  const settleAcceptedPayment = (owner, receipt) => {
    if (!owner?.paid || owner.guard !== getSyncGuard() || !paymentSyncRef.current.has(owner)) return false
    if (!PAYMENT_COLLECTIONS.every((key) => receipt?.applied.includes(key))) return false
    const { orders: receiptOrders, movements: receiptMovements, tableTabs: receiptTabs } = receipt.data
    if (!receiptTabs.some((tab) => tab.id === owner.tabId && tab.status === 'closed')
      || !owner.result.orders.every((order) => receiptOrders.some((item) => item.id === order.id && isOrderPaid(item)))
      || !owner.result.movements.every((movement) => receiptMovements.some((item) => item.id === movement.id))) return false
    const nextTables = receipt.data.tables
    const table = nextTables.find((item) => item.id === owner.tableId)
    const replaced = table?.openTableTab?.id && table.openTableTab.id !== owner.tabId
    if ((!replaced && table?.occupancy !== 'free') || nextTables.some((item) => item.openTableTab?.id === owner.tabId)) return false
    owner.settled = true
    paymentSyncRef.current.delete(owner)
    publishPaymentSync()
    if (ownsPaymentSelection(owner, nextTables) && !replaced) {
      clearComandaSelection()
      setSuccessMessage(`Pagamento de ${formatTableIdentifierLabel(owner.tableIdentifier)} recebido via ${owner.method}`)
    }
    return true
  }

  operationalBridgeTargetsRef.current.onUnauthorized = expireSession
  operationalBridgeTargetsRef.current.settlePaymentOwners = (owners, receipt) => owners.forEach((owner) => settleAcceptedPayment(owner, receipt))

  const showApiError = (error) => {
    if (error?.status === 401) return expireSession()
    setToastMessage(error?.message || 'Não foi possível concluir a operação.')
  }
  newOrderDraftTargetsRef.current.onError = showApiError
  orderCommandTargetsRef.current.onError = showApiError
  const tableServiceCommands = useTableServiceCommands({
    getOfficialTables,
    applyOfficialEffects,
    refreshOfficialData: refreshBootstrapSilently,
    writesBlocked,
    canManageTables,
    canTransfer: canTransferComanda,
    setRequestKey,
    onSuccess: showSuccessMessage,
    onError: showApiError,
    onStaleTarget: setToastMessage,
  })
  const handleLogout = async () => {
    try { await handleSessionLogout() } catch (error) { showApiError(error) }
  }

  const handleKitchenSoundEnabledChange = (enabled) => {
    if (!canUseLocalPreferences) return false
    const nextEnabled = Boolean(enabled)
    try { window.localStorage.setItem(KITCHEN_SOUND_STORAGE_KEY, String(nextEnabled)) } catch {
      setToastMessage('Não foi possível salvar esta preferência neste dispositivo.')
      return false
    }
    setKitchenSoundEnabled(nextEnabled)
    if (nextEnabled) void previewKitchenOrderSound()
    return true
  }

  useEffect(() => {
    const recoveryJobId = localPrintStation?.recoveryJobId ?? null
    const hasRecoveryAffinity = recoveryState !== 'normal' && Boolean(recoveryJobId)
    const resumedRecovery = previousRecoveryStateRef.current === 'deferred' && recoveryState === 'active'
    previousRecoveryStateRef.current = recoveryState
    if (resumedRecovery) pausedRecoverySecondCopyJobIdRef.current = null
    if (recoveryState === 'normal') pausedRecoverySecondCopyJobIdRef.current = null
    if (secondCopyPromptJobId) {
      const current = printJobs.find((job) => job.id === secondCopyPromptJobId)
      const currentOrder = orders.find((order) => order.id === current?.orderId)
      if (!isSecondCopyPromptEligible(current, currentOrder) || !canKeepSecondCopyPromptOpen({
        isQz: printTransportKind === 'qz',
        transportReady: printTransportReady,
        printerBlocked,
        station: localPrintStation,
        job: current,
      })) setSecondCopyPromptJobId(null)
      return
    }
    if (hasRecoveryAffinity && pausedRecoverySecondCopyJobIdRef.current === recoveryJobId) return
    if (recoveryState !== 'normal' && !hasRecoveryAffinity) return
    const candidates = hasRecoveryAffinity ? printJobs.filter((job) => job.id === recoveryJobId) : printJobs
    const next = candidates.find((job) => {
      const order = orders.find((candidate) => candidate.id === job.orderId)
      return isSecondCopyPromptEligible(job, order) && canPresentSecondCopyPrompt({
        isQz: printTransportKind === 'qz',
        transportReady: printTransportReady,
        printerBlocked,
        station: localPrintStation,
        job,
      })
    })
    if (!next?.id) return
    void acknowledgeAndOpenSecondCopyPrompt({
      job: next,
      acknowledge: acknowledgeSecondCopyPrompt,
      openPrompt: setSecondCopyPromptJobId,
      reopenAcknowledged: hasRecoveryAffinity,
    }).catch(showApiError)
  }, [printJobs, printTransportKind, localPrintStation, acknowledgeSecondCopyPrompt, orders, recoveryState, secondCopyPromptJobId, printTransportReady, printerBlocked])

  useEffect(() => {
    if (!physicalPrinterReady) {
      setRecoveryDialogMode(null)
      setRecoveryDiscardConfirmation(false)
      return
    }
    if (recoveryState === 'normal') {
      recoveryPromptSeenRef.current = false
      setRecoveryDialogMode(null)
      return
    }
    if (recoveryPromptEligible && !recoveryPromptSeenRef.current) {
      recoveryPromptSeenRef.current = true
      setRecoveryDialogMode('prompt')
    }
  }, [physicalPrinterReady, recoveryPromptEligible, recoveryState])

  useEffect(() => {
    if (printTransportKind === 'qz') return
    if (originSecondCopyPromptJobId) {
      const current = printJobs.find((job) => job.id === originSecondCopyPromptJobId)
      const currentOrder = orders.find((order) => order.id === current?.orderId)
      if (!isSecondCopyPromptEligible(current, currentOrder)) setOriginSecondCopyPromptJobId(null)
      return
    }
    const next = findOriginSecondCopyPrompt({
      jobs: printJobs,
      orders,
      originOrderIds,
      dismissedJobIds: dismissedOriginSecondCopyJobIdsRef.current,
    })
    if (next?.id) setOriginSecondCopyPromptJobId(next.id)
  }, [originOrderIds, originSecondCopyPromptJobId, orders, printJobs, printTransportKind])

  const totals = useMemo(() => {
    const validOrders = orders.filter((order) => !isOrderCancelled(order)); const salesToday = validOrders.filter((order) => order.orderDate === todayValue).reduce((total, order) => total + Number(order.total || 0), 0); const receivedToday = calculateReceivedToday(movements, todayValue); const receivables = validOrders.filter((order) => !isOrderPaid(order)).reduce((total, order) => total + getPendingAmount(order), 0); const activeOrders = orders.filter(isOrderActive).length
    return { salesToday, receivedToday, receivables, activeOrders }
  }, [movements, orders, todayValue])
  const pendingRefundOrders = useMemo(() => orders.filter((order) => getOrderRefundState(order) === 'pending'), [orders])
  const filteredClients = useMemo(() => { const normalizedSearch = query.clients.search.trim().toLowerCase(); const filtered = clients.filter((client) => !normalizedSearch || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch)); return [...filtered].sort((a, b) => query.clients.sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)) }, [clients, query.clients.search, query.clients.sort])

  const dismissSecondCopyPrompt = () => {
    if (recoveryState !== 'normal' && localPrintStation?.recoveryJobId === secondCopyPromptJob?.id) {
      pausedRecoverySecondCopyJobIdRef.current = secondCopyPromptJob.id
      if (recoveryState === 'active') void printing.deferRecovery()
    }
    setSecondCopyPromptJobId(null)
  }

  const handleGlobalSecondCopy = async () => {
    if (!canExecutePrinting || !secondCopyPromptJob || secondCopyPromptBusy) return false
    if (!canKeepSecondCopyPromptOpen({
      isQz: printTransportKind === 'qz',
      transportReady: printTransportReady,
      printerBlocked,
      station: localPrintStation,
      job: secondCopyPromptJob,
    })) {
      setSecondCopyPromptJobId(null)
      return
    }
    const isRecoverySecondCopy = recoveryState !== 'normal' && localPrintStation?.recoveryJobId === secondCopyPromptJob.id
    setSecondCopyPromptBusy(true)
    try {
      const result = await printing.printSecondCopy(secondCopyPromptJob)
      if (result?.status !== 'printed') {
        setSecondCopyPromptJobId(null)
        return
      }
      pausedRecoverySecondCopyJobIdRef.current = null
      setSecondCopyPromptJobId(null)
      if (isRecoverySecondCopy) setRecoveryDialogMode('progress')
      showSuccessMessage('2ª via enviada para impressão')
    } catch (error) {
      setSecondCopyPromptJobId(null)
      showApiError(error)
    } finally {
      setSecondCopyPromptBusy(false)
    }
  }

  const handleStartRecovery = async () => {
    if (!canExecutePrinting || recoveryBusy || !physicalPrinterReady) return false
    setRecoveryBusy(true)
    try {
      const result = await printing.startRecovery()
      setRecoveryDialogMode(result?.status === 'printed' && result?.job?.status !== 'awaiting_second_copy' ? 'progress' : null)
    } catch (error) {
      setRecoveryDialogMode(null)
      showApiError(error)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleDeferRecovery = async () => {
    if (recoveryBusy) return
    setRecoveryDialogMode(null)
    setRecoveryBusy(true)
    try {
      await printing.deferRecovery()
    } catch (error) {
      showApiError(error)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleNextRecovery = async () => {
    if (recoveryBusy || !physicalPrinterReady) return
    setRecoveryBusy(true)
    try {
      pausedRecoverySecondCopyJobIdRef.current = null
      await printing.resumeRecovery()
      const result = await printing.printNextRecovery()
      setRecoveryDialogMode(result?.status === 'printed' && result?.job?.status !== 'awaiting_second_copy' ? 'progress' : null)
    } catch (error) {
      setRecoveryDialogMode(null)
      showApiError(error)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handleDiscardRecoveryBacklog = async () => {
    if (!canDiscardPrinting || recoveryBusy || !physicalPrinterReady) return false
    setRecoveryBusy(true)
    try {
      await printing.discardRecoveryBacklog()
      setRecoveryDiscardConfirmation(false)
      setRecoveryDialogMode(null)
    } catch (error) {
      showApiError(error)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const dismissOriginSecondCopyPrompt = () => {
    if (originSecondCopyPromptJob?.id) dismissedOriginSecondCopyJobIdsRef.current.add(originSecondCopyPromptJob.id)
    setOriginSecondCopyPromptJobId(null)
  }

  const handleOriginSecondCopyRequest = async () => {
    if (!canExecutePrinting || !originSecondCopyPromptJob || originSecondCopyPromptBusy) return false
    setOriginSecondCopyPromptBusy(true)
    try {
      await printing.requestSecondCopy(originSecondCopyPromptJob)
      setOriginSecondCopyPromptJobId(null)
      showSuccessMessage('2ª via enviada para a fila da cozinha')
    } catch (error) {
      showApiError(error)
    } finally {
      setOriginSecondCopyPromptBusy(false)
    }
  }

  const validateClientIdentity = (draft, excludeId = null, action = 'create') => {
    const duplicate = findClientDuplicates(clients, draft, excludeId)
    if (duplicate.phone) { setToastMessage(`Telefone já cadastrado para ${duplicate.phone.name}.`); return false }
    if (duplicate.name) { setDuplicateClientDialog({ client: duplicate.name, action }); return false }
    return true
  }

  const handleNewOrder = ({ tableId = '', expectedTableTabId = '', returnTab = 'orders' } = {}) => {
    if (!canCreateOrders || writesBlocked) return false
    let currentTableId = tableId
    if (expectedTableTabId) {
      const currentTables = getOfficialTables()
      const selectionOwner = getComandaSelectionOwner()
      const candidate = selectionOwner?.tableTabId === expectedTableTabId
        ? { tableId: selectionOwner.tableId, tableTabId: expectedTableTabId }
        : { tableId, tableTabId: expectedTableTabId }
      const identity = resolveOpenComanda(currentTables, candidate)
      if (!identity) {
        clearComandaSelection()
        setToastMessage('A comanda mudou ou não está mais disponível. A consulta foi atualizada.')
        void refreshBootstrapSilently()
        completeNavigation(returnTab)
        return
      }
      currentTableId = identity.tableId
      selectComanda(identity, currentTables)
    }
    newOrderDraft.open({ tableId: currentTableId, expectedTableTabId, returnDestination: returnTab })
    return completeNavigation('new-order')
  }
  const handleQuickCreateClient = async ({ name, phone }) => { if (!canManageClients || writesBlocked || !name.trim()) return null; setRequestKey('client:create:quick'); try { const { client } = await createClientApi({ name: name.trim(), phone: phone || '', address: '' }); applyOfficialEffects({ client }); return client } catch (error) { showApiError(error); return null } finally { setRequestKey(null) } }
  const openPaymentModal = (orderId, source) => {
    if (!canReceivePayments || writesBlocked) return false
    const order = orders.find((item) => item.id === orderId)
    const operational = source === 'orders' || source === 'history'
    if (!order || (operational ? !canReceiveStandaloneOrder(order, granted, source) : isOrderPaid(order) || isOrderCancelled(order))) return false
    const owner = { token: ++paymentSequenceRef.current, guard: getSyncGuard(), orderId, source: operational ? source : null, submitting: false, requestKey: null, method: null }
    paymentDialogRef.current = owner
    setPaymentTarget({ orderId, source: owner.source, token: owner.token })
    setPaymentMethod(defaultPaymentMethod)
    return true
  }
  const closePaymentModal = (expectedOwner = paymentDialogRef.current) => {
    if (expectedOwner && paymentDialogRef.current !== expectedOwner) return false
    paymentDialogRef.current = null
    if (paymentAttemptRef.current === expectedOwner) paymentAttemptRef.current = null
    setPaymentTarget(null)
    setPaymentMethod('')
    if (expectedOwner?.requestKey) setRequestKey((current) => current === expectedOwner.requestKey ? null : current)
    return true
  }
  const handleRegisterPayment = async (event) => {
    event.preventDefault()
    const owner = paymentDialogRef.current
    const currentOrder = owner ? orders.find((order) => order.id === owner.orderId) : null
    const eligible = currentOrder && (owner.source
      ? canReceiveStandaloneOrder(currentOrder, granted, owner.source)
      : !isOrderPaid(currentOrder) && !isOrderCancelled(currentOrder))
    if (!canReceivePayments || !owner || owner.guard !== getSyncGuard() || owner.submitting || writesBlocked || !eligible || !paymentMethod || paymentMethodNeedsReview) return false
    owner.submitting = true
    owner.method = paymentMethod
    owner.requestKey = `payment:${owner.orderId}:${owner.token}`
    paymentAttemptRef.current = owner
    setRequestKey(owner.requestKey)
    try {
      const { order, movement, tableTab } = await registerPaymentApi(owner.orderId, owner.method)
      if (owner.guard !== getSyncGuard()) return false
      applyOfficialEffects({ order, movement, tableTab })
      if (paymentDialogRef.current === owner) {
        closePaymentModal(owner)
        showSuccessMessage(`Pagamento recebido via ${owner.method}`)
      }
      return true
    } catch (error) {
      if (owner.guard !== getSyncGuard()) return false
      if (error?.status === 409 || !Number.isInteger(error?.status) || error.status >= 500) await refreshBootstrapSilently()
      if (owner.guard !== getSyncGuard()) return false
      if (paymentDialogRef.current === owner) showApiError(error)
      return false
    } finally {
      owner.submitting = false
      if (paymentAttemptRef.current === owner) paymentAttemptRef.current = null
      setRequestKey((current) => current === owner.requestKey ? null : current)
    }
  }
  const reconcileTableTabPayment = async (owner) => {
    if (!owner) return Promise.all([...paymentSyncRef.current].map((pending) => reconcileTableTabPayment(pending)))
    if (owner.guard !== getSyncGuard() || !paymentSyncRef.current.has(owner)) return false
    owner.syncStatus = 'syncing'
    publishPaymentSync()
    // A first call either starts a post-payment read or waits for a read already on the wire.
    await refreshBootstrapSilently()
    if (owner.settled) return true
    if (owner.guard !== getSyncGuard() || !paymentSyncRef.current.has(owner)) return false
    // If the first call only awaited a pre-payment read, request post-payment authority now.
    await refreshBootstrapSilently()
    if (owner.settled) return true
    if (owner.guard !== getSyncGuard() || !paymentSyncRef.current.has(owner)) return false
    owner.syncStatus = 'error'
    publishPaymentSync()
    return false
  }

  const handleRegisterTableTabPayment = async (tableTabId, method, intent) => {
    const currentTables = getOfficialTables()
    const selected = currentTables.find((table) => table.id === intent?.tableId && table.isActive && table.occupancy === 'occupied' && table.openTableTab?.id === tableTabId && tableTabId === intent?.tableTabId)
    if (writesBlocked || tableTabPaymentRef.current || paymentSyncRef.current.size || !intent || !ownsComandaSelection(intent, currentTables) || !selected) return false
    const guard = getSyncGuard()
    const revision = getOfficialRevision()
    const owner = { guard, selectionGeneration: intent.selectionGeneration, tableId: intent.tableId, tabId: intent.tableTabId, method, requestKey: `table-tab:payment:${tableTabId}` }
    tableTabPaymentRef.current = owner
    const ownsRequest = () => getSyncGuard() === guard && tableTabPaymentRef.current === owner
    setRequestKey(owner.requestKey)
    try {
      const result = await registerTableTabPaymentApi(tableTabId, method)
      if (getSyncGuard() !== guard) return false
      owner.paid = true
      owner.result = result
      owner.tableIdentifier = result.tableTab.tableIdentifier
      owner.syncStatus = 'syncing'
      paymentSyncRef.current.add(owner)
      if (revision === getOfficialRevision()) {
        const receipt = applyOfficialEffects({ orders: result.orders, movements: result.movements, tableTab: result.tableTab, tables: result.tables })
        settleAcceptedPayment(owner, receipt)
      }
      if (!owner.settled) await reconcileTableTabPayment(owner)
      // Financial acceptance closes this dialog; pending synchronization remains
      // explicit in Comandas and blocks another payment until official settlement.
      return true
    } catch (error) {
      if (!ownsRequest() || !ownsPaymentSelection(owner)) return false
      showApiError(error)
      if (error.status === 409 && ownsRequest()) {
        await refreshBootstrapSilently()
        if (ownsRequest()) await refreshBootstrapSilently()
      }
      return false
    } finally {
      if (ownsRequest()) { tableTabPaymentRef.current = null; setRequestKey((current) => current === owner.requestKey ? null : current) }
    }
  }
  const handleOpenComanda = (target) => {
    if (!canOpenComanda) return false
    const currentTables = getOfficialTables()
    const identity = resolveOpenComanda(currentTables, target)
    if (!identity) {
      setToastMessage('A comanda mudou ou não está mais disponível. A consulta foi atualizada.')
      void refreshBootstrapSilently()
      return false
    }
    if (!requestNavigation('comandas')) return false
    return selectComanda(identity, currentTables)
  }
  const handleUpdatePaymentPromise = async (orderId, promisedPaymentDate) => {
    if (!canManagePaymentPromises || writesBlocked) return false
    setRequestKey(`payment-promise:${orderId}`)
    try {
      const { order } = await updateOrderPaymentPromiseApi(orderId, promisedPaymentDate)
      applyOfficialEffects({ order })
      showSuccessMessage(promisedPaymentDate ? 'Data prometida atualizada' : 'Data prometida removida')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleRegisterRefund = async (orderId, payload) => { if (!canRefundPayments || writesBlocked) return false; setRequestKey(`order:refund:${orderId}`); try { const { order, movement } = await refundOrderApi(orderId, payload); applyOfficialEffects({ order, movement }); showSuccessMessage('Estorno registrado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const openRefundDialog = (order) => {
    if (!canRefundPayments || !order) return false
    setRefundOrder(order)
    return true
  }
  const closeRefundDialog = () => {
    if (refundSubmitting) return false
    setRefundOrder(null)
    return true
  }
  const confirmRefund = async (payload) => {
    if (!canRefundPayments || !refundOrder || refundSubmitting) return false
    setRefundSubmitting(true)
    try {
      const saved = await handleRegisterRefund(refundOrder.id, payload)
      if (saved !== false) setRefundOrder(null)
      return saved
    } finally {
      setRefundSubmitting(false)
    }
  }

  const resetClientForm = () => { setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(false) }
  const openNewClient = () => { if (!canManageClients || writesBlocked) return false; setDuplicateClientDialog(null); setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(true); return true }
  const handleEditClient = (client) => { if (!canManageClients || writesBlocked) return false; setDuplicateClientDialog(null); setEditingClientId(client.id); setShowClientForm(true); setNewClient({ name: client.name, phone: client.phone, address: client.address }); return true }
  const clientPayload = () => ({ name: newClient.name.trim(), phone: newClient.phone || '', address: newClient.address || 'Sem endereço' })
  const persistNewClient = async () => { if (!canManageClients || writesBlocked || !newClient.name.trim()) return false; setRequestKey('client:create'); try { const { client } = await createClientApi(clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente adicionado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const persistClientUpdate = async () => { if (!canManageClients || writesBlocked || !editingClientId || !newClient.name.trim()) return false; const id = editingClientId; setRequestKey(`client:update:${id}`); try { const { client } = await updateClientApi(id, clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente atualizado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const handleAddClient = async () => { if (!canManageClients || writesBlocked || !newClient.name.trim() || !validateClientIdentity(newClient, null, 'create')) return false; return persistNewClient() }
  const handleSaveClient = async () => { if (!canManageClients || writesBlocked || !editingClientId || !newClient.name.trim() || !validateClientIdentity(newClient, editingClientId, 'update')) return false; return persistClientUpdate() }
  const handleUseExistingClient = () => { const existing = duplicateClientDialog?.client; setDuplicateClientDialog(null); if (existing?.name) patchQuery('clients', { search: existing.name }); resetClientForm() }
  const handleConfirmDuplicateClient = async () => { if (!canManageClients) return false; const action = duplicateClientDialog?.action; setDuplicateClientDialog(null); if (action === 'update') return persistClientUpdate(); if (action === 'create') return persistNewClient(); return false }
  const handleDeleteClient = async (clientId) => { if (!canManageClients || writesBlocked) return false; setRequestKey(`client:delete:${clientId}`); try { await deleteClientApi(clientId); updateCollection('clients', (current) => removeById(current, clientId)); if (editingClientId === clientId) resetClientForm(); showSuccessMessage('Cliente excluído com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const handleCancelClientEdit = () => { setDuplicateClientDialog(null); resetClientForm() }

  const openNewProduct = () => { if (!canManageProducts || writesBlocked) return false; setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(true); return true }
  const handleEditProduct = (product) => { if (!canManageProducts || writesBlocked) return false; setEditingProductId(product.id); setShowProductForm(true); const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size)); setNewProduct({ category: categoryForUi(product.category), presentationType: product.presentationType || (legacySized ? 'size' : 'unit'), presentationValue: product.presentationValue ?? (legacySized ? product.size : ''), presentationUnit: product.presentationUnit || '', name: product.name, price: formatBRLCurrencyValue(product.price) }); return true }
  const productPayload = () => ({ category: newProduct.category, presentationType: newProduct.presentationType, presentationValue: newProduct.presentationValue, presentationUnit: newProduct.presentationUnit, name: newProduct.name.trim(), price: parseBRLCurrencyInput(newProduct.price) })
  const handleAddProduct = async () => { if (!canManageProducts || writesBlocked || !newProduct.name.trim()) return false; const editing = editingProductId; setRequestKey(editing ? `product:update:${editing}` : 'product:create'); try { if (editing) { const { product } = await updateProductApi(editing, productPayload()); applyOfficialEffects({ product }); setEditingProductId(null); showSuccessMessage('Produto atualizado com sucesso') } else { const { product } = await createProductApi(productPayload()); applyOfficialEffects({ product }); showSuccessMessage('Produto adicionado com sucesso') } setNewProduct(emptyProduct()); setShowProductForm(false); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const handleDeleteProduct = async (productId) => { if (!canManageProducts || writesBlocked) return false; setRequestKey(`product:delete:${productId}`); try { await deleteProductApi(productId); updateCollection('products', (current) => removeById(current, productId)); if (editingProductId === productId) { setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(false) } showSuccessMessage('Produto excluído com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const handleCancelProductEdit = () => { setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(false) }

  const activeMobileEntry = activeTab === 'new-order' ? newOrderDraft.context?.returnDestination : undefined

  return (
    <AppRoot
      isOnline={isOnline}
      authState={authState}
      loginLoading={requestKey === 'auth:login'}
      loginError={loginError}
      onLogin={handleLogin}
      bootstrapState={bootstrapState}
      onRetryBootstrap={() => void refreshBootstrap()}
      retryDisabled={!isOnline || requestKey !== null}
      toastMessage={toastMessage}
      successMessage={successMessage}
    >
      <SettingsPolicyBoundary
        effectiveConfigOwner={effectiveConfigOwner}
        storage={typeof window === 'undefined' ? undefined : window.sessionStorage}
        navigationBridge={policyNavigationBridge}
        onFeedback={(feedback) => {
          if (feedback?.status === 401) showApiError(feedback)
          else if (feedback?.message) setToastMessage(feedback.message)
        }}
        onSessionExpired={expireSession}
        onPolicyCommitted={() => effectiveConfig.refresh()}
      >
      <NavigationProvider activeTab={activeTab} activeMobileEntry={activeMobileEntry} granted={granted} implemented={IMPLEMENTED_DESTINATIONS} moreOpen={moreOpen} requestNavigation={requestNavigation} openMore={openMore} closeMore={closeMore}>
      <AppShell onLogout={handleLogout} logoutDisabled={writesBlocked} dashboardPeriod={query.dashboard.period} onDashboardPeriodChange={(period) => patchQuery('dashboard', { period })}>
        {activeTab === 'dashboard' && <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} queryState={query.dashboard} onQueryChange={(patch) => patchQuery('dashboard', patch)} />}
        {activeTab === 'orders' && <Orders orders={orders} officialOrders={orders} now={kitchenNow} currentTiming={currentTiming} search={query.orders.search} onSearchChange={(search) => patchQuery('orders', { search })} currency={currency} onNewOrder={handleNewOrder} onFinalizeOrder={orderCommands.finalizeOrder} onCancelOrder={orderCommands.cancelOrder} onRegisterPayment={openPaymentModal} paymentDisabled={writesBlocked} paymentOptions={paymentOptions} cancellationOptions={cancellationOptions} cancellationRevision={cancellationRevision} onNavigatePrintQueue={() => requestNavigation('print-queue')} granted={granted} newOrderIds={newOrderIds} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} printing={printing} onToast={setToastMessage} canCreateOrders={canCreateOrders} canFinalizeOrders={canFinalizeOrders} canCancelOrders={canCancelOrders} canRefundPayments={canRefundPayments} canUseLocalPreferences={canUseLocalPreferences} canViewPrintQueue={canViewPrintQueue} canExecutePrinting={canExecutePrinting} />}
        {activeTab === 'history' && <OrderHistory orders={orders} currentTiming={currentTiming} currency={currency} onCancelOrder={orderCommands.cancelOrder} onRegisterPayment={openPaymentModal} paymentDisabled={writesBlocked} paymentOptions={paymentOptions} cancellationOptions={cancellationOptions} cancellationRevision={cancellationRevision} actionKey={orderCommands.actionKey} printing={printing} onToast={setToastMessage} queryState={query.history} onQueryChange={(patch) => patchQuery('history', patch)} granted={granted} canViewAnalysis={canViewOperationalAnalysis} canCancelOrders={canCancelOrders} canRefundPayments={canRefundPayments} canExecutePrinting={canExecutePrinting} />}
        {activeTab === 'new-order' && <NewOrderRoute key={newOrderDraft.renderKey ?? 'new-order'} clients={clients} products={products} tables={tables} initialTableId={newOrderDraft.context?.tableId || ''} expectedTableTabId={newOrderDraft.context?.expectedTableTabId || ''} currency={currency} disabled={writesBlocked} paymentOptions={paymentOptions} defaultPaymentMethod={defaultPaymentMethod} modalityOptions={modalityOptions} defaultModality={defaultModality} onPolicyChanged={effectiveConfig.refresh} onCancel={() => requestNavigation(newOrderDraft.context?.returnDestination || 'orders')} onCreateClient={handleQuickCreateClient} onSubmit={newOrderDraft.submit} onDraftDirtyChange={newOrderDraft.setDirty} canManageClients={canManageClients} canAdjustOrders={canAdjustOrders} />}
        {activeTab === 'clients' && <Clients clients={filteredClients} search={query.clients.search} sort={query.clients.sort} onSearchChange={(search) => patchQuery('clients', { search })} onSortChange={(sort) => patchQuery('clients', { sort })} onAdd={openNewClient} onEdit={handleEditClient} onDelete={handleDeleteClient} canManageClients={canManageClients} />}
        {activeTab === 'products' && <Products products={products} search={query.products.search} currency={currency} onSearchChange={(search) => patchQuery('products', { search })} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} queryState={query.products} onQueryChange={(patch) => patchQuery('products', patch)} canManageProducts={canManageProducts} />}
        {activeTab === 'print-queue' && <PrintQueue orders={orders} printing={printing} onOpenPrintingSettings={() => requestNavigation('settings-printing')} onToast={setToastMessage} queryState={query.printQueue} onQueryChange={(patch) => patchQuery('printQueue', patch)} canExecutePrinting={canExecutePrinting} canDiscardPrinting={canDiscardPrinting} />}
        {activeTab === 'receivables' && <Receivables orders={orders} movements={movements} currency={currency} disabled={writesBlocked} onRegisterPayment={openPaymentModal} onUpdatePaymentPromise={handleUpdatePaymentPromise} queryState={query.receivables} onQueryChange={(patch) => patchQuery('receivables', patch)} canReceivePayments={canReceivePayments} canManagePaymentPromises={canManagePaymentPromises} canExecutePrinting={canExecutePrinting} />}
        {activeTab === 'finance' && <FinanceWorkspace movements={movements} financeSettings={financeSettings} today={todayValue} currency={currency} pendingRefundOrders={pendingRefundOrders} paymentOptions={paymentOptions} categoryOptions={financeCategoryOptions} categoryRevision={financeCategoryRevision} writesBlocked={writesBlocked} canManageMovements={canManageMovements} canRefundPayments={canRefundPayments} applyOfficialEffects={applyOfficialEffects} setRequestKey={setRequestKey} onSuccess={showSuccessMessage} onError={showApiError} formatCancellationDate={formatCancellationDate} onRequestRefund={openRefundDialog} />}
        {activeTab === 'tables' && <Tables tables={tables} disabled={writesBlocked} canOpenComanda={canOpenComanda} onCreate={tableServiceCommands.createTable} onRename={tableServiceCommands.renameTable} onSetActive={tableServiceCommands.setTableActive} onReorder={tableServiceCommands.reorderTables} onOpenComanda={handleOpenComanda} canManageTables={canManageTables} />}
        {activeTab === 'comandas' && (
          <TableServiceExternalActions
            selection={selectedComanda}
            selectionGeneration={selectedComandaGeneration}
            disabled={writesBlocked || Boolean(tableTabSync)}
            paymentOptions={paymentOptions}
            defaultPaymentMethod={defaultPaymentMethod}
            currency={currency}
            onPay={handleRegisterTableTabPayment}
            onApiError={showApiError}
            onToast={setToastMessage}
            printing={printing}
          >
            {({ requestPayment, requestPreview, requestPrint, printingBusy, printingFeedback, printingAvailable }) => (
              <Comandas
                tables={tables}
                selection={selectedComanda}
                selectionGeneration={selectedComandaGeneration}
                onSelectComanda={selectCurrentComanda}
                onAddOrder={(owner) => handleNewOrder({ tableId: owner.tableId, expectedTableTabId: owner.tableTabId, returnTab: 'comandas' })}
                canTransfer={canTransferComanda}
                onTransfer={tableServiceCommands.transferTableTab}
                onApiError={showApiError}
                onRequestPayment={requestPayment}
                onRequestPreview={requestPreview}
                onRequestPrint={requestPrint}
                printingBusy={printingBusy}
                printingFeedback={printingFeedback}
                printingAvailable={printingAvailable}
                paymentSync={tableTabSync}
                onRetryPaymentSync={() => reconcileTableTabPayment()}
                currency={currency}
                disabled={writesBlocked}
                canCreateOrders={canCreateOrders}
                canExecutePrinting={canExecutePrinting}
              />
            )}
          </TableServiceExternalActions>
        )}
        {(activeTab === 'settings-home' || activeTab === 'settings-operations' || activeTab === 'settings-modalities' || activeTab === 'settings-payments' || activeTab === 'settings-cancellations' || activeTab === 'settings-finance-categories' || activeTab === 'settings-printing' || activeTab === 'settings-device') && <SettingsSurface section={activeTab} printing={printing} granted={granted} implemented={IMPLEMENTED_DESTINATIONS} onNavigate={requestNavigation} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} onSuccessMessage={showSuccessMessage} />}

        {pendingDestination && (
          <Modal title={pendingDiscardKind === 'policy' ? 'Descartar alterações?' : 'Descartar venda em andamento?'} onClose={handleCancelDiscard}>
            <div className="form-stack">
              <p>{pendingDiscardKind === 'policy'
                ? 'As alterações ainda não salvas serão descartadas.'
                : 'As informações preenchidas e os produtos adicionados serão descartados.'}</p>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={handleCancelDiscard}>{pendingDiscardKind === 'policy' ? 'Continuar editando' : 'Continuar na venda'}</Button>
                <Button type="button" onClick={confirmDiscard}>{pendingDiscardKind === 'policy' ? 'Descartar alterações' : 'Descartar venda'}</Button>
              </div>
            </div>
          </Modal>
        )}

        {paymentOrderEligible && <Modal title="Registrar pagamento" onClose={() => closePaymentModal()}><form className="form-stack" onSubmit={handleRegisterPayment}><div className="payment-summary-card"><span>{paymentOrder.client} · {formatOrderDisplayNumber(paymentOrder)}</span><strong>{currency(paymentOrder.total)}</strong><small>O pagamento será lançado automaticamente como entrada no Financeiro.</small></div><div className="form-field"><span>Forma de pagamento</span><SystemSelect value={paymentMethod} options={visiblePaymentOptions} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" /></div>{paymentMethodNeedsReview && <p className="form-error" role="alert">A forma escolhida não está mais ativa. Revise a seleção antes de confirmar.</p>}<div className="form-actions"><Button type="button" variant="secondary" onClick={() => closePaymentModal()}>Cancelar</Button><Button type="submit" disabled={writesBlocked || !paymentMethod || paymentMethodNeedsReview}>Confirmar pagamento</Button></div></form></Modal>}

        {canManageClients && showClientForm && <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}><div className="form-stack"><label className="form-field"><span>Nome</span><input type="text" autoComplete="name" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label><label className="form-field"><span>Telefone</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} /></label><label className="form-field"><span>Endereço</span><input type="text" autoComplete="street-address" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} /></label><div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newClient.name.trim()} onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>{editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}</Button></div></div></Modal>}
        {canManageClients && duplicateClientDialog && <ClientDuplicateModal client={duplicateClientDialog.client} onCancel={() => setDuplicateClientDialog(null)} onUseExisting={handleUseExistingClient} onConfirm={handleConfirmDuplicateClient} disabled={writesBlocked} cancelLabel="Cancelar" useExistingLabel="Usar cliente existente" confirmLabel="Cadastrar mesmo assim" />}
        {canManageProducts && showProductForm && <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}><ProductForm value={newProduct} onChange={setNewProduct} onSubmit={handleAddProduct} onCancel={handleCancelProductEdit} disabled={writesBlocked} editing={editingProductId !== null} /></Modal>}
        <RegisterRefundDialog open={canRefundPayments && Boolean(refundOrder)} order={refundOrder} paymentOptions={paymentOptions} onClose={closeRefundDialog} onConfirm={confirmRefund} submitting={refundSubmitting} />
      </AppShell>
      </NavigationProvider>
      </SettingsPolicyBoundary>

      {recoveryPromptEligible && physicalPrinterReady && recoveryDialogMode === 'prompt' && (
        <Modal title="Impressora disponível novamente" onClose={() => { void handleDeferRecovery() }}>
          <div className="form-stack">
            <p>{`Há ${recoveryPendingCount} trabalhos aguardando impressão.`}</p>
            <p>Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.</p>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => { void handleDeferRecovery() }} disabled={recoveryBusy}>Agora não</Button>
              <Button type="button" variant="secondary" onClick={() => { if (!canDiscardPrinting) return; setRecoveryDialogMode(null); setRecoveryDiscardConfirmation(true) }} disabled={recoveryBusy || !canDiscardPrinting}>Descartar todas</Button>
              <Button type="button" onClick={() => { void handleStartRecovery() }} disabled={recoveryBusy || !canExecutePrinting}>Imprimir agora</Button>
            </div>
          </div>
        </Modal>
      )}
      {recoveryDialogMode === 'progress' && physicalPrinterReady && recoveryState === 'deferred' && recoveryPendingCount > 0 && (
        <ConfirmationDialog
          title="Via impressa"
          message="Separe o papel antes de continuar."
          confirmLabel="Imprimir próxima"
          cancelLabel="Parar por agora"
          confirmVariant="secondary"
          onClose={() => { void handleDeferRecovery() }}
          onConfirm={() => { void handleNextRecovery() }}
          disabled={recoveryBusy || Boolean(printing.busyJobId)}
        />
      )}
      {recoveryDiscardConfirmation && physicalPrinterReady && (
        <ConfirmationDialog
          title={`Descartar ${recoveryPendingCount} trabalhos?`}
          message="Somente trabalhos pendentes sem envio físico serão descartados."
          confirmLabel="Descartar todas"
          cancelLabel="Voltar"
          onClose={() => setRecoveryDiscardConfirmation(false)}
          onConfirm={() => { void handleDiscardRecoveryBacklog() }}
          disabled={recoveryBusy || !canDiscardPrinting}
        />
      )}
      {secondCopyPromptJob && (
        <ConfirmationDialog
          title={`${secondCopyPromptOrderNumber} · 1ª via impressa`}
          message="Destaque o papel na serrilha antes de continuar."
          confirmLabel="Imprimir 2ª via"
          cancelLabel={recoveryState !== 'normal' && localPrintStation?.recoveryJobId === secondCopyPromptJob.id ? 'Parar por agora' : 'Depois'}
          onClose={dismissSecondCopyPrompt}
          onConfirm={handleGlobalSecondCopy}
          disabled={secondCopyPromptBusy || Boolean(printing.busyJobId) || !canExecutePrinting}
        />
      )}
      {originSecondCopyPromptJob && (
        <ConfirmationDialog
          title={`${originSecondCopyPromptOrderNumber} · 1ª via impressa`}
          message="A segunda via será solicitada para a fila da cozinha."
          confirmLabel="Solicitar 2ª via"
          cancelLabel="Depois"
          onClose={dismissOriginSecondCopyPrompt}
          onConfirm={handleOriginSecondCopyRequest}
          disabled={originSecondCopyPromptBusy || !canExecutePrinting}
        />
      )}
    </AppRoot>
  )
}

export default App
