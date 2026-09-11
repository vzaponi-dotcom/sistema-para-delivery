import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import './central-data.css'
import './new-order.css'
import './client-duplicate.css'
import './product-form.css'
import './finance-mobile.css'
import AppShell from './components/AppShell'
import Button from './components/Button'
import ClientDuplicateModal from './components/ClientDuplicateModal'
import ConfirmationDialog from './components/ConfirmationDialog'
import ConnectionBanner from './components/ConnectionBanner'
import Icon from './components/Icon'
import LoginScreen from './components/LoginScreen'
import Modal from './components/Modal'
import MovementDialog from './components/MovementDialog'
import OpeningBalanceDialog from './components/OpeningBalanceDialog'
import ProductForm from './components/ProductForm'
import PrintingSettings from './components/PrintingSettings'
import SystemSelect from './components/SystemSelect'
import { PAYMENT_METHOD_OPTIONS } from './utils/paymentMethodOptions.js'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import { NewOrderRoute, tableTabsFromBootstrap } from './pages/NewOrderRoute'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Receivables from './pages/Receivables'
import Finance from './pages/Finance'
import OrderHistory from './pages/OrderHistory'
import PrintQueue from './pages/PrintQueue'
import Tables from './pages/Tables'
import Comandas from './pages/Comandas'
import { legacyCapabilities } from './app/access.js'
import { useNavigationController } from './app/useNavigationController.js'
import { useQueryContext } from './app/useQueryContext.js'
import { findClientDuplicates } from '../shared/clientIdentity.js'
import { formatOrderDisplayNumber } from '../shared/orderDisplayNumber.js'
import { categoryForUi } from '../shared/productCatalog.js'
import { useKitchenClock } from './hooks/useKitchenClock.js'
import { acknowledgeAndOpenSecondCopyPrompt, findOriginSecondCopyPrompt, readOriginOrderIds, rememberOriginOrderId } from './printing/secondCopyPromptFlow.js'
import { canKeepSecondCopyPromptOpen, canPresentSecondCopyPrompt, usePrintingManager } from './printing/usePrintingManager'
import { createCollectionSyncGuard, removeById, upsertById, upsertManyById } from './utils/dataSync.js'
import { calculateCurrentBalance } from './utils/finance.js'
import { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'
import { getOrderItemsSearchText } from './utils/orderCart'
import { getOrderRefundState, isOrderActive, isOrderCancelled } from './utils/orderLifecycle.js'
import { detectOperationalArrivals } from './utils/orderRealtime.js'
import { toLocalDateValue } from './utils/orderWorkflow'
import { calculateReceivedToday, getPendingAmount, isOrderPaid } from './utils/paymentWorkflow'
import { formatTableIdentifierLabel } from './utils/receivables.js'
import {
  cancelOrder as cancelOrderApi,
  createClient as createClientApi,
  createMovement as createMovementApi,
  createOrder as createOrderApi,
  createProduct as createProductApi,
  createTable as createTableApi,
  deleteClient as deleteClientApi,
  deleteMovement as deleteMovementApi,
  deleteProduct as deleteProductApi,
  getBootstrap as getBootstrapApi,
  getOrders as getOrdersApi,
  getSession as getSessionApi,
  login as loginApi,
  logout as logoutApi,
  refundOrder as refundOrderApi,
  registerPayment as registerPaymentApi,
  registerTableTabPayment as registerTableTabPaymentApi,
  reorderTables as reorderTablesApi,
  saveFinanceSettings as saveFinanceSettingsApi,
  updateClient as updateClientApi,
  updateMovement as updateMovementApi,
  updateOrderStatus as updateOrderStatusApi,
  updateOrderPaymentPromise as updateOrderPaymentPromiseApi,
  updateProduct as updateProductApi,
  updateTable as updateTableApi,
  transferTableTab as transferTableTabApi,
} from './api/client'

const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'
const DATA_COLLECTIONS = ['clients', 'products', 'orders', 'tables', 'tableTabs', 'movements', 'financeSettings']
const PAYMENT_COLLECTIONS = ['orders', 'movements', 'tableTabs', 'tables']
const GLOBAL_SYNC_INTERVAL_MS = 5_000
const ORDER_SYNC_INTERVAL_MS = 2_000
const IMPLEMENTED_DESTINATIONS = new Set(['orders', 'history', 'new-order', 'comandas', 'print-queue', 'dashboard', 'receivables', 'finance', 'clients', 'products', 'tables'])
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const isAwaitingSecondCopyJob = (job) => job?.status === 'awaiting_second_copy' && Number(job?.copiesRequested) === 2 && Number(job?.copiesPrinted) === 1
const isSecondCopyPromptEligible = (job, order) => isAwaitingSecondCopyJob(job) && isOrderActive(order)

// Arrival detection moved from getNewOperationalOrderIds into one clock-driven effect below.

const readKitchenSoundPreference = () => {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false' } catch { return true }
}
const emptyProduct = () => ({ category: 'Refeições', presentationType: 'size', presentationValue: 'P', presentationUnit: '', name: '', price: formatBRLCurrencyValue(32) })

function App({ capabilities } = {}) {
  const [authState, setAuthState] = useState('checking')
  const [bootstrapState, setBootstrapState] = useState('idle')
  const [requestKey, setRequestKey] = useState(null)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [loginError, setLoginError] = useState('')
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [tables, setTables] = useState([])
  const [tableTabs, setTableTabs] = useState([])
  const [movements, setMovements] = useState([])
  const [financeSettings, setFinanceSettings] = useState(null)
  const [selectedComandaTableId, setSelectedComandaTableId] = useState(null)
  const [selectedComandaGeneration, setSelectedComandaGeneration] = useState(0)
  const [checkoutKey, setCheckoutKey] = useState(null)
  const [newOrderContext, setNewOrderContext] = useState({ tableId: '', expectedTableTabId: '', returnTab: 'orders', owner: null })
  const [newOrderDirty, setNewOrderDirty] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [duplicateClientDialog, setDuplicateClientDialog] = useState(null)
  const [editingProductId, setEditingProductId] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState(null)
  const [openingBalanceDialogOpen, setOpeningBalanceDialogOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [paymentOrderId, setPaymentOrderId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())
  const [kitchenSoundEnabled, setKitchenSoundEnabled] = useState(readKitchenSoundPreference)
  const [secondCopyPromptJobId, setSecondCopyPromptJobId] = useState(null)
  const [secondCopyPromptBusy, setSecondCopyPromptBusy] = useState(false)
  const [originSecondCopyPromptJobId, setOriginSecondCopyPromptJobId] = useState(null)
  const [originSecondCopyPromptBusy, setOriginSecondCopyPromptBusy] = useState(false)
  const [recoveryDialogMode, setRecoveryDialogMode] = useState(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryDiscardConfirmation, setRecoveryDiscardConfirmation] = useState(false)
  const [originOrderIds, setOriginOrderIds] = useState(() => readOriginOrderIds(typeof window === 'undefined' ? null : window.localStorage))
  const [showPrintingSettings, setShowPrintingSettings] = useState(false)
  const knownOperationalOrderIdsRef = useRef(undefined)
  const alertedOrderIdsRef = useRef(new Set())
  const kitchenAudioContextRef = useRef(null)
  const newOrderHighlightTimerRef = useRef(null)
  const syncGuardRef = useRef(createCollectionSyncGuard(DATA_COLLECTIONS))
  const bootstrapSyncInFlightRef = useRef(false)
  const ordersSyncInFlightRef = useRef(false)
  const dismissedOriginSecondCopyJobIdsRef = useRef(new Set())
  const recoveryPromptSeenRef = useRef(false)
  const newOrderOwnerRef = useRef(0)
  const tableTabPaymentRef = useRef(null)
  const comandaSelectionRef = useRef(0)
  const comandaIdentityRef = useRef({ tableId: null, tabId: null })
  const officialRevisionRef = useRef(0)
  const officialTablesRef = useRef([])
  // Accepted financial obligations outlive dialog/selection ownership. More than
  // one can exist when another comanda starts payment before the first responds.
  const paymentSyncRef = useRef(new Set())
  const [tableTabSync, setTableTabSync] = useState(null)
  const pausedRecoverySecondCopyJobIdRef = useRef(null)
  const previousRecoveryStateRef = useRef(null)

  const invalidateNewOrderDraft = useCallback(() => {
    newOrderOwnerRef.current += 1
    setCheckoutKey(null)
    setNewOrderContext({ tableId: '', expectedTableTabId: '', returnTab: 'orders', owner: null })
    setNewOrderDirty(false)
  }, [])

  const granted = useMemo(
    () => capabilities === undefined
      ? legacyCapabilities(authState === 'authenticated')
      : capabilities,
    [authState, capabilities],
  )
  const { query, patchQuery, resetQueries } = useQueryContext()
  const {
    activeTab,
    pendingDestination,
    requestNavigation,
    confirmDiscard,
    cancelDiscard,
    resetNavigation,
    completeNavigation,
  } = useNavigationController({
    granted,
    implemented: IMPLEMENTED_DESTINATIONS,
    checkoutPending: requestKey === 'order:create',
    dirtyOrder: newOrderDirty,
    onDiscardOrder: invalidateNewOrderDraft,
    onFeedback: setToastMessage,
  })

  const todayValue = toLocalDateValue()
  const paymentOrder = orders.find((order) => order.id === paymentOrderId) ?? null
  const writesBlocked = !isOnline || requestKey !== null
  const handlePhysicalJobFailure = useCallback(() => {
    setToastMessage('Impressão requer atenção na fila')
  }, [])
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
  const kitchenNow = useKitchenClock(orders, { active: activeTab === 'orders' })
  const secondCopyPromptJob = printJobs.find((job) => job.id === secondCopyPromptJobId) ?? null
  const secondCopyPromptOrder = orders.find((order) => order.id === secondCopyPromptJob?.orderId) ?? null
  const secondCopyPromptOrderNumber = secondCopyPromptOrder ? formatOrderDisplayNumber(secondCopyPromptOrder) : 'Pedido'
  const originSecondCopyPromptJob = printJobs.find((job) => job.id === originSecondCopyPromptJobId) ?? null
  const originSecondCopyPromptOrder = orders.find((order) => order.id === originSecondCopyPromptJob?.orderId) ?? null
  const originSecondCopyPromptOrderNumber = originSecondCopyPromptOrder ? formatOrderDisplayNumber(originSecondCopyPromptOrder) : 'Pedido'

  const resetSyncState = () => {
    tableTabPaymentRef.current = null
    paymentSyncRef.current = new Set()
    setTableTabSync(null)
    comandaIdentityRef.current = { tableId: null, tabId: null }
    officialTablesRef.current = []
    officialRevisionRef.current = 0
    comandaSelectionRef.current += 1
    setSelectedComandaGeneration(comandaSelectionRef.current)
    syncGuardRef.current = createCollectionSyncGuard(DATA_COLLECTIONS)
    bootstrapSyncInFlightRef.current = false
    ordersSyncInFlightRef.current = false
  }

  const clearBusinessData = () => {
    resetNavigation()
    resetQueries()
    setSelectedComandaTableId(null)
    resetSyncState()
    setProducts([]); setClients([]); setOrders([]); setTables([]); setTableTabs([]); setMovements([]); setFinanceSettings(null); setNewOrderIds(new Set())
    knownOperationalOrderIdsRef.current = undefined; alertedOrderIdsRef.current = new Set(); dismissedOriginSecondCopyJobIdsRef.current = new Set()
    invalidateNewOrderDraft(); setPaymentOrderId(null); setMovementDialogOpen(false); setEditingMovement(null); setOpeningBalanceDialogOpen(false); setShowClientForm(false); setDuplicateClientDialog(null); setShowProductForm(false); setSecondCopyPromptJobId(null); setSecondCopyPromptBusy(false); setRecoveryDialogMode(null); setRecoveryBusy(false); setRecoveryDiscardConfirmation(false); recoveryPromptSeenRef.current = false; pausedRecoverySecondCopyJobIdRef.current = null; previousRecoveryStateRef.current = null
  }

  const ownsPaymentSelection = (owner) => owner?.guard === syncGuardRef.current
    && owner.selection === comandaSelectionRef.current
    && owner.tableId === comandaIdentityRef.current.tableId
    && owner.tabId === comandaIdentityRef.current.tabId

  const retirePaymentUI = () => {
    const owner = tableTabPaymentRef.current
    if (owner) setRequestKey((current) => current === owner.requestKey ? null : current)
    tableTabPaymentRef.current = null
  }

  const selectComandaTable = (tableId) => {
    retirePaymentUI()
    comandaSelectionRef.current += 1
    setSelectedComandaGeneration(comandaSelectionRef.current)
    comandaIdentityRef.current = { tableId, tabId: officialTablesRef.current.find((table) => table.id === tableId)?.openTableTab?.id ?? null }
    setSelectedComandaTableId(tableId)
  }

  const publishPaymentSync = () => {
    const pending = [...paymentSyncRef.current]
    const owner = pending.find((item) => item.syncStatus === 'error') || pending[0]
    setTableTabSync(owner ? { status: owner.syncStatus, tableId: owner.tableId, tabId: owner.tabId } : null)
  }

  const settleAcceptedPayment = (owner, receipt) => {
    if (!owner?.paid || owner.guard !== syncGuardRef.current || !paymentSyncRef.current.has(owner)) return false
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
    if (ownsPaymentSelection(owner) && !replaced) {
      selectComandaTable(null)
      setSuccessMessage(`Pagamento de ${formatTableIdentifierLabel(owner.tableIdentifier)} recebido via ${owner.method}`)
    }
    return true
  }

  const applyOfficialTables = (nextTables) => {
    officialTablesRef.current = nextTables
    const identity = comandaIdentityRef.current
    const transferredTable = identity.tabId
      ? nextTables.find((table) => table.id !== identity.tableId && table.openTableTab?.id === identity.tabId)
      : null
    const replacementTab = nextTables.find((table) => table.id === identity.tableId)?.openTableTab?.id
    if (transferredTable) {
      comandaIdentityRef.current = { tableId: transferredTable.id, tabId: identity.tabId }
      setSelectedComandaTableId(transferredTable.id)
    } else if (replacementTab && replacementTab !== identity.tabId) {
      retirePaymentUI()
      comandaSelectionRef.current += 1
      setSelectedComandaGeneration(comandaSelectionRef.current)
      comandaIdentityRef.current = { tableId: identity.tableId, tabId: replacementTab }
    }
    setTables(nextTables)
  }

  const applyBootstrapCollections = (data, token, paymentOwners) => {
    const guard = syncGuardRef.current
    // A receipt describes this one snapshot, not the mixture left in React state.
    const receipt = { data, applied: PAYMENT_COLLECTIONS.filter((key) => Array.isArray(data?.[key]) && guard.canApply(token, key)) }
    if (PAYMENT_COLLECTIONS.some((key) => guard.canApply(token, key))) officialRevisionRef.current += 1
    if (guard.canApply(token, 'clients')) setClients(Array.isArray(data?.clients) ? data.clients : [])
    if (guard.canApply(token, 'products')) setProducts(Array.isArray(data?.products) ? data.products : [])
    if (guard.canApply(token, 'orders')) setOrders(Array.isArray(data?.orders) ? data.orders : [])
    if (guard.canApply(token, 'tables')) applyOfficialTables(Array.isArray(data?.tables) ? data.tables : [])
    if (guard.canApply(token, 'tableTabs')) setTableTabs(tableTabsFromBootstrap(data))
    if (guard.canApply(token, 'movements')) setMovements(Array.isArray(data?.movements) ? data.movements : [])
    if (guard.canApply(token, 'financeSettings')) setFinanceSettings(data?.financeSettings ?? null)
    paymentOwners.forEach((owner) => settleAcceptedPayment(owner, receipt))
    return receipt
  }

  const applyOfficialEffects = ({ order, orders: nextOrders, movement, movements: nextMovements, deletedMovementId, financeSettings, table, tables: nextTables, tableTab, client, product }) => {
    const changed = []
    if (order || Array.isArray(nextOrders)) changed.push('orders')
    if (movement || deletedMovementId || Array.isArray(nextMovements)) changed.push('movements')
    if (financeSettings !== undefined) changed.push('financeSettings')
    if (table) changed.push('tables')
    if (Array.isArray(nextTables)) changed.push('tables')
    if (tableTab) changed.push('tableTabs')
    if (client) changed.push('clients')
    if (product) changed.push('products')
    syncGuardRef.current.markMutation(changed)
    if (changed.some((key) => PAYMENT_COLLECTIONS.includes(key))) officialRevisionRef.current += 1
    if (order) setOrders((current) => upsertById(current, order))
    if (Array.isArray(nextOrders) && nextOrders.length) setOrders((current) => upsertManyById(current, nextOrders))
    if (movement) setMovements((current) => upsertById(current, movement))
    if (Array.isArray(nextMovements) && nextMovements.length) setMovements((current) => upsertManyById(current, nextMovements))
    if (deletedMovementId) setMovements((current) => removeById(current, deletedMovementId))
    if (financeSettings !== undefined) setFinanceSettings(financeSettings)
    if (table) applyOfficialTables(upsertById(officialTablesRef.current, table))
    if (Array.isArray(nextTables)) applyOfficialTables(nextTables)
    if (tableTab) setTableTabs((current) => upsertById(current, tableTab))
    if (client) setClients((current) => upsertById(current, client))
    if (product) setProducts((current) => upsertById(current, product))
    return { applied: changed, data: { orders: nextOrders, movements: nextMovements, tableTabs: tableTab ? [tableTab] : undefined, tables: nextTables } }
  }

  const expireSession = () => {
    clearBusinessData(); setAuthState('anonymous'); setBootstrapState('idle'); setRequestKey(null); setLoginError('Sua sessão expirou. Entre novamente.')
  }
  const showApiError = (error) => {
    if (error?.status === 401) return expireSession()
    setToastMessage(error?.message || 'Não foi possível concluir a operação.')
  }

  const refreshBootstrap = ({ background = false } = {}) => {
    if (bootstrapSyncInFlightRef.current) return bootstrapSyncInFlightRef.current
    const guard = syncGuardRef.current
    const token = guard.beginRead(DATA_COLLECTIONS)
    // Only obligations already accepted when this read starts can use its receipt.
    const paymentOwners = [...paymentSyncRef.current]
    if (!background) setBootstrapState('loading')
    const read = async () => {
      try {
        const data = await getBootstrapApi()
        if (guard !== syncGuardRef.current) return false
        const receipt = applyBootstrapCollections(data, token, paymentOwners)
        if (!background) setBootstrapState('ready')
        return receipt
      } catch (error) {
        if (guard !== syncGuardRef.current) return false
        if (error?.status === 401) expireSession()
        else if (!background) setBootstrapState('error')
        return false
      } finally {
        if (guard === syncGuardRef.current) bootstrapSyncInFlightRef.current = false
      }
    }
    const pending = read()
    bootstrapSyncInFlightRef.current = pending
    return pending
  }
  const refreshBootstrapSilently = () => refreshBootstrap({ background: true })

  const playKitchenNewOrderSound = async () => {
    if (typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    try {
      if (!kitchenAudioContextRef.current) kitchenAudioContextRef.current = new AudioContextClass()
      const context = kitchenAudioContextRef.current
      if (context.state === 'suspended') await context.resume()
      if (context.state !== 'running') return
      const playTone = (frequency, delay) => {
        const oscillator = context.createOscillator(); const gain = context.createGain(); const startsAt = context.currentTime + delay
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, startsAt); gain.gain.setValueAtTime(0.0001, startsAt); gain.gain.exponentialRampToValueAtTime(0.14, startsAt + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(startsAt); oscillator.stop(startsAt + 0.2)
      }
      playTone(784, 0); playTone(988, 0.16)
    } catch { /* Browsers may block audio until the first user interaction. */ }
  }

  const handleKitchenSoundEnabledChange = (enabled) => {
    const nextEnabled = Boolean(enabled); setKitchenSoundEnabled(nextEnabled)
    try { window.localStorage.setItem(KITCHEN_SOUND_STORAGE_KEY, String(nextEnabled)) } catch { /* optional */ }
    if (nextEnabled) void playKitchenNewOrderSound()
  }

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      try {
        const session = await getSessionApi()
        if (cancelled) return
        if (!session?.authenticated) return setAuthState('anonymous')
        setAuthState('authenticated')
        if (!cancelled) await refreshBootstrap()
      } catch { if (!cancelled) { setAuthState('anonymous'); setBootstrapState('idle') } }
    }
    void initialize(); return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true); const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])
  useEffect(() => {
    if (!kitchenSoundEnabled) return undefined
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      try { if (!kitchenAudioContextRef.current) kitchenAudioContextRef.current = new AudioContextClass(); if (kitchenAudioContextRef.current.state === 'suspended') void kitchenAudioContextRef.current.resume() } catch { /* retry later */ }
    }
    window.addEventListener('pointerdown', unlockAudio, { passive: true }); window.addEventListener('keydown', unlockAudio)
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio) }
  }, [kitchenSoundEnabled])

  useEffect(() => {
    if (!isOnline || authState !== 'authenticated' || bootstrapState !== 'ready') return undefined
    let cancelled = false
    const sync = () => { if (!cancelled) void refreshBootstrapSilently() }
    sync()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshBootstrapSilently() }, GLOBAL_SYNC_INTERVAL_MS)
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshBootstrapSilently() }
    const handleFocus = () => void refreshBootstrapSilently()
    document.addEventListener('visibilitychange', handleVisibilityChange); window.addEventListener('focus', handleFocus)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('focus', handleFocus) }
  }, [authState, bootstrapState, isOnline])

  useEffect(() => {
    if (activeTab !== 'orders' || !isOnline || authState !== 'authenticated' || bootstrapState !== 'ready') return undefined
    let cancelled = false
    const refreshOrders = async () => {
      if (ordersSyncInFlightRef.current || cancelled) return
      ordersSyncInFlightRef.current = true
      const token = syncGuardRef.current.beginRead(['orders'])
      try {
        const data = await getOrdersApi()
        if (cancelled || !Array.isArray(data?.orders) || !syncGuardRef.current.canApply(token, 'orders')) return
        const latestOrders = data.orders
        officialRevisionRef.current += 1
        setOrders(latestOrders)
      } catch (error) { if (!cancelled && error?.status === 401) expireSession() } finally { ordersSyncInFlightRef.current = false }
    }
    void refreshOrders()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshOrders() }, ORDER_SYNC_INTERVAL_MS)
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshOrders() }; const handleFocus = () => void refreshOrders()
    document.addEventListener('visibilitychange', handleVisibilityChange); window.addEventListener('focus', handleFocus)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('focus', handleFocus) }
  }, [activeTab, authState, bootstrapState, isOnline])

  useEffect(() => {
    if (activeTab !== 'orders') {
      knownOperationalOrderIdsRef.current = undefined
      return
    }
    const { currentIds, newIds: detectedIds } = detectOperationalArrivals(
      knownOperationalOrderIdsRef.current,
      orders,
      kitchenNow,
      alertedOrderIdsRef.current,
    )
    knownOperationalOrderIdsRef.current = currentIds
    if (!detectedIds.length) return
    detectedIds.forEach((id) => alertedOrderIdsRef.current.add(id))
    setNewOrderIds((current) => new Set([...current, ...detectedIds]))
    if (kitchenSoundEnabled) void playKitchenNewOrderSound()
    if (newOrderHighlightTimerRef.current) window.clearTimeout(newOrderHighlightTimerRef.current)
    newOrderHighlightTimerRef.current = window.setTimeout(() => {
      setNewOrderIds(new Set())
      newOrderHighlightTimerRef.current = null
    }, 2600)
  }, [activeTab, orders, kitchenNow, kitchenSoundEnabled])

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

  useEffect(() => () => { if (newOrderHighlightTimerRef.current) window.clearTimeout(newOrderHighlightTimerRef.current); if (kitchenAudioContextRef.current?.close) void kitchenAudioContextRef.current.close() }, [])
  useEffect(() => { if (!toastMessage) return; const timer = window.setTimeout(() => setToastMessage(''), 2600); return () => window.clearTimeout(timer) }, [toastMessage])
  useEffect(() => { if (!successMessage) return; const timer = window.setTimeout(() => setSuccessMessage(''), 1800); return () => window.clearTimeout(timer) }, [successMessage])

  const totals = useMemo(() => {
    const validOrders = orders.filter((order) => !isOrderCancelled(order)); const salesToday = validOrders.filter((order) => order.orderDate === todayValue).reduce((total, order) => total + Number(order.total || 0), 0); const receivedToday = calculateReceivedToday(movements, todayValue); const receivables = validOrders.filter((order) => !isOrderPaid(order)).reduce((total, order) => total + getPendingAmount(order), 0); const activeOrders = orders.filter(isOrderActive).length
    return { salesToday, receivedToday, receivables, activeOrders }
  }, [movements, orders, todayValue])
  const financialTotals = useMemo(() => { const entries = movements.filter((movement) => movement.type === 'entrada').reduce((total, movement) => total + Number(movement.value), 0); const exits = movements.filter((movement) => movement.type === 'saida').reduce((total, movement) => total + Number(movement.value), 0); return { entries, exits, balance: entries - exits } }, [movements])
  const currentFinanceBalance = useMemo(() => calculateCurrentBalance(movements, financeSettings), [financeSettings, movements])
  const pendingRefundOrders = useMemo(() => orders.filter((order) => getOrderRefundState(order) === 'pending'), [orders])
  const filteredClients = useMemo(() => { const normalizedSearch = query.clients.search.trim().toLowerCase(); const filtered = clients.filter((client) => !normalizedSearch || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch)); return [...filtered].sort((a, b) => query.clients.sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)) }, [clients, query.clients.search, query.clients.sort])
  const filteredOrders = useMemo(() => { const normalizedSearch = query.orders.search.trim().toLowerCase(); return orders.filter((order) => !normalizedSearch || [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod].join(' ').toLowerCase().includes(normalizedSearch)) }, [orders, query.orders.search])
  const showSuccessMessage = (message = 'Ação salva com sucesso') => setSuccessMessage(message)

  const dismissSecondCopyPrompt = () => {
    if (recoveryState !== 'normal' && localPrintStation?.recoveryJobId === secondCopyPromptJob?.id) {
      pausedRecoverySecondCopyJobIdRef.current = secondCopyPromptJob.id
      if (recoveryState === 'active') void printing.deferRecovery()
    }
    setSecondCopyPromptJobId(null)
  }

  const handleGlobalSecondCopy = async () => {
    if (!secondCopyPromptJob || secondCopyPromptBusy) return
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
    if (recoveryBusy || !physicalPrinterReady) return
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
    if (recoveryBusy || !physicalPrinterReady) return
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
    if (!originSecondCopyPromptJob || originSecondCopyPromptBusy) return
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

  const handleLogin = async (pin) => {
    if (!isOnline || requestKey) return
    setRequestKey('auth:login'); setLoginError('')
    try { await loginApi(pin); resetSyncState(); setAuthState('authenticated'); await refreshBootstrap() } catch (error) { clearBusinessData(); setAuthState('anonymous'); setBootstrapState('idle'); setLoginError(error?.code === 'INVALID_PIN' ? 'PIN inválido. Confira e tente novamente.' : (error?.message || 'Não foi possível entrar no sistema.')) } finally { setRequestKey(null) }
  }
  const handleLogout = async () => { if (writesBlocked) return; setRequestKey('auth:logout'); try { await logoutApi(); clearBusinessData(); setAuthState('anonymous'); setBootstrapState('idle'); setLoginError('') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }

  const handleNewOrder = ({ tableId = '', expectedTableTabId = '', returnTab = 'orders' } = {}) => {
    if (writesBlocked) return
    const owner = newOrderOwnerRef.current + 1
    newOrderOwnerRef.current = owner
    setNewOrderContext({ tableId, expectedTableTabId, returnTab, owner })
    if (tableId) selectComandaTable(tableId)
    setCheckoutKey(crypto.randomUUID())
    setNewOrderDirty(false)
    completeNavigation('new-order')
  }

  const handleOrderCheckout = async (payload) => {
    const owner = newOrderContext.owner
    if (writesBlocked || !owner || owner !== newOrderOwnerRef.current) return false
    const key = checkoutKey || crypto.randomUUID(); if (!checkoutKey) setCheckoutKey(key); setRequestKey('order:create')
    try {
      const { order, movement, tableTab, tables: nextTables } = await createOrderApi(payload, key)
      if (owner !== newOrderOwnerRef.current) return false
      applyOfficialEffects({ order, movement, tableTab, tables: nextTables })
      setOriginOrderIds(rememberOriginOrderId(order.id, typeof window === 'undefined' ? null : window.localStorage))
      setRequestKey(null)
      showSuccessMessage(order.paymentStatus === 'Pago' ? 'Pedido salvo e pagamento recebido' : (order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido enviado para a fila da cozinha'))
      invalidateNewOrderDraft()
      completeNavigation(newOrderContext.returnTab)
      return true
    } catch (error) {
      if (owner !== newOrderOwnerRef.current) return false
      if (error?.status === 409 && newOrderContext.expectedTableTabId) await refreshBootstrapSilently()
      if (owner !== newOrderOwnerRef.current) return false
      showApiError(error)
      return false
    } finally {
      if (owner === newOrderOwnerRef.current) setRequestKey(null)
    }
  }
  const handleQuickCreateClient = async ({ name, phone }) => { if (writesBlocked || !name.trim()) return null; setRequestKey('client:create:quick'); try { const { client } = await createClientApi({ name: name.trim(), phone: phone || '', address: '' }); applyOfficialEffects({ client }); return client } catch (error) { showApiError(error); return null } finally { setRequestKey(null) } }
  const handleFinalizeOrder = async (orderId) => { if (writesBlocked) return; const currentOrder = orders.find((item) => item.id === orderId); if (!currentOrder) return; setRequestKey(`order:status:${orderId}`); try { const { order } = await updateOrderStatusApi(orderId, 'Finalizado'); applyOfficialEffects({ order }); showSuccessMessage(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleCancelOrder = async (orderId, payload) => { if (writesBlocked) return false; setRequestKey(`order:cancel:${orderId}`); try { const { order, movement, tableTab } = await cancelOrderApi(orderId, payload); applyOfficialEffects({ order, movement, tableTab }); showSuccessMessage(payload.refundNow ? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const openPaymentModal = (orderId) => { if (writesBlocked) return; const order = orders.find((item) => item.id === orderId); if (!order || isOrderPaid(order) || isOrderCancelled(order)) return; setPaymentOrderId(orderId); setPaymentMethod('Pix') }
  const closePaymentModal = () => { setPaymentOrderId(null); setPaymentMethod('Pix') }
  const handleRegisterPayment = async (event) => { event.preventDefault(); if (writesBlocked || !paymentOrder || isOrderPaid(paymentOrder) || isOrderCancelled(paymentOrder)) return; setRequestKey(`payment:${paymentOrder.id}`); try { const { order, movement, tableTab } = await registerPaymentApi(paymentOrder.id, paymentMethod); applyOfficialEffects({ order, movement, tableTab }); closePaymentModal(); showSuccessMessage(`Pagamento recebido via ${paymentMethod}`) } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const reconcileTableTabPayment = async (owner) => {
    if (!owner) return Promise.all([...paymentSyncRef.current].map((pending) => reconcileTableTabPayment(pending)))
    if (owner.guard !== syncGuardRef.current || !paymentSyncRef.current.has(owner)) return false
    owner.syncStatus = 'syncing'
    publishPaymentSync()
    // Wait for any read already on the wire, then request post-payment authority.
    if (bootstrapSyncInFlightRef.current) await bootstrapSyncInFlightRef.current
    if (owner.settled) return true
    if (owner.guard !== syncGuardRef.current || !paymentSyncRef.current.has(owner)) return false
    await refreshBootstrapSilently()
    if (owner.settled) return true
    if (owner.guard !== syncGuardRef.current || !paymentSyncRef.current.has(owner)) return false
    owner.syncStatus = 'error'
    publishPaymentSync()
    return false
  }

  const handleRegisterTableTabPayment = async (tableTabId, method) => {
    const selected = tables.find((table) => table.id === selectedComandaTableId && table.isActive && table.openTableTab?.id === tableTabId)
    if (writesBlocked || tableTabPaymentRef.current || paymentSyncRef.current.size || !selected) return false
    const guard = syncGuardRef.current
    const revision = officialRevisionRef.current
    const owner = { guard, selection: comandaSelectionRef.current, tableId: selected.id, tabId: tableTabId, method, requestKey: `table-tab:payment:${tableTabId}` }
    tableTabPaymentRef.current = owner
    const ownsRequest = () => syncGuardRef.current === guard && tableTabPaymentRef.current === owner
    setRequestKey(owner.requestKey)
    try {
      const result = await registerTableTabPaymentApi(tableTabId, method)
      if (syncGuardRef.current !== guard) return false
      owner.paid = true
      owner.result = result
      owner.tableIdentifier = result.tableTab.tableIdentifier
      owner.syncStatus = 'syncing'
      paymentSyncRef.current.add(owner)
      if (revision === officialRevisionRef.current) {
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
        if (bootstrapSyncInFlightRef.current) await bootstrapSyncInFlightRef.current
        if (ownsRequest()) await refreshBootstrapSilently()
      }
      return false
    } finally {
      if (ownsRequest()) { tableTabPaymentRef.current = null; setRequestKey((current) => current === owner.requestKey ? null : current) }
    }
  }
  const handleCreateTable = async (name) => {
    if (writesBlocked) return false
    setRequestKey('table:create')
    try {
      const result = await createTableApi({ name })
      applyOfficialEffects({ tables: result.tables })
      showSuccessMessage('Mesa adicionada com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleRenameTable = async (tableId, name) => {
    if (writesBlocked) return false
    setRequestKey(`table:rename:${tableId}`)
    try {
      const result = await updateTableApi(tableId, { name })
      applyOfficialEffects({ tables: result.tables })
      showSuccessMessage('Mesa renomeada com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleSetTableActive = async (tableId, isActive) => {
    if (writesBlocked) return false
    setRequestKey(`table:active:${tableId}`)
    try {
      const result = await updateTableApi(tableId, { isActive })
      applyOfficialEffects({ tables: result.tables })
      showSuccessMessage(isActive ? 'Mesa ativada com sucesso' : 'Mesa desativada com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleReorderTables = async (tableIds) => {
    if (writesBlocked) return false
    setRequestKey('table:reorder')
    try {
      const result = await reorderTablesApi(tableIds)
      applyOfficialEffects({ tables: result.tables })
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleTransferTableTab = async (sourceTableId, destinationTableId, expectedTableTabId) => {
    if (writesBlocked) return false
    setRequestKey(`table:transfer:${sourceTableId}`)
    try {
      const result = await transferTableTabApi(sourceTableId, destinationTableId, expectedTableTabId)
      applyOfficialEffects({ tables: result.tables, tableTab: result.tableTab })
      showSuccessMessage('Comanda transferida com sucesso')
      return true
    } catch (error) {
      if (error?.status === 409) await refreshBootstrapSilently()
      showApiError(error)
      return false
    } finally { setRequestKey(null) }
  }
  const handleUpdatePaymentPromise = async (orderId, promisedPaymentDate) => {
    if (writesBlocked) return false
    setRequestKey(`payment-promise:${orderId}`)
    try {
      const { order } = await updateOrderPaymentPromiseApi(orderId, promisedPaymentDate)
      applyOfficialEffects({ order })
      showSuccessMessage(promisedPaymentDate ? 'Data prometida atualizada' : 'Data prometida removida')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleRegisterRefund = async (orderId, payload) => { if (writesBlocked) return false; setRequestKey(`order:refund:${orderId}`); try { const { order, movement } = await refundOrderApi(orderId, payload); applyOfficialEffects({ order, movement }); showSuccessMessage('Estorno registrado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }

  const resetClientForm = () => { setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(false) }
  const openNewClient = () => { if (writesBlocked) return; setDuplicateClientDialog(null); setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(true) }
  const handleEditClient = (client) => { if (writesBlocked) return; setDuplicateClientDialog(null); setEditingClientId(client.id); setShowClientForm(true); setNewClient({ name: client.name, phone: client.phone, address: client.address }) }
  const clientPayload = () => ({ name: newClient.name.trim(), phone: newClient.phone || '', address: newClient.address || 'Sem endereço' })
  const persistNewClient = async () => { if (writesBlocked || !newClient.name.trim()) return; setRequestKey('client:create'); try { const { client } = await createClientApi(clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente adicionado com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const persistClientUpdate = async () => { if (writesBlocked || !editingClientId || !newClient.name.trim()) return; const id = editingClientId; setRequestKey(`client:update:${id}`); try { const { client } = await updateClientApi(id, clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente atualizado com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleAddClient = async () => { if (writesBlocked || !newClient.name.trim() || !validateClientIdentity(newClient, null, 'create')) return; await persistNewClient() }
  const handleSaveClient = async () => { if (writesBlocked || !editingClientId || !newClient.name.trim() || !validateClientIdentity(newClient, editingClientId, 'update')) return; await persistClientUpdate() }
  const handleUseExistingClient = () => { const existing = duplicateClientDialog?.client; setDuplicateClientDialog(null); if (existing?.name) patchQuery('clients', { search: existing.name }); resetClientForm() }
  const handleConfirmDuplicateClient = async () => { const action = duplicateClientDialog?.action; setDuplicateClientDialog(null); if (action === 'update') await persistClientUpdate(); else if (action === 'create') await persistNewClient() }
  const handleDeleteClient = async (clientId) => { if (writesBlocked) return; setRequestKey(`client:delete:${clientId}`); try { await deleteClientApi(clientId); syncGuardRef.current.markMutation(['clients']); setClients((current) => removeById(current, clientId)); if (editingClientId === clientId) resetClientForm(); showSuccessMessage('Cliente excluído com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleCancelClientEdit = () => { setDuplicateClientDialog(null); resetClientForm() }

  const openNewProduct = () => { if (writesBlocked) return; setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(true) }
  const handleEditProduct = (product) => { if (writesBlocked) return; setEditingProductId(product.id); setShowProductForm(true); const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size)); setNewProduct({ category: categoryForUi(product.category), presentationType: product.presentationType || (legacySized ? 'size' : 'unit'), presentationValue: product.presentationValue ?? (legacySized ? product.size : ''), presentationUnit: product.presentationUnit || '', name: product.name, price: formatBRLCurrencyValue(product.price) }) }
  const productPayload = () => ({ category: newProduct.category, presentationType: newProduct.presentationType, presentationValue: newProduct.presentationValue, presentationUnit: newProduct.presentationUnit, name: newProduct.name.trim(), price: parseBRLCurrencyInput(newProduct.price) })
  const handleAddProduct = async () => { if (writesBlocked || !newProduct.name.trim()) return; const editing = editingProductId; setRequestKey(editing ? `product:update:${editing}` : 'product:create'); try { if (editing) { const { product } = await updateProductApi(editing, productPayload()); applyOfficialEffects({ product }); setEditingProductId(null); showSuccessMessage('Produto atualizado com sucesso') } else { const { product } = await createProductApi(productPayload()); applyOfficialEffects({ product }); showSuccessMessage('Produto adicionado com sucesso') } setNewProduct(emptyProduct()); setShowProductForm(false) } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleDeleteProduct = async (productId) => { if (writesBlocked) return; setRequestKey(`product:delete:${productId}`); try { await deleteProductApi(productId); syncGuardRef.current.markMutation(['products']); setProducts((current) => removeById(current, productId)); if (editingProductId === productId) { setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(false) } showSuccessMessage('Produto excluído com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleCancelProductEdit = () => { setEditingProductId(null); setNewProduct(emptyProduct()); setShowProductForm(false) }

  const openNewMovement = () => { if (writesBlocked) return; setEditingMovement(null); setMovementDialogOpen(true) }
  const openEditMovement = (movement) => { if (writesBlocked || movement?.source !== 'manual') return; setEditingMovement(movement); setMovementDialogOpen(true) }
  const closeMovementDialog = () => { setMovementDialogOpen(false); setEditingMovement(null) }
  const handleSaveMovement = async (payload) => {
    if (writesBlocked) return false
    const movementId = editingMovement?.id ?? null
    setRequestKey(movementId ? `movement:update:${movementId}` : 'movement:create')
    try {
      const { movement } = movementId ? await updateMovementApi(movementId, payload) : await createMovementApi(payload)
      applyOfficialEffects({ movement })
      showSuccessMessage(movementId ? 'Movimentação atualizada com sucesso' : 'Movimentação registrada com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleDeleteMovement = async (movementId) => {
    if (writesBlocked) return false
    setRequestKey(`movement:delete:${movementId}`)
    try {
      const { deletedMovementId } = await deleteMovementApi(movementId)
      applyOfficialEffects({ deletedMovementId })
      showSuccessMessage('Movimentação excluída com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const openOpeningBalanceDialog = () => { if (!writesBlocked) setOpeningBalanceDialogOpen(true) }
  const handleSaveFinanceSettings = async (payload) => {
    if (writesBlocked) return false
    setRequestKey('finance-settings:save')
    try {
      const { financeSettings } = await saveFinanceSettingsApi(payload)
      applyOfficialEffects({ financeSettings })
      showSuccessMessage('Saldo inicial atualizado com sucesso')
      return true
    } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }

  if (authState === 'checking') return <div className="system-state-screen"><div className="system-state-card"><h2>Carregando sistema</h2><p>Verificando sua sessão…</p></div></div>
  if (authState === 'anonymous') return <>{!isOnline && <ConnectionBanner />}<LoginScreen onLogin={handleLogin} loading={requestKey === 'auth:login'} error={loginError} disabled={!isOnline} /></>
  if (bootstrapState !== 'ready') return <>{!isOnline && <ConnectionBanner />}<div className="system-state-screen"><div className="system-state-card">{bootstrapState === 'error' ? <><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={() => void refreshBootstrap()} disabled={!isOnline || requestKey !== null}>Tentar novamente</Button></> : <><h2>Carregando dados</h2><p>Sincronizando a operação da Amor &amp; Sabor…</p></>}</div></div></>

  return (
    <>
      {!isOnline && <ConnectionBanner />}
      {toastMessage && (typeof document === 'undefined' ? <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{toastMessage}</div> : createPortal(<div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{toastMessage}</div>, document.body))}
      {successMessage && (typeof document === 'undefined' ? <div className="success-confirmation-overlay" role="status" aria-live="polite"><div className="success-confirmation-card"><span className="success-confirmation-icon"><Icon name="check" size={30} /></span><strong>{successMessage}</strong></div></div> : createPortal(<div className="success-confirmation-overlay" role="status" aria-live="polite"><div className="success-confirmation-card"><span className="success-confirmation-icon"><Icon name="check" size={30} /></span><strong>{successMessage}</strong></div></div>, document.body))}
      <AppShell activeTab={activeTab} onNavigate={requestNavigation} onLogout={handleLogout} logoutDisabled={writesBlocked} dashboardPeriod={query.dashboard.period} onDashboardPeriodChange={(period) => patchQuery('dashboard', { period })}>
        {activeTab === 'dashboard' && <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} queryState={query.dashboard} onQueryChange={(patch) => patchQuery('dashboard', patch)} />}
        {activeTab === 'orders' && <Orders orders={filteredOrders} now={kitchenNow} search={query.orders.search} onSearchChange={(search) => patchQuery('orders', { search })} currency={currency} onNewOrder={handleNewOrder} onFinalizeOrder={handleFinalizeOrder} onCancelOrder={handleCancelOrder} onNavigateHistory={() => requestNavigation('history')} onNavigatePrintQueue={() => requestNavigation('print-queue')} newOrderIds={newOrderIds} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} printing={printing} onToast={setToastMessage} />}
        {activeTab === 'history' && <OrderHistory orders={orders} currency={currency} onCancelOrder={handleCancelOrder} actionKey={requestKey} printing={printing} onToast={setToastMessage} queryState={query.history} onQueryChange={(patch) => patchQuery('history', patch)} />}
        {activeTab === 'new-order' && <NewOrderRoute key={newOrderContext.owner ?? 'new-order'} clients={clients} products={products} tables={tables} tableTabs={tableTabs} initialTableId={newOrderContext.tableId} expectedTableTabId={newOrderContext.expectedTableTabId} currency={currency} disabled={writesBlocked} onCancel={() => requestNavigation(newOrderContext.returnTab)} onCreateClient={handleQuickCreateClient} onSubmit={handleOrderCheckout} onDraftDirtyChange={setNewOrderDirty} />}
        {activeTab === 'clients' && <Clients clients={filteredClients} search={query.clients.search} sort={query.clients.sort} onSearchChange={(search) => patchQuery('clients', { search })} onSortChange={(sort) => patchQuery('clients', { sort })} onAdd={openNewClient} onEdit={handleEditClient} onDelete={handleDeleteClient} />}
        {activeTab === 'products' && <Products products={products} search={query.products.search} currency={currency} onSearchChange={(search) => patchQuery('products', { search })} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} queryState={query.products} onQueryChange={(patch) => patchQuery('products', patch)} />}
        {activeTab === 'print-queue' && <PrintQueue orders={orders} printing={printing} onOpenPrintingSettings={() => setShowPrintingSettings(true)} onToast={setToastMessage} queryState={query.printQueue} onQueryChange={(patch) => patchQuery('printQueue', patch)} />}
        {activeTab === 'receivables' && <Receivables orders={orders} movements={movements} currency={currency} disabled={writesBlocked} onRegisterPayment={openPaymentModal} onUpdatePaymentPromise={handleUpdatePaymentPromise} queryState={query.receivables} onQueryChange={(patch) => patchQuery('receivables', patch)} />}
        {activeTab === 'finance' && <Finance totals={financialTotals} movements={movements} financeSettings={financeSettings} currentBalance={currentFinanceBalance} currency={currency} onAddMovement={openNewMovement} onEditMovement={openEditMovement} onDeleteMovement={handleDeleteMovement} onConfigureOpeningBalance={openOpeningBalanceDialog} pendingRefundOrders={pendingRefundOrders} onRegisterRefund={handleRegisterRefund} />}
        {activeTab === 'tables' && <Tables tables={tables} disabled={writesBlocked} onCreate={handleCreateTable} onRename={handleRenameTable} onSetActive={handleSetTableActive} onReorder={handleReorderTables} onTransfer={handleTransferTableTab} />}
        {activeTab === 'comandas' && <Comandas tables={tables} selectedTableId={selectedComandaTableId} selectionGeneration={selectedComandaGeneration} onSelectTable={selectComandaTable} onAddOrder={(tableId, expectedTableTabId) => handleNewOrder({ tableId, expectedTableTabId, returnTab: 'comandas' })} onPay={handleRegisterTableTabPayment} onApiError={showApiError} onToast={setToastMessage} paymentSync={tableTabSync} onRetryPaymentSync={() => reconcileTableTabPayment()} printing={printing} currency={currency} disabled={writesBlocked} />}

        {pendingDestination && (
          <Modal title="Descartar venda em andamento?" onClose={cancelDiscard}>
            <div className="form-stack">
              <p>As informações preenchidas e os produtos adicionados serão descartados.</p>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={cancelDiscard}>Continuar na venda</Button>
                <Button type="button" onClick={confirmDiscard}>Descartar venda</Button>
              </div>
            </div>
          </Modal>
        )}

        {paymentOrder && <Modal title="Registrar pagamento" onClose={closePaymentModal}><form className="form-stack" onSubmit={handleRegisterPayment}><div className="payment-summary-card"><span>{paymentOrder.client} · {formatOrderDisplayNumber(paymentOrder)}</span><strong>{currency(paymentOrder.total)}</strong><small>O pagamento será lançado automaticamente como entrada no Financeiro.</small></div><div className="form-field"><span>Forma de pagamento</span><SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" /></div><div className="form-actions"><Button type="button" variant="secondary" onClick={closePaymentModal}>Cancelar</Button><Button type="submit" disabled={writesBlocked}>Confirmar pagamento</Button></div></form></Modal>}

        {showClientForm && <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}><div className="form-stack"><label className="form-field"><span>Nome</span><input type="text" autoComplete="name" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label><label className="form-field"><span>Telefone</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} /></label><label className="form-field"><span>Endereço</span><input type="text" autoComplete="street-address" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} /></label><div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newClient.name.trim()} onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>{editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}</Button></div></div></Modal>}
        {duplicateClientDialog && <ClientDuplicateModal client={duplicateClientDialog.client} onCancel={() => setDuplicateClientDialog(null)} onUseExisting={handleUseExistingClient} onConfirm={handleConfirmDuplicateClient} disabled={writesBlocked} cancelLabel="Cancelar" useExistingLabel="Usar cliente existente" confirmLabel="Cadastrar mesmo assim" />}
        {showProductForm && <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}><ProductForm value={newProduct} onChange={setNewProduct} onSubmit={handleAddProduct} onCancel={handleCancelProductEdit} disabled={writesBlocked} editing={editingProductId !== null} /></Modal>}
        <MovementDialog open={movementDialogOpen} movement={editingMovement} today={todayValue} disabled={writesBlocked} onClose={closeMovementDialog} onSubmit={handleSaveMovement} />
        <OpeningBalanceDialog open={openingBalanceDialogOpen} settings={financeSettings} today={todayValue} currentBalance={currentFinanceBalance} disabled={writesBlocked} onClose={() => setOpeningBalanceDialogOpen(false)} onSubmit={handleSaveFinanceSettings} />
        {showPrintingSettings && <PrintingSettings printing={printing} onClose={() => setShowPrintingSettings(false)} />}
      </AppShell>

      {recoveryPromptEligible && physicalPrinterReady && recoveryDialogMode === 'prompt' && (
        <Modal title="Impressora disponível novamente" onClose={() => { void handleDeferRecovery() }}>
          <div className="form-stack">
            <p>{`Há ${recoveryPendingCount} trabalhos aguardando impressão.`}</p>
            <p>Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.</p>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => { void handleDeferRecovery() }} disabled={recoveryBusy}>Agora não</Button>
              <Button type="button" variant="secondary" onClick={() => { setRecoveryDialogMode(null); setRecoveryDiscardConfirmation(true) }} disabled={recoveryBusy}>Descartar todas</Button>
              <Button type="button" onClick={() => { void handleStartRecovery() }} disabled={recoveryBusy}>Imprimir agora</Button>
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
          disabled={recoveryBusy}
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
          disabled={secondCopyPromptBusy || Boolean(printing.busyJobId)}
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
          disabled={originSecondCopyPromptBusy}
        />
      )}
    </>
  )
}

export default App
