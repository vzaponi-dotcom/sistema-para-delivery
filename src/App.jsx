import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './central-data.css'
import AppShell from './components/AppShell'
import Button from './components/Button'
import ConnectionBanner from './components/ConnectionBanner'
import Icon from './components/Icon'
import LoginScreen from './components/LoginScreen'
import Modal from './components/Modal'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Receivables from './pages/Receivables'
import Finance from './pages/Finance'
import { isOrderFinished, normalizeOrderDate, toLocalDateValue } from './utils/orderWorkflow'
import { getPendingAmount, isOrderPaid } from './utils/paymentWorkflow'
import {
  createClient as createClientApi,
  createMovement as createMovementApi,
  createOrder as createOrderApi,
  createProduct as createProductApi,
  deleteClient as deleteClientApi,
  deleteOrder as deleteOrderApi,
  deleteProduct as deleteProductApi,
  getBootstrap as getBootstrapApi,
  getSession as getSessionApi,
  login as loginApi,
  logout as logoutApi,
  registerPayment as registerPaymentApi,
  updateClient as updateClientApi,
  updateOrderStatus as updateOrderStatusApi,
  updateProduct as updateProductApi,
} from './api/client'

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Outro']

const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function App() {
  const [authState, setAuthState] = useState('checking')
  const [bootstrapState, setBootstrapState] = useState('idle')
  const [requestKey, setRequestKey] = useState(null)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [loginError, setLoginError] = useState('')
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [orders, setOrders] = useState([])
  const [movements, setMovements] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState({ clientId: '', productId: '', type: 'Entrega', quantity: 1, orderDate: toLocalDateValue() })
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [clientSort, setClientSort] = useState('name-asc')
  const [editingProductId, setEditingProductId] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState({ category: 'Marmita', size: 'P', name: '', price: '32' })
  const [newMovement, setNewMovement] = useState({ type: 'entrada', category: 'Vendas', description: '', value: '0' })
  const [toastMessage, setToastMessage] = useState('')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Pix')

  const todayValue = toLocalDateValue()
  const paymentOrder = orders.find((order) => order.id === paymentOrderId) ?? null
  const writesBlocked = !isOnline || requestKey !== null

  const clearBusinessData = () => {
    setProducts([])
    setClients([])
    setOrders([])
    setMovements([])
    setForm((current) => ({ ...current, clientId: '', productId: '', quantity: 1, orderDate: toLocalDateValue() }))
    setPaymentOrderId(null)
    setShowOrderModal(false)
    setShowMovementModal(false)
    setShowClientForm(false)
    setShowProductForm(false)
  }

  const applyBootstrap = (data) => {
    const nextClients = Array.isArray(data?.clients) ? data.clients : []
    const nextProducts = Array.isArray(data?.products) ? data.products : []
    setClients(nextClients)
    setProducts(nextProducts)
    setOrders(Array.isArray(data?.orders) ? data.orders : [])
    setMovements(Array.isArray(data?.movements) ? data.movements : [])
    setForm((current) => ({
      ...current,
      clientId: nextClients.some((client) => client.id === current.clientId) ? current.clientId : (nextClients[0]?.id ?? ''),
      productId: nextProducts.some((product) => product.id === current.productId) ? current.productId : (nextProducts[0]?.id ?? ''),
    }))
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
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

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

  const selectedProduct = products.find((product) => product.id === form.productId) ?? products[0] ?? { name: 'Produto', size: '', price: 0 }

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase()
    const filtered = clients.filter((client) => !normalizedSearch || [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch))
    return [...filtered].sort((a, b) => clientSort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
  }, [clientSearch, clientSort, clients])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (!normalizedSearch) return true
      const itemNames = Array.isArray(order.items) ? order.items.map((item) => item.name).join(' ') : ''
      return [order.client, order.type, order.size, order.orderDate, order.productName, itemNames, order.status, order.paymentStatus, order.paymentMethod].join(' ').toLowerCase().includes(normalizedSearch)
    })
  }, [orderSearch, orders])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()
    if (!normalizedSearch) return products
    return products.filter((product) => [product.name, product.category, product.size, String(product.price)].join(' ').toLowerCase().includes(normalizedSearch))
  }, [productSearch, products])

  const showSuccessMessage = (message = 'Ação salva com sucesso') => setToastMessage(message)

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

  const openOrderModal = () => {
    if (writesBlocked) return
    setForm((current) => ({ ...current, quantity: 1, orderDate: toLocalDateValue() }))
    setShowOrderModal(true)
  }

  const handleNewOrder = () => {
    if (writesBlocked) return
    setActiveTab('orders')
    openOrderModal()
  }

  const handleOrderSubmit = async (event) => {
    event.preventDefault()
    if (writesBlocked || !form.clientId || !form.productId) return
    setRequestKey('order:create')
    try {
      const orderDate = normalizeOrderDate(form.orderDate, new Date())
      const { order } = await createOrderApi({ clientId: form.clientId, productId: form.productId, type: form.type, quantity: Number(form.quantity) || 1, orderDate })
      setOrders((current) => [order, ...current])
      setForm((current) => ({ ...current, quantity: 1, orderDate: toLocalDateValue() }))
      setShowOrderModal(false)
      setActiveTab('orders')
      showSuccessMessage(order.status === 'Finalizado' ? 'Pedido anterior salvo no histórico' : 'Pedido entrou em preparo')
    } catch (error) {
      showApiError(error)
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

  const handleDeleteOrder = async (orderId) => {
    if (writesBlocked) return
    setRequestKey(`order:delete:${orderId}`)
    try {
      await deleteOrderApi(orderId)
      setOrders((current) => current.filter((order) => order.id !== orderId))
      setMovements((current) => current.filter((movement) => !(movement.source === 'order-payment' && movement.orderId === orderId)))
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

  const openNewClient = () => {
    if (writesBlocked) return
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(true)
  }

  const handleEditClient = (client) => {
    if (writesBlocked) return
    setEditingClientId(client.id)
    setShowClientForm(true)
    setNewClient({ name: client.name, phone: client.phone, address: client.address })
  }

  const clientPayload = () => ({ name: newClient.name.trim(), phone: newClient.phone || '(00) 00000-0000', address: newClient.address || 'Sem endereço' })

  const handleAddClient = async () => {
    if (writesBlocked || !newClient.name.trim()) return
    setRequestKey('client:create')
    try {
      const { client } = await createClientApi(clientPayload())
      setClients((current) => [client, ...current])
      setForm((current) => ({ ...current, clientId: client.id }))
      setNewClient({ name: '', phone: '', address: '' })
      setShowClientForm(false)
      showSuccessMessage('Cliente adicionado com sucesso')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleSaveClient = async () => {
    if (writesBlocked || !editingClientId || !newClient.name.trim()) return
    const id = editingClientId
    setRequestKey(`client:update:${id}`)
    try {
      const { client } = await updateClientApi(id, clientPayload())
      setClients((current) => current.map((item) => item.id === id ? client : item))
      setEditingClientId(null)
      setNewClient({ name: '', phone: '', address: '' })
      setShowClientForm(false)
      showSuccessMessage('Cliente atualizado com sucesso')
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleDeleteClient = async (clientId) => {
    if (writesBlocked) return
    setRequestKey(`client:delete:${clientId}`)
    try {
      await deleteClientApi(clientId)
      const remaining = clients.filter((client) => client.id !== clientId)
      setClients(remaining)
      if (form.clientId === clientId) setForm((current) => ({ ...current, clientId: remaining[0]?.id ?? '' }))
      if (editingClientId === clientId) {
        setEditingClientId(null)
        setNewClient({ name: '', phone: '', address: '' })
        setShowClientForm(false)
      }
    } catch (error) {
      showApiError(error)
    } finally {
      setRequestKey(null)
    }
  }

  const handleCancelClientEdit = () => {
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(false)
  }

  const openNewProduct = () => {
    if (writesBlocked) return
    setEditingProductId(null)
    setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
    setShowProductForm(true)
  }

  const handleEditProduct = (product) => {
    if (writesBlocked) return
    setEditingProductId(product.id)
    setShowProductForm(true)
    setNewProduct({ category: product.category, size: product.size, name: product.name, price: String(product.price) })
  }

  const productPayload = () => ({ category: newProduct.category, size: newProduct.size || 'Un', name: newProduct.name.trim(), price: Number(newProduct.price) || 0 })

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
        setForm((current) => ({ ...current, productId: product.id }))
        showSuccessMessage('Produto adicionado com sucesso')
      }
      setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
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
      if (form.productId === productId) setForm((current) => ({ ...current, productId: remaining[0]?.id ?? '' }))
      if (editingProductId === productId) {
        setEditingProductId(null)
        setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
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
    setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
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
      <AppShell activeTab={activeTab} onNavigate={setActiveTab} onLogout={handleLogout} logoutDisabled={writesBlocked}>
        {toastMessage && <div className="toast-success" role="status"><span className="toast-icon"><Icon name="dashboard" size={17} /></span>{toastMessage}</div>}

        {activeTab === 'dashboard' && <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} />}
        {activeTab === 'orders' && <Orders orders={filteredOrders} search={orderSearch} onSearchChange={setOrderSearch} currency={currency} onNewOrder={openOrderModal} onFinalizeOrder={handleFinalizeOrder} onDeleteOrder={handleDeleteOrder} />}
        {activeTab === 'clients' && <Clients clients={filteredClients} search={clientSearch} sort={clientSort} onSearchChange={setClientSearch} onSortChange={setClientSort} onAdd={openNewClient} onEdit={handleEditClient} onDelete={handleDeleteClient} />}
        {activeTab === 'products' && <Products products={filteredProducts} search={productSearch} currency={currency} onSearchChange={setProductSearch} onAdd={openNewProduct} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />}
        {activeTab === 'receivables' && <Receivables orders={orders} currency={currency} onRegisterPayment={openPaymentModal} />}
        {activeTab === 'finance' && <Finance totals={financialTotals} movements={movements} currency={currency} onAddMovement={openMovementModal} />}

        {showOrderModal && (
          <Modal title="Novo pedido" onClose={() => setShowOrderModal(false)}>
            <form className="form-stack" onSubmit={handleOrderSubmit}>
              <div className="form-grid two-columns">
                <label className="form-field"><span>Cliente</span><select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
                <label className="form-field"><span>Tipo</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="Entrega">Entrega</option><option value="Retirada">Retirada</option><option value="Local">Consumo no local</option></select></label>
                <label className="form-field"><span>Data do pedido</span><input type="date" value={form.orderDate} max={todayValue} onChange={(event) => setForm((current) => ({ ...current, orderDate: event.target.value }))} /><small className="form-hint">Hoje vem preenchido automaticamente. Datas anteriores entram direto no histórico.</small></label>
                <label className="form-field"><span>Quantidade</span><input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
              </div>
              <label className="form-field"><span>Produto</span><select value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}>{products.map((product) => <option key={product.id} value={product.id}>{product.category} · {product.name} {product.size ? `(${product.size})` : ''} · {currency(product.price)}</option>)}</select></label>
              <div className="order-total-panel"><div><span>Valor unitário</span><strong>{currency(selectedProduct.price)}</strong></div><div className="order-total-highlight"><span>Total do pedido</span><strong>{currency(selectedProduct.price * Number(form.quantity || 1))}</strong></div></div>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowOrderModal(false)}>Cancelar</Button><Button type="submit" icon="plus" disabled={writesBlocked || !form.clientId || !form.productId}>Salvar pedido</Button></div>
            </form>
          </Modal>
        )}

        {paymentOrder && (
          <Modal title="Registrar pagamento" onClose={closePaymentModal}>
            <form className="form-stack" onSubmit={handleRegisterPayment}>
              <div className="payment-summary-card"><span>{paymentOrder.client} · Pedido #{String(paymentOrder.id).slice(-4)}</span><strong>{currency(paymentOrder.total)}</strong><small>O pagamento será lançado automaticamente como entrada no Financeiro.</small></div>
              <label className="form-field"><span>Forma de pagamento</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={closePaymentModal}>Cancelar</Button><Button type="submit" disabled={writesBlocked}>Confirmar pagamento</Button></div>
            </form>
          </Modal>
        )}

        {showClientForm && (
          <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}>
            <div className="form-stack">
              <label className="form-field"><span>Nome</span><input type="text" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="form-field"><span>Telefone</span><input type="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} /></label>
              <label className="form-field"><span>Endereço</span><input type="text" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} /></label>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newClient.name.trim()} onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>{editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}</Button></div>
            </div>
          </Modal>
        )}

        {showProductForm && (
          <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}>
            <div className="form-stack">
              <label className="form-field"><span>Nome do produto</span><input type="text" placeholder="Ex: Marmita executiva" value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} /></label>
              <div className="form-grid two-columns"><label className="form-field"><span>Categoria</span><select value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))}><option value="Marmita">Marmita</option><option value="Bebida">Bebida</option><option value="Doce">Doce</option><option value="Adicional">Adicional</option></select></label><label className="form-field"><span>Tamanho / unidade</span><input type="text" placeholder="Ex: M, 600ml, Un" value={newProduct.size} onChange={(event) => setNewProduct((current) => ({ ...current, size: event.target.value }))} /></label></div>
              <label className="form-field"><span>Preço</span><input type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: event.target.value }))} /></label>
              <div className="form-actions"><Button type="button" variant="secondary" onClick={handleCancelProductEdit}>Cancelar</Button><Button type="button" disabled={writesBlocked || !newProduct.name.trim()} onClick={handleAddProduct}>{editingProductId !== null ? 'Salvar alterações' : 'Adicionar produto'}</Button></div>
            </div>
          </Modal>
        )}

        {showMovementModal && (
          <Modal title="Registrar movimento" onClose={() => setShowMovementModal(false)}>
            <form className="form-stack" onSubmit={handleAddMovement}>
              <div className="form-grid two-columns"><label className="form-field"><span>Tipo</span><select value={newMovement.type} onChange={(event) => setNewMovement((current) => ({ ...current, type: event.target.value }))}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label className="form-field"><span>Categoria</span><select value={newMovement.category} onChange={(event) => setNewMovement((current) => ({ ...current, category: event.target.value }))}><option value="Vendas">Vendas</option><option value="Delivery">Delivery</option><option value="Insumos">Insumos</option><option value="Despesas">Despesas</option><option value="Outros">Outros</option></select></label></div>
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
