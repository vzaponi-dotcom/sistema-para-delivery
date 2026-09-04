import { useEffect, useMemo, useRef, useState } from 'react'
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
import ConnectionBanner from './components/ConnectionBanner'
import Icon from './components/Icon'
import LoginScreen from './components/LoginScreen'
import Modal from './components/Modal'
import MovementDialog from './components/MovementDialog'
import OpeningBalanceDialog from './components/OpeningBalanceDialog'
import ProductForm from './components/ProductForm'
import SystemSelect from './components/SystemSelect'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import NewOrder from './pages/NewOrder'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Receivables from './pages/Receivables'
import Finance from './pages/Finance'
import OrderHistory from './pages/OrderHistory'
import { findClientDuplicates } from '../shared/clientIdentity.js'
import { categoryForUi } from '../shared/productCatalog.js'
import { usePrintingManager } from './printing/usePrintingManager'
import { createCollectionSyncGuard, removeById, upsertById, upsertManyById } from './utils/dataSync.js'
import { calculateCurrentBalance } from './utils/finance.js'
import { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'
import { shouldConfirmNewOrderExit } from './utils/newOrderStepFlow.js'
import { getOrderItemsSearchText } from './utils/orderCart'
import { getOrderRefundState, isOrderActive, isOrderCancelled } from './utils/orderLifecycle.js'
import { getNewOperationalOrderIds, operationalOrderIdSet } from './utils/orderRealtime.js'
import { toLocalDateValue } from './utils/orderWorkflow'
import { calculateReceivedToday, getPendingAmount, isOrderPaid } from './utils/paymentWorkflow'
import {
  cancelOrder as cancelOrderApi,
  createClient as createClientApi,
  createMovement as createMovementApi,
  createOrder as createOrderApi,
  createProduct as createProductApi,
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
  saveFinanceSettings as saveFinanceSettingsApi,
  updateClient as updateClientApi,
  updateMovement as updateMovementApi,
  updateOrderStatus as updateOrderStatusApi,
  updateProduct as updateProductApi,
} from './api/client'

const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro'].map((value) => ({ value, label: value }))
const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'
const DATA_COLLECTIONS = ['clients', 'products', 'orders', 'tableTabs', 'movements', 'financeSettings']
const GLOBAL_SYNC_INTERVAL_MS = 5_000
const ORDER_SYNC_INTERVAL_MS = 2_000
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const readKitchenSoundPreference = () => {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false' } catch { return true }
}
const emptyProduct = () => ({ category: 'Refeições', presentationType: 'size', presentationValue: 'P', presentationUnit: '', name: '', price: formatBRLCurrencyValue(32) })

function App() {
  const [authState, setAuthState] = useState('checking')
  const [bootstrapState, setBootstrapState] = useState('idle')
  const [requestKey, setRequestKey] = useState(null)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [loginError, setLoginError] = useState('')
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [tableTabs, setTableTabs] = useState([])
  const [movements, setMovements] = useState([])
  const [financeSettings, setFinanceSettings] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [checkoutKey, setCheckoutKey] = useState(null)
  const [newOrderDirty, setNewOrderDirty] = useState(false)
  const [pendingNavigationTab, setPendingNavigationTab] = useState(null)
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [duplicateClientDialog, setDuplicateClientDialog] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [clientSort, setClientSort] = useState('name-asc')
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
  const knownOperationalOrderIdsRef = useRef(new Set())
  const alertedOrderIdsRef = useRef(new Set())
  const currentOrdersRef = useRef([])
  const kitchenAudioContextRef = useRef(null)
  const newOrderHighlightTimerRef = useRef(null)
  const syncGuardRef = useRef(createCollectionSyncGuard(DATA_COLLECTIONS))
  const bootstrapSyncInFlightRef = useRef(false)
  const ordersSyncInFlightRef = useRef(false)

  const todayValue = toLocalDateValue()
  const paymentOrder = orders.find((order) => order.id === paymentOrderId) ?? null
  const writesBlocked = !isOnline || requestKey !== null
  const printing = usePrintingManager({ authenticated: authState === 'authenticated' && bootstrapState === 'ready', isOnline })

  const resetSyncState = () => {
    syncGuardRef.current = createCollectionSyncGuard(DATA_COLLECTIONS)
    bootstrapSyncInFlightRef.current = false
    ordersSyncInFlightRef.current = false
  }

  const clearBusinessData = () => {
    resetSyncState()
    setProducts([]); setClients([]); setOrders([]); setTableTabs([]); setMovements([]); setFinanceSettings(null); setNewOrderIds(new Set())
    knownOperationalOrderIdsRef.current = new Set(); alertedOrderIdsRef.current = new Set(); currentOrdersRef.current = []
    setCheckoutKey(null); setNewOrderDirty(false); setPendingNavigationTab(null); setPaymentOrderId(null); setMovementDialogOpen(false); setEditingMovement(null); setOpeningBalanceDialogOpen(false); setShowClientForm(false); setDuplicateClientDialog(null); setShowProductForm(false)
  }

  const applyBootstrapCollections = (data, token) => {
    const guard = syncGuardRef.current
    if (guard.canApply(token, 'clients')) setClients(Array.isArray(data?.clients) ? data.clients : [])
    if (guard.canApply(token, 'products')) setProducts(Array.isArray(data?.products) ? data.products : [])
    if (guard.canApply(token, 'orders')) setOrders(Array.isArray(data?.orders) ? data.orders : [])
    if (guard.canApply(token, 'tableTabs')) setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])
    if (guard.canApply(token, 'movements')) setMovements(Array.isArray(data?.movements) ? data.movements : [])
    if (guard.canApply(token, 'financeSettings')) setFinanceSettings(data?.financeSettings ?? null)
  }

  const applyOfficialEffects = ({ order, orders: nextOrders, movement, movements: nextMovements, deletedMovementId, financeSettings, tableTab, client, product }) => {
    const changed = []
    if (order || (Array.isArray(nextOrders) && nextOrders.length)) changed.push('orders')
    if (movement || deletedMovementId || (Array.isArray(nextMovements) && nextMovements.length)) changed.push('movements')
    if (financeSettings !== undefined) changed.push('financeSettings')
    if (tableTab) changed.push('tableTabs')
    if (client) changed.push('clients')
    if (product) changed.push('products')
    syncGuardRef.current.markMutation(changed)
    if (order) setOrders((current) => upsertById(current, order))
    if (Array.isArray(nextOrders) && nextOrders.length) setOrders((current) => upsertManyById(current, nextOrders))
    if (movement) setMovements((current) => upsertById(current, movement))
    if (Array.isArray(nextMovements) && nextMovements.length) setMovements((current) => upsertManyById(current, nextMovements))
    if (deletedMovementId) setMovements((current) => removeById(current, deletedMovementId))
    if (financeSettings !== undefined) setFinanceSettings(financeSettings)
    if (tableTab) setTableTabs((current) => upsertById(current, tableTab))
    if (client) setClients((current) => upsertById(current, client))
    if (product) setProducts((current) => upsertById(current, product))
  }

  const expireSession = () => {
    clearBusinessData(); setAuthState('anonymous'); setBootstrapState('idle'); setRequestKey(null); setLoginError('Sua sessão expirou. Entre novamente.')
  }
  const showApiError = (error) => {
    if (error?.status === 401) return expireSession()
    setToastMessage(error?.message || 'Não foi possível concluir a operação.')
  }

  const refreshBootstrap = async ({ background = false } = {}) => {
    if (bootstrapSyncInFlightRef.current) return false
    bootstrapSyncInFlightRef.current = true
    const token = syncGuardRef.current.beginRead(DATA_COLLECTIONS)
    if (!background) setBootstrapState('loading')
    try {
      const data = await getBootstrapApi()
      applyBootstrapCollections(data, token)
      if (!background) setBootstrapState('ready')
      return true
    } catch (error) {
      if (error?.status === 401) expireSession()
      else if (!background) setBootstrapState('error')
      return false
    } finally { bootstrapSyncInFlightRef.current = false }
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
  useEffect(() => { currentOrdersRef.current = orders }, [orders])

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
    knownOperationalOrderIdsRef.current = operationalOrderIdSet(currentOrdersRef.current, new Date())
    const refreshOrders = async () => {
      if (ordersSyncInFlightRef.current || cancelled) return
      ordersSyncInFlightRef.current = true
      const token = syncGuardRef.current.beginRead(['orders'])
      try {
        const data = await getOrdersApi()
        if (cancelled || !Array.isArray(data?.orders) || !syncGuardRef.current.canApply(token, 'orders')) return
        const latestOrders = data.orders
        const now = new Date()
        const detectedIds = getNewOperationalOrderIds(knownOperationalOrderIdsRef.current, latestOrders, now).filter((id) => !alertedOrderIdsRef.current.has(id))
        knownOperationalOrderIdsRef.current = operationalOrderIdSet(latestOrders, now); setOrders(latestOrders)
        if (detectedIds.length) {
          detectedIds.forEach((id) => alertedOrderIdsRef.current.add(id)); setNewOrderIds((current) => new Set([...current, ...detectedIds])); if (kitchenSoundEnabled) void playKitchenNewOrderSound()
          if (newOrderHighlightTimerRef.current) window.clearTimeout(newOrderHighlightTimerRef.current)
          newOrderHighlightTimerRef.current = window.setTimeout(() => { setNewOrderIds(new Set()); newOrderHighlightTimerRef.current = null }, 2600)
        }
      } catch (error) { if (!cancelled && error?.status === 401) expireSession() } finally { ordersSyncInFlightRef.current = false }
    }
    void refreshOrders()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshOrders() }, ORDER_SYNC_INTERVAL_MS)
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshOrders() }; const handleFocus = () => void refreshOrders()
    document.addEventListener('visibilitychange', handleVisibilityChange); window.addEventListener('focus', handleFocus)
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibilityChange); window.removeEventListener('focus', handleFocus) }
  }, [activeTab, authState, bootstrapState, isOnline, kitchenSoundEnabled])

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
  const filteredClients = useMemo(() => { const normalizedSearch = clientSearch.trim().toLowerCase(); const filtered = clients.filter((client) => !normalizedSearch || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch)); return [...filtered].sort((a, b) => clientSort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)) }, [clientSearch, clientSort, clients])
  const filteredOrders = useMemo(() => { const normalizedSearch = orderSearch.trim().toLowerCase(); return orders.filter((order) => !normalizedSearch || [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod].join(' ').toLowerCase().includes(normalizedSearch)) }, [orderSearch, orders])
  const showSuccessMessage = (message = 'Ação salva com sucesso') => setSuccessMessage(message)

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

  const completeNavigation = (targetTab) => {
    if (activeTab === 'new-order' && targetTab !== 'new-order') {
      setCheckoutKey(null)
      setNewOrderDirty(false)
    }
    setActiveTab(targetTab)
  }

  const requestNavigation = (targetTab) => {
    if (activeTab === 'new-order' && requestKey === 'order:create') return
    if (shouldConfirmNewOrderExit({ activeTab, targetTab, draftDirty: newOrderDirty })) {
      setPendingNavigationTab(targetTab)
      return
    }
    completeNavigation(targetTab)
  }

  const cancelDiscardNewOrder = () => setPendingNavigationTab(null)

  const confirmDiscardNewOrder = () => {
    const targetTab = pendingNavigationTab
    setPendingNavigationTab(null)
    if (targetTab) completeNavigation(targetTab)
  }

  const handleNewOrder = () => { if (writesBlocked) return; setCheckoutKey(crypto.randomUUID()); completeNavigation('new-order') }

  const handleOrderCheckout = async (payload) => {
    if (writesBlocked) return false
    const key = checkoutKey || crypto.randomUUID(); if (!checkoutKey) setCheckoutKey(key); setRequestKey('order:create')
    try { const { order, movement, tableTab } = await createOrderApi(payload, key); applyOfficialEffects({ order, movement, tableTab }); setCheckoutKey(null); setActiveTab('orders'); showSuccessMessage(order.paymentStatus === 'Pago' ? 'Pedido salvo e pagamento recebido' : (order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido entrou em preparo')); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) }
  }
  const handleQuickCreateClient = async ({ name, phone }) => { if (writesBlocked || !name.trim()) return null; setRequestKey('client:create:quick'); try { const { client } = await createClientApi({ name: name.trim(), phone: phone || '', address: '' }); applyOfficialEffects({ client }); return client } catch (error) { showApiError(error); return null } finally { setRequestKey(null) } }
  const handleFinalizeOrder = async (orderId) => { if (writesBlocked) return; const currentOrder = orders.find((item) => item.id === orderId); if (!currentOrder) return; setRequestKey(`order:status:${orderId}`); try { const { order } = await updateOrderStatusApi(orderId, 'Finalizado'); applyOfficialEffects({ order }); showSuccessMessage(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleCancelOrder = async (orderId, payload) => { if (writesBlocked) return false; setRequestKey(`order:cancel:${orderId}`); try { const { order, movement, tableTab } = await cancelOrderApi(orderId, payload); applyOfficialEffects({ order, movement, tableTab }); showSuccessMessage(payload.refundNow ? 'Pedido cancelado e estorno registrado' : 'Pedido cancelado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const openPaymentModal = (orderId) => { if (writesBlocked) return; const order = orders.find((item) => item.id === orderId); if (!order || isOrderPaid(order) || isOrderCancelled(order)) return; setPaymentOrderId(orderId); setPaymentMethod('Pix') }
  const closePaymentModal = () => { setPaymentOrderId(null); setPaymentMethod('Pix') }
  const handleRegisterPayment = async (event) => { event.preventDefault(); if (writesBlocked || !paymentOrder || isOrderPaid(paymentOrder) || isOrderCancelled(paymentOrder)) return; setRequestKey(`payment:${paymentOrder.id}`); try { const { order, movement, tableTab } = await registerPaymentApi(paymentOrder.id, paymentMethod); applyOfficialEffects({ order, movement, tableTab }); closePaymentModal(); showSuccessMessage(`Pagamento recebido via ${paymentMethod}`) } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleRegisterTableTabPayment = async (tableTabId, method) => { if (writesBlocked) return false; setRequestKey(`table-tab:payment:${tableTabId}`); try { const result = await registerTableTabPaymentApi(tableTabId, method); applyOfficialEffects({ orders: result.orders, movements: result.movements, tableTab: result.tableTab }); showSuccessMessage(`Pagamento da Mesa ${result.tableTab.tableIdentifier} recebido via ${method}`); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }
  const handleRegisterRefund = async (orderId, payload) => { if (writesBlocked) return false; setRequestKey(`order:refund:${orderId}`); try { const { order, movement } = await refundOrderApi(orderId, payload); applyOfficialEffects({ order, movement }); showSuccessMessage('Estorno registrado com sucesso'); return true } catch (error) { showApiError(error); return false } finally { setRequestKey(null) } }

  const resetClientForm = () => { setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(false) }
  const openNewClient = () => { if (writesBlocked) return; setDuplicateClientDialog(null); setEditingClientId(null); setNewClient({ name: '', phone: '', address: '' }); setShowClientForm(true) }
  const handleEditClient = (client) => { if (writesBlocked) return; setDuplicateClientDialog(null); setEditingClientId(client.id); setShowClientForm(true); setNewClient({ name: client.name, phone: client.phone, address: client.address }) }
  const clientPayload = () => ({ name: newClient.name.trim(), phone: newClient.phone || '', address: newClient.address || 'Sem endereço' })
  const persistNewClient = async () => { if (writesBlocked || !newClient.name.trim()) return; setRequestKey('client:create'); try { const { client } = await createClientApi(clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente adicionado com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const persistClientUpdate = async () => { if (writesBlocked || !editingClientId || !newClient.name.trim()) return; const id = editingClientId; setRequestKey(`client:update:${id}`); try { const { client } = await updateClientApi(id, clientPayload()); applyOfficialEffects({ client }); resetClientForm(); showSuccessMessage('Cliente atualizado com sucesso') } catch (error) { showApiError(error) } finally { setRequestKey(null) } }
  const handleAddClient = async () => { if (writesBlocked || !newClient.name.trim() || !validateClientIdentity(newClient, null, 'create')) return; await persistNewClient() }
  const handleSaveClient = async () => { if (writesBlocked || !editingClientId || !newClient.name.trim() || !validateClientIdentity(newClient, editingClientId, 'update')) return; await persistClientUpdate() }
  const handleUseExistingClient = () => { const existing = duplicateClientDialog?.client; setDuplicateClientDialog(null); if (existing?.name) setClientSearch(existing.name); resetClientForm() }
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
      <AppShell activeTab={activeTab} onNavigate={requestNavigation} onLogout={handleLogout} logoutDisabled={writesBlocked}>
        {activeTab === 'dashboard' && <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} />}
        {activeTab === 'orders' && <Orders orders={filteredOrders} search={orderSearch} onSearchChange={setOrderSearch} currency={currency} onNewOrder={handleNewOrder} onFinalizeOrder={handleFinalizeOrder} onCancelOrder={handleCancelOrder} onNavigateHistory={() => requestNavigation('history')} newOrderIds={newOrderIds} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} printing={printing} />}
        {activeTab === 'history' && <OrderHistory orders={orders} currency={currency} onCancelOrder={handleCancelOrder} actionKey={requestKey} printing={printing} />}
        {activeTab === 'new-order' && <NewOrder clients={clients} products={products} tableTabs={tableTabs} currency={currency} disabled={writesBlocked} onCancel={() => requestNavigation('orders')} onCreateClient={handleQuickCreateClient} onSubmit={handleOrderCheckout} onDraftDirtyChange={setNewOrderDirty} />}
        {activeTab === 'clients' && <Clients clients={filteredClients} search={clientSearch} sort={clientSort} onSearchChange={setClientSearch} onSortChange={setClientSort} onAdd={openNewClient} onEdit={handleEditClient} onDelete={handleDeleteClient} />}
        {activeTab === 'products' && <Products products={products} search={productSearch} currency={currency} onSearchChange={setProductSearch} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />}
        {activeTab === 'receivables' && <Receivables orders={orders} movements={movements} tableTabs={tableTabs} currency={currency} onRegisterPayment={openPaymentModal} onRegisterTableTabPayment={handleRegisterTableTabPayment} />}
        {activeTab === 'finance' && <Finance totals={financialTotals} movements={movements} financeSettings={financeSettings} currentBalance={currentFinanceBalance} currency={currency} onAddMovement={openNewMovement} onEditMovement={openEditMovement} onDeleteMovement={handleDeleteMovement} onConfigureOpeningBalance={openOpeningBalanceDialog} pendingRefundOrders={pendingRefundOrders} onRegisterRefund={handleRegisterRefund} />}

        {pendingNavigationTab && (
          <Modal title="Descartar venda em andamento?" onClose={cancelDiscardNewOrder}>
            <div className="form-stack">
              <p>As informações preenchidas e os produtos adicionados serão descartados.</p>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={cancelDiscardNewOrder}>Continuar na venda</Button>
                <Button type="button" onClick={confirmDiscardNewOrder}>Descartar venda</Button>
              </div>
            </div>
          </Modal>
        )}

        {paymentOrder && <Modal title="Registrar pagamento" onClose={closePaymentModal}><form className="form-stack" onSubmit={handleRegisterPayment}><div className="payment-summary-card"><span>{paymentOrder.client} · Pedido #{String(paymentOrder.id).slice(-4)}</span><strong>{currency(paymentOrder.total)}</strong><small>O pagamento será lançado automaticamente como entrada no Financeiro.</small></div><div className="form-field"><span>Forma de pagamento</span><SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" /></div><div className="form-actions"><Button type="button" variant="secondary" onClick={closePaymentModal}>Cancelar</Button><Button type="submit" disabled={writesBlocked}>Confirmar pagamento</Button></div></form></Modal>}

        {showClientForm && <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}><div className="form-stack"><label className="form-field"><span>Nome</span><input type="text" autoComplete="name" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label><label className="form-field"><span>Telefone</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} /></label><label className="form-field"><span>Endereço</span><input type="text" autoComplete="street-address" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} /></label><div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newClient.name.trim()} onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>{editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}</Button></div></div></Modal>}
        {duplicateClientDialog && <ClientDuplicateModal client={duplicateClientDialog.client} onCancel={() => setDuplicateClientDialog(null)} onUseExisting={handleUseExistingClient} onConfirm={handleConfirmDuplicateClient} disabled={writesBlocked} cancelLabel="Cancelar" useExistingLabel="Usar cliente existente" confirmLabel="Cadastrar mesmo assim" />}
        {showProductForm && <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}><ProductForm value={newProduct} onChange={setNewProduct} onSubmit={handleAddProduct} onCancel={handleCancelProductEdit} disabled={writesBlocked} editing={editingProductId !== null} /></Modal>}
        <MovementDialog open={movementDialogOpen} movement={editingMovement} today={todayValue} disabled={writesBlocked} onClose={closeMovementDialog} onSubmit={handleSaveMovement} />
        <OpeningBalanceDialog open={openingBalanceDialogOpen} settings={financeSettings} today={todayValue} currentBalance={currentFinanceBalance} disabled={writesBlocked} onClose={() => setOpeningBalanceDialogOpen(false)} onSubmit={handleSaveFinanceSettings} />
      </AppShell>
    </>
  )
}

export default App
