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
import ProductForm from './components/ProductForm'
import SystemSelect from './components/SystemSelect'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import NewOrder from './pages/NewOrder'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Receivables from './pages/Receivables'
import Finance from './pages/Finance'
import { findClientDuplicates } from '../shared/clientIdentity.js'
import { categoryForUi } from '../shared/productCatalog.js'
import { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from './utils/formFormatting.js'
import { getOrderItemsSearchText } from './utils/orderCart'
import { getOrderRefundState } from './utils/orderLifecycle.js'
import { activeOrderIdSet, getNewActiveOrderIds } from './utils/orderRealtime.js'
import { isOrderFinished, toLocalDateValue } from './utils/orderWorkflow'
import { getPendingAmount, isOrderPaid } from './utils/paymentWorkflow'
import {
  createClient as createClientApi,
  createMovement as createMovementApi,
  createOrder as createOrderApi,
  createProduct as createProductApi,
  deleteClient as deleteClientApi,
  deleteProduct as deleteProductApi,
  getBootstrap as getBootstrapApi,
  getOrders as getOrdersApi,
  getSession as getSessionApi,
  login as loginApi,
  logout as logoutApi,
  refundOrder as refundOrderApi,
  registerPayment as registerPaymentApi,
  registerTableTabPayment as registerTableTabPaymentApi,
  updateClient as updateClientApi,
  updateOrderStatus as updateOrderStatusApi,
  updateProduct as updateProductApi,
} from './api/client'

const PAYMENT_METHOD_OPTIONS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']
  .map((value) => ({ value, label: value }))
const MOVEMENT_TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
]
const MOVEMENT_CATEGORY_OPTIONS = ['Vendas', 'Delivery', 'Insumos', 'Despesas', 'Outros']
  .map((value) => ({ value, label: value }))
const KITCHEN_SOUND_STORAGE_KEY = 'kitchen-sound-enabled'

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const readKitchenSoundPreference = () => {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(KITCHEN_SOUND_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

const emptyProduct = () => ({
  category: 'Refeições',
  presentationType: 'size',
  presentationValue: 'P',
  presentationUnit: '',
  name: '',
  price: formatBRLCurrencyValue(32),
})

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
  const [activeTab, setActiveTab] = useState('dashboard')
  const [checkoutKey, setCheckoutKey] = useState(null)
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
  const [newMovement, setNewMovement] = useState({ type: 'entrada', category: 'Vendas', description: '', value: '0' })
  const [toastMessage, setToastMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [newOrderIds, setNewOrderIds] = useState(() => new Set())
  const [kitchenSoundEnabled, setKitchenSoundEnabled] = useState(readKitchenSoundPreference)
  const knownActiveOrderIdsRef = useRef(new Set())
  const alertedOrderIdsRef = useRef(new Set())
  const currentOrdersRef = useRef([])
  const kitchenAudioContextRef = useRef(null)
  const newOrderHighlightTimerRef = useRef(null)

  const todayValue = toLocalDateValue()
  const paymentOrder = orders.find((order) => order.id === paymentOrderId) ?? null
  const writesBlocked = !isOnline || requestKey !== null

  const clearBusinessData = () => {
    setProducts([])
    setClients([])
    setOrders([])
    setTableTabs([])
    setMovements([])
    setNewOrderIds(new Set())
    knownActiveOrderIdsRef.current = new Set()
    alertedOrderIdsRef.current = new Set()
    currentOrdersRef.current = []
    setCheckoutKey(null)
    setPaymentOrderId(null)
    setShowMovementModal(false)
    setShowClientForm(false)
    setDuplicateClientDialog(null)
    setShowProductForm(false)
  }

  const applyBootstrap = (data) => {
    setClients(Array.isArray(data?.clients) ? data.clients : [])
    setProducts(Array.isArray(data?.products) ? data.products : [])
    setOrders(Array.isArray(data?.orders) ? data.orders : [])
    setTableTabs(Array.isArray(data?.tableTabs) ? data.tableTabs : [])
    setMovements(Array.isArray(data?.movements) ? data.movements : [])
    setBootstrapState('ready')
  }

  const expireSession = () => {
    clearBusinessData()
    setAuthState('anonymous')
    setBootstrapState('idle')
    setRequestKey(null)
    setLoginError('Sua sessão expirou. Entre novamente.')
  }

  const showApiError = (error) => {
    if (error?.status === 401) {
      expireSession()
      return
    }
    setToastMessage(error?.message || 'Não foi possível concluir a operação.')
  }

  const refreshBootstrap = async () => {
    setBootstrapState('loading')
    try {
      const data = await getBootstrapApi()
      applyBootstrap(data)
      return true
    } catch (error) {
      if (error?.status === 401) expireSession()
      else setBootstrapState('error')
      return false
    }
  }

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
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const startsAt = context.currentTime + delay
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startsAt)
        gain.gain.setValueAtTime(0.0001, startsAt)
        gain.gain.exponentialRampToValueAtTime(0.14, startsAt + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.18)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(startsAt)
        oscillator.stop(startsAt + 0.2)
      }

      playTone(784, 0)
      playTone(988, 0.16)
    } catch {
      // Browsers may block audio until the first user interaction.
    }
  }

  const handleKitchenSoundEnabledChange = (enabled) => {
    const nextEnabled = Boolean(enabled)
    setKitchenSoundEnabled(nextEnabled)
    try {
      window.localStorage.setItem(KITCHEN_SOUND_STORAGE_KEY, String(nextEnabled))
    } catch {
      // Preference persistence is optional when storage is unavailable.
    }
    if (nextEnabled) void playKitchenNewOrderSound()
  }

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      try {
        const session = await getSessionApi()
        if (cancelled) return
        if (!session?.authenticated) {
          setAuthState('anonymous')
          return
        }
        setAuthState('authenticated')
        setBootstrapState('loading')
        const data = await getBootstrapApi()
        if (!cancelled) applyBootstrap(data)
      } catch {
        if (!cancelled) {
          setAuthState('anonymous')
          setBootstrapState('idle')
        }
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    currentOrdersRef.current = orders
  }, [orders])

  useEffect(() => {
    if (!kitchenSoundEnabled) return undefined

    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      try {
        if (!kitchenAudioContextRef.current) kitchenAudioContextRef.current = new AudioContextClass()
        if (kitchenAudioContextRef.current.state === 'suspended') void kitchenAudioContextRef.current.resume()
      } catch {
        // The next user interaction can try again.
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { passive: true })
    window.addEventListener('keydown', unlockAudio)
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [kitchenSoundEnabled])

  useEffect(() => {
    if (activeTab !== 'orders' || !isOnline || authState !== 'authenticated' || bootstrapState !== 'ready') return undefined

    let cancelled = false
    let syncing = false
    knownActiveOrderIdsRef.current = activeOrderIdSet(currentOrdersRef.current)

    const refreshOrders = async () => {
      if (syncing || cancelled) return
      syncing = true
      try {
        const data = await getOrdersApi()
        if (cancelled || !Array.isArray(data?.orders)) return

        const latestOrders = data.orders
        const detectedIds = getNewActiveOrderIds(knownActiveOrderIdsRef.current, latestOrders)
          .filter((id) => !alertedOrderIdsRef.current.has(id))
        knownActiveOrderIdsRef.current = activeOrderIdSet(latestOrders)
        setOrders(latestOrders)

        if (detectedIds.length) {
          detectedIds.forEach((id) => alertedOrderIdsRef.current.add(id))
          setNewOrderIds((current) => new Set([...current, ...detectedIds]))
          if (kitchenSoundEnabled) void playKitchenNewOrderSound()

          if (newOrderHighlightTimerRef.current) window.clearTimeout(newOrderHighlightTimerRef.current)
          newOrderHighlightTimerRef.current = window.setTimeout(() => {
            setNewOrderIds(new Set())
            newOrderHighlightTimerRef.current = null
          }, 2600)
        }
      } catch (error) {
        if (!cancelled && error?.status === 401) expireSession()
      } finally {
        syncing = false
      }
    }

    void refreshOrders()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshOrders()
    }, 2_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshOrders()
    }
    const handleFocus = () => void refreshOrders()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [activeTab, authState, bootstrapState, isOnline, kitchenSoundEnabled])

  useEffect(() => () => {
    if (newOrderHighlightTimerRef.current) window.clearTimeout(newOrderHighlightTimerRef.current)
    if (kitchenAudioContextRef.current?.close) void kitchenAudioContextRef.current.close()
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  const totals = useMemo(() => {
    const salesToday = orders.filter((order) => order.orderDate === todayValue).reduce((total, order) => total + Number(order.total || 0), 0)
    const receivedToday = orders.filter((order) => isOrderPaid(order) && order.paidAt && toLocalDateValue(order.paidAt) === todayValue).reduce((total, order) => total + Number(order.paidAmount || order.total || 0), 0)
    const receivables = orders.filter((order) => !isOrderPaid(order)).reduce((total, order) => total + getPendingAmount(order), 0)
    const activeOrders = orders.filter((order) => !isOrderFinished(order)).length
    return { salesToday, receivedToday, receivables, activeOrders }
  }, [orders, todayValue])

  const financialTotals = useMemo(() => {
    const entries = movements.filter((movement) => movement.type === 'entrada').reduce((total, movement) => total + Number(movement.value), 0)
    const exits = movements.filter((movement) => movement.type === 'saida').reduce((total, movement) => total + Number(movement.value), 0)
    return { entries, exits, balance: entries - exits }
  }, [movements])

  const pendingRefundOrders = useMemo(() => orders.filter((order) => getOrderRefundState(order) === 'pending'), [orders])

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase()
    const filtered = clients.filter((client) => !normalizedSearch || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch))
    return [...filtered].sort((a, b) => clientSort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
  }, [clientSearch, clientSort, clients])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (!normalizedSearch) return true
      return [order.client, order.type, order.orderDate, getOrderItemsSearchText(order), order.status, order.paymentStatus, order.paymentMethod]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [orderSearch, orders])

  const showSuccessMessage = (message = 'Ação salva com sucesso') => setSuccessMessage(message)

  const validateClientIdentity = (draft, excludeId = null, action = 'create') => {
    const duplicate = findClientDuplicates(clients, draft, excludeId)
    if (duplicate.phone) {
      setToastMessage(`Telefone já cadastrado para ${duplicate.phone.name}.`)
      return false
    }
    if (duplicate.name) {
      setDuplicateClientDialog({ client: duplicate.name, action })
      return false
    }
    return true
  }

  const handleLogin = async (pin) => {
    if (!isOnline || requestKey) return
    setRequestKey('auth:login')
    setLoginError('')
    try {
      await loginApi(pin)
      setAuthState('authenticated')
      setBootstrapState('loading')
      const data = await getBootstrapApi()
      applyBootstrap(data)
    } catch (error) {
      clearBusinessData()
      setAuthState('anonymous')
      setBootstrapState('idle')
      setLoginError(error?.code === 'INVALID_PIN' ? 'PIN inválido. Confira e tente novamente.' : (error?.message || 'Não foi possível entrar no sistema.'))
    } finally {
      setRequestKey(null)
    }
  }

  const handleLogout = async () => {
    if (writesBlocked) return
    setRequestKey('auth:logout')
    try {
      await logoutApi()
      clearBusinessData()
      setAuthState('anonymous')
      setBootstrapState('idle')
      setLoginError('')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleNewOrder = () => {
    if (writesBlocked) return
    setCheckoutKey(crypto.randomUUID())
    setActiveTab('new-order')
  }

  const handleOrderCheckout = async (payload) => {
    if (writesBlocked) return false
    const key = checkoutKey || crypto.randomUUID()
    if (!checkoutKey) setCheckoutKey(key)
    setRequestKey('order:create')
    try {
      const { order } = await createOrderApi(payload, key)
      setOrders((current) => current.some((item) => item.id === order.id)
        ? current.map((item) => item.id === order.id ? order : item)
        : [order, ...current])
      if (order.paymentStatus === 'Pago') await refreshBootstrap()
      setCheckoutKey(null)
      setActiveTab('orders')
      showSuccessMessage(order.paymentStatus === 'Pago' ? 'Pedido salvo e pagamento recebido' : (order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido entrou em preparo'))
      return true
    } catch (error) {
      showApiError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }

  const handleQuickCreateClient = async ({ name, phone }) => {
    if (writesBlocked || !name.trim()) return null
    setRequestKey('client:create:quick')
    try {
      const { client } = await createClientApi({ name: name.trim(), phone: phone || '', address: '' })
      setClients((current) => [client, ...current])
      return client
    } catch (error) {
      showApiError(error)
      return null
    } finally {
      setRequestKey(null)
    }
  }

  const handleFinalizeOrder = async (orderId) => {
    if (writesBlocked) return
    const currentOrder = orders.find((item) => item.id === orderId)
    if (!currentOrder) return
    setRequestKey(`order:status:${orderId}`)
    try {
      const { order } = await updateOrderStatusApi(orderId, 'Finalizado')
      setOrders((current) => current.map((item) => item.id === orderId ? order : item))
      showSuccessMessage(currentOrder.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const openPaymentModal = (orderId) => {
    if (writesBlocked) return
    const order = orders.find((item) => item.id === orderId)
    if (!order || isOrderPaid(order)) return
    setPaymentOrderId(orderId)
    setPaymentMethod('Pix')
  }

  const closePaymentModal = () => {
    setPaymentOrderId(null)
    setPaymentMethod('Pix')
  }

  const handleRegisterPayment = async (event) => {
    event.preventDefault()
    if (writesBlocked || !paymentOrder || isOrderPaid(paymentOrder)) return
    setRequestKey(`payment:${paymentOrder.id}`)
    try {
      const { order, movement } = await registerPaymentApi(paymentOrder.id, paymentMethod)
      setOrders((current) => current.map((item) => item.id === order.id ? order : item))
      setMovements((current) => current.some((item) => item.id === movement.id) ? current : [movement, ...current])
      closePaymentModal()
      showSuccessMessage(`Pagamento recebido via ${paymentMethod}`)
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleRegisterTableTabPayment = async (tableTabId, method) => {
    if (writesBlocked) return false
    setRequestKey(`table-tab:payment:${tableTabId}`)
    try {
      const result = await registerTableTabPaymentApi(tableTabId, method)
      setOrders((current) => current.map((item) => result.orders.find((order) => order.id === item.id) ?? item))
      setMovements((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...result.movements.filter((item) => !ids.has(item.id)), ...current]
      })
      setTableTabs((current) => current.map((tab) => tab.id === result.tableTab.id ? result.tableTab : tab))
      showSuccessMessage(`Pagamento da Mesa ${result.tableTab.tableIdentifier} recebido via ${method}`)
      return true
    } catch (error) {
      showApiError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }

  const handleRegisterRefund = async (orderId, payload) => {
    if (writesBlocked) return false
    setRequestKey(`order:refund:${orderId}`)
    try {
      const { order, movement } = await refundOrderApi(orderId, payload)
      setOrders((current) => current.map((item) => item.id === order.id ? order : item))
      if (movement?.source === 'order-refund') {
        setMovements((current) => current.some((item) => item.id === movement.id)
          ? current.map((item) => item.id === movement.id ? movement : item)
          : [movement, ...current])
      }
      showSuccessMessage('Estorno registrado com sucesso')
      return true
    } catch (error) {
      showApiError(error)
      return false
    } finally {
      setRequestKey(null)
    }
  }

  const resetClientForm = () => {
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(false)
  }

  const openNewClient = () => {
    if (writesBlocked) return
    setDuplicateClientDialog(null)
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(true)
  }

  const handleEditClient = (client) => {
    if (writesBlocked) return
    setDuplicateClientDialog(null)
    setEditingClientId(client.id)
    setShowClientForm(true)
    setNewClient({ name: client.name, phone: client.phone, address: client.address })
  }

  const clientPayload = () => ({ name: newClient.name.trim(), phone: newClient.phone || '', address: newClient.address || 'Sem endereço' })

  const persistNewClient = async () => {
    if (writesBlocked || !newClient.name.trim()) return
    setRequestKey('client:create')
    try {
      const { client } = await createClientApi(clientPayload())
      setClients((current) => [client, ...current])
      resetClientForm()
      showSuccessMessage('Cliente adicionado com sucesso')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const persistClientUpdate = async () => {
    if (writesBlocked || !editingClientId || !newClient.name.trim()) return
    const id = editingClientId
    setRequestKey(`client:update:${id}`)
    try {
      const { client } = await updateClientApi(id, clientPayload())
      setClients((current) => current.map((item) => item.id === id ? client : item))
      resetClientForm()
      showSuccessMessage('Cliente atualizado com sucesso')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleAddClient = async () => {
    if (writesBlocked || !newClient.name.trim() || !validateClientIdentity(newClient, null, 'create')) return
    await persistNewClient()
  }

  const handleSaveClient = async () => {
    if (writesBlocked || !editingClientId || !newClient.name.trim() || !validateClientIdentity(newClient, editingClientId, 'update')) return
    await persistClientUpdate()
  }

  const handleUseExistingClient = () => {
    const existing = duplicateClientDialog?.client
    setDuplicateClientDialog(null)
    if (existing?.name) setClientSearch(existing.name)
    resetClientForm()
  }

  const handleConfirmDuplicateClient = async () => {
    const action = duplicateClientDialog?.action
    setDuplicateClientDialog(null)
    if (action === 'update') await persistClientUpdate()
    else if (action === 'create') await persistNewClient()
  }

  const handleDeleteClient = async (clientId) => {
    if (writesBlocked) return
    setRequestKey(`client:delete:${clientId}`)
    try {
      await deleteClientApi(clientId)
      const remaining = clients.filter((client) => client.id !== clientId)
      setClients(remaining)
      if (editingClientId === clientId) resetClientForm()
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleCancelClientEdit = () => {
    setDuplicateClientDialog(null)
    resetClientForm()
  }

  const openNewProduct = () => {
    if (writesBlocked) return
    setEditingProductId(null)
    setNewProduct(emptyProduct())
    setShowProductForm(true)
  }

  const handleEditProduct = (product) => {
    if (writesBlocked) return
    setEditingProductId(product.id)
    setShowProductForm(true)
    const legacySized = Boolean(product.size && !['Un', 'Unidade'].includes(product.size))
    setNewProduct({
      category: categoryForUi(product.category),
      presentationType: product.presentationType || (legacySized ? 'size' : 'unit'),
      presentationValue: product.presentationValue ?? (legacySized ? product.size : ''),
      presentationUnit: product.presentationUnit || '',
      name: product.name,
      price: formatBRLCurrencyValue(product.price),
    })
  }

  const productPayload = () => ({
    category: newProduct.category,
    presentationType: newProduct.presentationType,
    presentationValue: newProduct.presentationValue,
    presentationUnit: newProduct.presentationUnit,
    name: newProduct.name.trim(),
    price: parseBRLCurrencyInput(newProduct.price),
  })

  const handleAddProduct = async () => {
    if (writesBlocked || !newProduct.name.trim()) return
    const editing = editingProductId
    setRequestKey(editing ? `product:update:${editing}` : 'product:create')
    try {
      if (editing) {
        const { product } = await updateProductApi(editing, productPayload())
        setProducts((current) => current.map((item) => item.id === editing ? product : item))
        setEditingProductId(null)
        showSuccessMessage('Produto atualizado com sucesso')
      } else {
        const { product } = await createProductApi(productPayload())
        setProducts((current) => [product, ...current])
        showSuccessMessage('Produto adicionado com sucesso')
      }
      setNewProduct(emptyProduct())
      setShowProductForm(false)
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (writesBlocked) return
    setRequestKey(`product:delete:${productId}`)
    try {
      await deleteProductApi(productId)
      const remaining = products.filter((product) => product.id !== productId)
      setProducts(remaining)
      if (editingProductId === productId) {
        setEditingProductId(null)
        setNewProduct(emptyProduct())
        setShowProductForm(false)
      }
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleCancelProductEdit = () => {
    setEditingProductId(null)
    setNewProduct(emptyProduct())
    setShowProductForm(false)
  }

  const openMovementModal = () => {
    if (writesBlocked) return
    setShowMovementModal(true)
  }

  const handleAddMovement = async (event) => {
    event.preventDefault()
    const description = newMovement.description.trim()
    const value = Number(newMovement.value) || 0
    if (writesBlocked || !description || value <= 0) return
    setRequestKey('movement:create')
    try {
      const { movement } = await createMovementApi({ type: newMovement.type, category: newMovement.category, description, value })
      setMovements((current) => [movement, ...current])
      setNewMovement({ type: 'entrada', category: 'Vendas', description: '', value: '0' })
      setShowMovementModal(false)
      showSuccessMessage('Movimentação registrada com sucesso')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  if (authState === 'checking') {
    return (
      <div className="system-state-screen">
        <div className="system-state-card"><h2>Carregando sistema</h2><p>Verificando sua sessão…</p></div>
      </div>
    )
  }

  if (authState === 'anonymous') {
    return (
      <>
        {!isOnline && <ConnectionBanner />}
        <LoginScreen onLogin={handleLogin} loading={requestKey === 'auth:login'} error={loginError} disabled={!isOnline} />
      </>
    )
  }

  if (bootstrapState !== 'ready') {
    return (
      <>
        {!isOnline && <ConnectionBanner />}
        <div className="system-state-screen">
          <div className="system-state-card">
            {bootstrapState === 'error' ? (
              <><h2>Não foi possível carregar os dados</h2><p>Confira sua conexão e tente novamente.</p><Button type="button" onClick={refreshBootstrap} disabled={!isOnline || requestKey !== null}>Tentar novamente</Button></>
            ) : (
              <><h2>Carregando dados</h2><p>Sincronizando a operação da Amor &amp; Sabor…</p></>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {!isOnline && <ConnectionBanner />}
      {toastMessage && (
        typeof document === 'undefined'
          ? <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{toastMessage}</div>
          : createPortal(
            <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{toastMessage}</div>,
            document.body,
          )
      )}
      {successMessage && (
        typeof document === 'undefined'
          ? (
            <div className="success-confirmation-overlay" role="status" aria-live="polite">
              <div className="success-confirmation-card">
                <span className="success-confirmation-icon"><Icon name="check" size={30} /></span>
                <strong>{successMessage}</strong>
              </div>
            </div>
          )
          : createPortal(
            <div className="success-confirmation-overlay" role="status" aria-live="polite">
              <div className="success-confirmation-card">
                <span className="success-confirmation-icon"><Icon name="check" size={30} /></span>
                <strong>{successMessage}</strong>
              </div>
            </div>,
            document.body,
          )
      )}
      <AppShell activeTab={activeTab} onNavigate={setActiveTab} onLogout={handleLogout} logoutDisabled={writesBlocked}>
        {activeTab === 'dashboard' && <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} />}
        {activeTab === 'orders' && <Orders orders={filteredOrders} search={orderSearch} onSearchChange={setOrderSearch} currency={currency} onNewOrder={handleNewOrder} onFinalizeOrder={handleFinalizeOrder} onNavigateHistory={() => setActiveTab('history')} newOrderIds={newOrderIds} soundEnabled={kitchenSoundEnabled} onSoundEnabledChange={handleKitchenSoundEnabledChange} />}
        {activeTab === 'new-order' && (
          <NewOrder
            clients={clients}
            products={products}
            tableTabs={tableTabs}
            currency={currency}
            disabled={writesBlocked}
            onCancel={() => { setCheckoutKey(null); setActiveTab('orders') }}
            onCreateClient={handleQuickCreateClient}
            onSubmit={handleOrderCheckout}
          />
        )}
        {activeTab === 'clients' && <Clients clients={filteredClients} search={clientSearch} sort={clientSort} onSearchChange={setClientSearch} onSortChange={setClientSort} onAdd={openNewClient} onEdit={handleEditClient} onDelete={handleDeleteClient} />}
        {activeTab === 'products' && <Products products={products} search={productSearch} currency={currency} onSearchChange={setProductSearch} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />}
        {activeTab === 'receivables' && <Receivables orders={orders} tableTabs={tableTabs} currency={currency} onRegisterPayment={openPaymentModal} onRegisterTableTabPayment={handleRegisterTableTabPayment} />}
        {activeTab === 'finance' && <Finance totals={financialTotals} movements={movements} currency={currency} onAddMovement={openMovementModal} pendingRefundOrders={pendingRefundOrders} onRegisterRefund={handleRegisterRefund} />}

        {paymentOrder && (
          <Modal title="Registrar pagamento" onClose={closePaymentModal}>
            <form className="form-stack" onSubmit={handleRegisterPayment}>
              <div className="payment-summary-card"><span>{paymentOrder.client} · Pedido #{String(paymentOrder.id).slice(-4)}</span><strong>{currency(paymentOrder.total)}</strong><small>O pagamento será lançado automaticamente como entrada no Financeiro.</small></div>
              <div className="form-field"><span>Forma de pagamento</span><SystemSelect value={paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={setPaymentMethod} disabled={writesBlocked} label="Forma de pagamento" /></div>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={closePaymentModal}>Cancelar</Button><Button type="submit" disabled={writesBlocked}>Confirmar pagamento</Button></div>
            </form>
          </Modal>
        )}

        {showClientForm && (
          <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}>
            <div className="form-stack">
              <label className="form-field"><span>Nome</span><input type="text" autoComplete="name" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="form-field"><span>Telefone</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} /></label>
              <label className="form-field"><span>Endereço</span><input type="text" autoComplete="street-address" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} /></label>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newClient.name.trim()} onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>{editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}</Button></div>
            </div>
          </Modal>
        )}

        {duplicateClientDialog && (
          <ClientDuplicateModal
            client={duplicateClientDialog.client}
            onCancel={() => setDuplicateClientDialog(null)}
            onUseExisting={handleUseExistingClient}
            onConfirm={handleConfirmDuplicateClient}
            disabled={writesBlocked}
            cancelLabel="Cancelar"
            useExistingLabel="Usar cliente existente"
            confirmLabel="Cadastrar mesmo assim"
          />
        )}

        {showProductForm && (
          <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}>
            <ProductForm
              value={newProduct}
              onChange={setNewProduct}
              onSubmit={handleAddProduct}
              onCancel={handleCancelProductEdit}
              disabled={writesBlocked}
              editing={editingProductId !== null}
            />
          </Modal>
        )}

        {showMovementModal && (
          <Modal title="Registrar movimento" onClose={() => setShowMovementModal(false)}>
            <form className="form-stack" onSubmit={handleAddMovement}>
              <div className="form-grid two-columns"><div className="form-field"><span>Tipo</span><SystemSelect value={newMovement.type} options={MOVEMENT_TYPE_OPTIONS} onChange={(type) => setNewMovement((current) => ({ ...current, type }))} disabled={writesBlocked} label="Tipo da movimentação" /></div><div className="form-field"><span>Categoria</span><SystemSelect value={newMovement.category} options={MOVEMENT_CATEGORY_OPTIONS} onChange={(category) => setNewMovement((current) => ({ ...current, category }))} disabled={writesBlocked} label="Categoria da movimentação" /></div></div>
              <label className="form-field"><span>Descrição</span><input type="text" placeholder="Ex: Compra de arroz" value={newMovement.description} onChange={(event) => setNewMovement((current) => ({ ...current, description: event.target.value }))} /></label>
              <label className="form-field"><span>Valor</span><input type="number" min="0" step="0.01" value={newMovement.value} onChange={(event) => setNewMovement((current) => ({ ...current, value: event.target.value }))} /></label>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowMovementModal(false)}>Cancelar</Button><Button type="submit" disabled={writesBlocked}>Salvar movimento</Button></div>
            </form>
          </Modal>
        )}
      </AppShell>
    </>
  )
}

export default App