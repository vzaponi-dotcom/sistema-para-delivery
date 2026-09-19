import {
  FinanceWorkspace,
  calculateReceivedToday,
  financeCategoryOptionsFromEffective,
  financeCategoryRevisionFromEffective,
  paymentDefaultFromEffective,
  paymentOptionsFromEffective,
} from './domains/finance/index.js'
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
import ConfirmationDialog from './components/ConfirmationDialog'
import Modal from './components/Modal'
import RegisterRefundDialog from './app/workflows/refunds/RegisterRefundDialog.jsx'
import { useRefundWorkflow } from './app/workflows/refunds/useRefundWorkflow.js'
import {
  cancellationOptionsFromEffective,
  cancellationRevisionFromEffective,
  formatCancellationDate,
  getPendingAmount,
  getOrderRefundState,
  isOrderActive,
  isOrderCancelled,
  isOrderPaid,
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
import Dashboard from './pages/Dashboard'
import PrintQueue from './pages/PrintQueue'
import SettingsPolicyBoundary from './app/surfaces/settings/SettingsPolicyBoundary.jsx'
import SettingsSurface from './app/surfaces/settings/SettingsSurface.jsx'
import TableServiceExternalActions from './app/surfaces/table-service/TableServiceExternalActions.jsx'
import ReceivablesSurface from './app/surfaces/finance/ReceivablesSurface.jsx'
import OrderPaymentDialog from './app/workflows/payments/order/OrderPaymentDialog.jsx'
import { useOrderPaymentWorkflow } from './app/workflows/payments/order/useOrderPaymentWorkflow.js'
import { useTableTabPaymentWorkflow } from './app/workflows/payments/table-tab/useTableTabPaymentWorkflow.js'
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
import { CustomersWorkspace, useQuickCreateCustomerCommand } from './domains/customers/index.js'
import { formatOrderDisplayNumber } from '../shared/orderDisplayNumber.js'
import { CatalogWorkspace } from './domains/catalog/index.js'
import {
  acknowledgeAndOpenSecondCopyPrompt, canKeepSecondCopyPromptOpen, canPresentSecondCopyPrompt,
  findOriginSecondCopyPrompt, getSecondCopyPromptTitle, isSecondCopyPromptEligible,
} from './domains/printing/index.js'
import { readOriginOrderIds, rememberOriginOrderId } from './printing/secondCopyPromptFlow.js'
import { usePrintingManager } from './printing/usePrintingManager'

const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'
const IMPLEMENTED_DESTINATIONS = new Set(['orders', 'history', 'new-order', 'comandas', 'print-queue', 'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables', 'settings-home', 'settings-operations', 'settings-modalities', 'settings-payments', 'settings-cancellations', 'settings-finance-categories', 'settings-printing', 'settings-device'])
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const readKitchenSoundPreference = () => {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false' } catch { return true }
}

function App({ capabilities } = {}) {
  const [requestKey, setRequestKey] = useState(null)
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
  const pausedRecoverySecondCopyJobIdRef = useRef(null)
  const previousRecoveryStateRef = useRef(null)
  const effectiveConfigVersionRef = useRef(null)
  const operationalRuntimeTargetsRef = useRef({ onUnauthorized: null })
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
  const handleOperationalUnauthorized = useCallback((error) => operationalRuntimeTargetsRef.current.onUnauthorized?.(error), [])
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
    resetOperationalData,
    getSyncGuard,
    getOfficialRevision,
    getOfficialTables,
  } = useOperationalDataRuntime({
    onUnauthorized: handleOperationalUnauthorized,
    globalSyncEnabled: isOnline && authState === 'authenticated',
    ordersSyncEnabled: activeTab === 'orders' && isOnline && authState === 'authenticated',
    effectiveConfigVersion: getEffectiveConfigVersion,
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
  const quickCreateCustomer = useQuickCreateCustomerCommand({
    writesBlocked,
    canManageClients,
    applyOfficialEffects,
    setRequestKey,
    onError: showApiError,
  })
  const orderPayment = useOrderPaymentWorkflow({
    orders,
    granted,
    canReceivePayments,
    writesBlocked,
    paymentOptions,
    defaultPaymentMethod,
    getSyncGuard,
    applyOfficialEffects,
    refreshOfficialData: refreshBootstrapSilently,
    setRequestKey,
    onSuccess: showSuccessMessage,
    onError: showApiError,
  })
  const tableTabPayment = useTableTabPaymentWorkflow({
    writesBlocked,
    selectionGeneration: selectedComandaGeneration,
    resetKey: sessionGeneration,
    getOfficialTables,
    ownsSelection: ownsComandaSelection,
    clearSelection: clearComandaSelection,
    getSyncGuard,
    getOfficialRevision,
    applyOfficialEffects,
    refreshOfficialData: refreshBootstrapSilently,
    setRequestKey,
    onSuccess: showSuccessMessage,
    onError: showApiError,
  })
  const refund = useRefundWorkflow({
    canRefundPayments,
    writesBlocked,
    applyOfficialEffects,
    setRequestKey,
    onSuccess: showSuccessMessage,
    onError: showApiError,
  })
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
    orderPayment.close()
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
    newOrderDraft.reset(); refund.close(); setSecondCopyPromptJobId(null); setSecondCopyPromptBusy(false); setRecoveryDialogMode(null); setRecoveryBusy(false); setRecoveryDiscardConfirmation(false); recoveryPromptSeenRef.current = false; pausedRecoverySecondCopyJobIdRef.current = null; previousRecoveryStateRef.current = null
  }
  sessionRuntimeTargetsRef.current.clearApplicationState = clearBusinessData

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

  operationalRuntimeTargetsRef.current.onUnauthorized = expireSession

  function showApiError(error) {
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
        {activeTab === 'orders' && <Orders orders={orders} officialOrders={orders} now={kitchenNow} currentTiming={currentTiming} search={query.orders.search} onSearchChange={(search) => patchQuery('orders', { search })} currency={currency} onNewOrder={handleNewOrder} onFinalizeOrder={orderCommands.finalizeOrder} onCancelOrder={orderCommands.cancelOrder} onRegisterPayment={orderPayment.open} paymentDisabled={writesBlocked} paymentOptions={paymentOptions} cancellationOptions={cancellationOptions} cancellationRevision={cancellationRevision} onNavigatePrintQueue={() => requestNavigation('print-queue')} granted={granted} newOrderIds={newOrderIds} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} printing={printing} onToast={setToastMessage} canCreateOrders={canCreateOrders} canFinalizeOrders={canFinalizeOrders} canCancelOrders={canCancelOrders} canRefundPayments={canRefundPayments} canUseLocalPreferences={canUseLocalPreferences} canViewPrintQueue={canViewPrintQueue} canExecutePrinting={canExecutePrinting} />}
        {activeTab === 'history' && <OrderHistory orders={orders} currentTiming={currentTiming} currency={currency} onCancelOrder={orderCommands.cancelOrder} onRegisterPayment={orderPayment.open} paymentDisabled={writesBlocked} paymentOptions={paymentOptions} cancellationOptions={cancellationOptions} cancellationRevision={cancellationRevision} actionKey={orderCommands.actionKey} printing={printing} onToast={setToastMessage} queryState={query.history} onQueryChange={(patch) => patchQuery('history', patch)} granted={granted} canViewAnalysis={canViewOperationalAnalysis} canCancelOrders={canCancelOrders} canRefundPayments={canRefundPayments} canExecutePrinting={canExecutePrinting} />}
        {activeTab === 'new-order' && <NewOrderRoute key={newOrderDraft.renderKey ?? 'new-order'} clients={clients} products={products} tables={tables} initialTableId={newOrderDraft.context?.tableId || ''} expectedTableTabId={newOrderDraft.context?.expectedTableTabId || ''} currency={currency} disabled={writesBlocked} paymentOptions={paymentOptions} defaultPaymentMethod={defaultPaymentMethod} modalityOptions={modalityOptions} defaultModality={defaultModality} onPolicyChanged={effectiveConfig.refresh} onCancel={() => requestNavigation(newOrderDraft.context?.returnDestination || 'orders')} onCreateClient={quickCreateCustomer} onSubmit={newOrderDraft.submit} onDraftDirtyChange={newOrderDraft.setDirty} canManageClients={canManageClients} canAdjustOrders={canAdjustOrders} />}
        {activeTab === 'clients' && <CustomersWorkspace clients={clients} search={query.clients.search} sort={query.clients.sort} onSearchChange={(search) => patchQuery('clients', { search })} onSortChange={(sort) => patchQuery('clients', { sort })} writesBlocked={writesBlocked} canManageClients={canManageClients} applyOfficialEffects={applyOfficialEffects} setRequestKey={setRequestKey} onSuccess={showSuccessMessage} onError={showApiError} onDuplicatePhone={setToastMessage} />}
        <CatalogWorkspace visible={activeTab === 'products'} products={products} search={query.products.search} queryState={query.products} onSearchChange={(search) => patchQuery('products', { search })} onQueryChange={(patch) => patchQuery('products', patch)} currency={currency} writesBlocked={writesBlocked} canManageProducts={canManageProducts} applyOfficialEffects={applyOfficialEffects} setRequestKey={setRequestKey} onSuccess={showSuccessMessage} onError={showApiError} />
        {activeTab === 'print-queue' && <PrintQueue orders={orders} printing={printing} onOpenPrintingSettings={() => requestNavigation('settings-printing')} onToast={setToastMessage} queryState={query.printQueue} onQueryChange={(patch) => patchQuery('printQueue', patch)} canExecutePrinting={canExecutePrinting} canDiscardPrinting={canDiscardPrinting} />}
        {activeTab === 'receivables' && <ReceivablesSurface orders={orders} movements={movements} currency={currency} disabled={writesBlocked} onRegisterPayment={orderPayment.open} queryState={query.receivables} onQueryChange={(patch) => patchQuery('receivables', patch)} canReceivePayments={canReceivePayments} canManagePaymentPromises={canManagePaymentPromises} canExecutePrinting={canExecutePrinting} applyOfficialEffects={applyOfficialEffects} setRequestKey={setRequestKey} onSuccess={showSuccessMessage} onError={showApiError} />}
        {activeTab === 'finance' && <FinanceWorkspace movements={movements} financeSettings={financeSettings} today={todayValue} currency={currency} pendingRefundOrders={pendingRefundOrders} paymentOptions={paymentOptions} categoryOptions={financeCategoryOptions} categoryRevision={financeCategoryRevision} writesBlocked={writesBlocked} canManageMovements={canManageMovements} canRefundPayments={canRefundPayments} applyOfficialEffects={applyOfficialEffects} setRequestKey={setRequestKey} onSuccess={showSuccessMessage} onError={showApiError} formatCancellationDate={formatCancellationDate} onRequestRefund={refund.request} />}
        {activeTab === 'tables' && <Tables tables={tables} disabled={writesBlocked} canOpenComanda={canOpenComanda} onCreate={tableServiceCommands.createTable} onRename={tableServiceCommands.renameTable} onSetActive={tableServiceCommands.setTableActive} onReorder={tableServiceCommands.reorderTables} onOpenComanda={handleOpenComanda} canManageTables={canManageTables} />}
        {activeTab === 'comandas' && (
          <TableServiceExternalActions
            selection={selectedComanda}
            selectionGeneration={selectedComandaGeneration}
            disabled={writesBlocked || tableTabPayment.busy}
            paymentOptions={paymentOptions}
            defaultPaymentMethod={defaultPaymentMethod}
            currency={currency}
            onPay={tableTabPayment.pay}
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
                paymentSync={tableTabPayment.syncState}
                onRetryPaymentSync={tableTabPayment.retrySync}
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

        {orderPayment.dialog && <OrderPaymentDialog dialog={orderPayment.dialog} currency={currency} />}

        <RegisterRefundDialog open={canRefundPayments && Boolean(refund.refundOrder)} order={refund.refundOrder} paymentOptions={paymentOptions} onClose={refund.close} onConfirm={refund.confirm} submitting={refund.submitting} />
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
