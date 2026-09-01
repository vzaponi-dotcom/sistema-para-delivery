import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AppShell from './components/AppShell'
import Button from './components/Button'
import Icon from './components/Icon'
import Modal from './components/Modal'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Finance from './pages/Finance'
import { normalizeOrder } from './utils/orderWorkflow'

const STORAGE_KEYS = {
  products: 'amor-e-sabor-products',
  clients: 'amor-e-sabor-clients',
  orders: 'amor-e-sabor-orders',
  movements: 'amor-e-sabor-movements',
}

const initialProducts = [
  { id: 1, category: 'Marmita', size: 'P', name: 'Marmita Pequena', price: 32 },
  { id: 2, category: 'Marmita', size: 'M', name: 'Marmita Média', price: 42 },
  { id: 3, category: 'Marmita', size: 'G', name: 'Marmita Grande', price: 58 },
  { id: 4, category: 'Bebida', size: '600ml', name: 'Refrigerante Lata', price: 8 },
  { id: 5, category: 'Doce', size: 'Un', name: 'Pudim', price: 12 },
  { id: 6, category: 'Doce', size: 'Un', name: 'Brownie', price: 10 },
]

const initialClients = [
  { id: 1, name: 'Maria Silva', phone: '(11) 99888-1234', address: 'Centro' },
  { id: 2, name: 'João Pereira', phone: '(11) 98765-4321', address: 'Jardim das Flores' },
  { id: 3, name: 'Ana Costa', phone: '(11) 99111-2222', address: 'Vila Nova' },
]

const initialOrders = [
  { id: 1, client: 'Maria Silva', type: 'Entrega', size: 'M', quantity: 2, total: 84, date: 'Hoje' },
  { id: 2, client: 'João Pereira', type: 'Retirada', size: 'P', quantity: 1, total: 32, date: 'Hoje' },
  { id: 3, client: 'Ana Costa', type: 'Local', size: 'G', quantity: 1, total: 58, date: 'Ontem' },
  { id: 4, client: 'Maria Silva', type: 'Entrega', size: 'M', quantity: 3, total: 126, date: 'Hoje' },
]

const initialMovements = [
  { id: 1, type: 'entrada', category: 'Vendas', description: 'Marmitas do dia', value: 340, date: 'Hoje' },
  { id: 2, type: 'saida', category: 'Insumos', description: 'Compra de arroz e legumes', value: 128, date: 'Hoje' },
  { id: 3, type: 'entrada', category: 'Delivery', description: 'Pedido de entrega', value: 96, date: 'Ontem' },
  { id: 4, type: 'saida', category: 'Despesas', description: 'Gás e materiais', value: 70, date: 'Ontem' },
]

const readStorage = (key, fallback) => {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch {
    return fallback
  }
}

const currency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function App() {
  const [products, setProducts] = useState(() => readStorage(STORAGE_KEYS.products, initialProducts))
  const [clients, setClients] = useState(() => readStorage(STORAGE_KEYS.clients, initialClients))
  const [orders, setOrders] = useState(() => readStorage(STORAGE_KEYS.orders, initialOrders).map((order) => normalizeOrder(order)))
  const [movements, setMovements] = useState(() => readStorage(STORAGE_KEYS.movements, initialMovements))
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState({
    clientId: readStorage(STORAGE_KEYS.clients, initialClients)[0]?.id ?? 1,
    productId: readStorage(STORAGE_KEYS.products, initialProducts)[0]?.id ?? 1,
    type: 'Entrega',
    quantity: 1,
  })
  const [newClient, setNewClient] = useState({ name: '', phone: '', address: '' })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [clientSort, setClientSort] = useState('name-asc')
  const [editingProductId, setEditingProductId] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState({ category: 'Marmita', size: 'P', name: 'Marmita', price: '32' })
  const [newMovement, setNewMovement] = useState({ type: 'entrada', category: 'Vendas', description: '', value: '0' })
  const [toastMessage, setToastMessage] = useState('')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients))
  }, [clients])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.movements, JSON.stringify(movements))
  }, [movements])

  useEffect(() => {
    if (!clients.length) return
    const hasSelectedClient = clients.some((client) => client.id === Number(form.clientId))
    if (!hasSelectedClient) {
      setForm((current) => ({ ...current, clientId: clients[0].id }))
    }
  }, [clients, form.clientId])

  const selectedProduct = products.find((product) => product.id === Number(form.productId)) ?? products[0] ?? {
    name: 'Produto',
    size: '',
    price: 0,
  }

  const totals = useMemo(() => {
    const revenue = orders.reduce((total, order) => total + Number(order.total), 0)
    const totalOrders = orders.length
    const averageTicket = totalOrders ? revenue / totalOrders : 0
    const soldUnits = orders.reduce((total, order) => total + Number(order.quantity), 0)
    return { revenue, totalOrders, averageTicket, soldUnits }
  }, [orders])

  const financialTotals = useMemo(() => {
    const entries = movements
      .filter((movement) => movement.type === 'entrada')
      .reduce((total, movement) => total + Number(movement.value), 0)
    const exits = movements
      .filter((movement) => movement.type === 'saida')
      .reduce((total, movement) => total + Number(movement.value), 0)
    return { entries, exits, balance: entries - exits }
  }, [movements])

  const showSuccessMessage = (message = 'Ação salva com sucesso') => setToastMessage(message)

  const handleOrderSubmit = (event) => {
    event.preventDefault()
    const selectedClient = clients.find((client) => client.id === Number(form.clientId))
    if (!selectedClient || !selectedProduct) return

    const quantity = Number(form.quantity) || 1
    const total = selectedProduct.price * quantity
    const createdAt = new Date().toISOString()
    const newOrder = {
      id: Date.now(),
      client: selectedClient.name,
      type: form.type,
      status: 'Em preparo',
      productName: selectedProduct.name,
      size: selectedProduct.size,
      quantity,
      total,
      date: 'Hoje',
      createdAt,
      finishedAt: null,
    }

    setOrders((current) => [newOrder, ...current])
    setForm((current) => ({ ...current, quantity: 1 }))
    setShowOrderModal(false)
    setActiveTab('orders')
    showSuccessMessage('Pedido entrou em preparo')
  }

  const handleNewOrder = () => {
    setActiveTab('orders')
    setShowOrderModal(true)
  }

  const handleFinalizeOrder = (orderId) => {
    const order = orders.find((item) => item.id === orderId)
    if (!order) return

    setOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? { ...item, status: 'Finalizado', finishedAt: new Date().toISOString() }
          : item,
      ),
    )

    showSuccessMessage(order.type === 'Entrega' ? 'Pedido saiu para entrega' : 'Pedido finalizado')
  }

  const handleAddClient = () => {
    if (!newClient.name.trim()) return
    const client = {
      id: Date.now(),
      name: newClient.name,
      phone: newClient.phone || '(00) 00000-0000',
      address: newClient.address || 'Sem endereço',
    }
    setClients((current) => [client, ...current])
    setForm((current) => ({ ...current, clientId: client.id }))
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(false)
    showSuccessMessage('Cliente adicionado com sucesso')
  }

  const handleEditClient = (client) => {
    setEditingClientId(client.id)
    setShowClientForm(true)
    setNewClient({ name: client.name, phone: client.phone, address: client.address })
  }

  const handleSaveClient = () => {
    if (!newClient.name.trim()) return
    setClients((current) =>
      current.map((client) =>
        client.id === editingClientId
          ? {
              ...client,
              name: newClient.name,
              phone: newClient.phone || '(00) 00000-0000',
              address: newClient.address || 'Sem endereço',
            }
          : client,
      ),
    )
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(false)
    showSuccessMessage('Cliente atualizado com sucesso')
  }

  const handleDeleteClient = (clientId) => {
    setClients((current) => current.filter((client) => client.id !== clientId))
    if (editingClientId === clientId) {
      setEditingClientId(null)
      setNewClient({ name: '', phone: '', address: '' })
    }
  }

  const handleCancelClientEdit = () => {
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(false)
  }

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase()
    const filtered = clients.filter((client) => {
      if (!normalizedSearch) return true
      return [client.name, client.phone, client.address].join(' ').toLowerCase().includes(normalizedSearch)
    })
    return [...filtered].sort((a, b) =>
      clientSort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    )
  }, [clientSearch, clientSort, clients])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase()
    return orders.filter((order) => {
      if (!normalizedSearch) return true
      return [order.client, order.type, order.size, order.date, order.productName, order.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [orderSearch, orders])

  const handleDeleteOrder = (orderId) => setOrders((current) => current.filter((order) => order.id !== orderId))

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()
    if (!normalizedSearch) return products
    return products.filter((product) =>
      [product.name, product.category, product.size, String(product.price)].join(' ').toLowerCase().includes(normalizedSearch),
    )
  }, [productSearch, products])

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) return
    const productData = {
      id: editingProductId ?? Date.now(),
      category: newProduct.category,
      size: newProduct.size || 'Un',
      name: newProduct.name,
      price: Number(newProduct.price) || 0,
    }

    if (editingProductId !== null) {
      setProducts((current) => current.map((product) => (product.id === editingProductId ? productData : product)))
      setEditingProductId(null)
    } else {
      setProducts((current) => [productData, ...current])
      setForm((current) => ({ ...current, productId: productData.id }))
    }

    setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
    setShowProductForm(false)
    showSuccessMessage(editingProductId !== null ? 'Produto atualizado com sucesso' : 'Produto adicionado com sucesso')
  }

  const handleEditProduct = (product) => {
    setEditingProductId(product.id)
    setShowProductForm(true)
    setNewProduct({ category: product.category, size: product.size, name: product.name, price: String(product.price) })
  }

  const handleDeleteProduct = (productId) => {
    setProducts((current) => current.filter((product) => product.id !== productId))
    if (Number(form.productId) === productId) {
      const remainingProduct = products.find((product) => product.id !== productId)
      setForm((current) => ({ ...current, productId: remainingProduct?.id ?? 1 }))
    }
    if (editingProductId === productId) {
      setEditingProductId(null)
      setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
      setShowProductForm(false)
    }
  }

  const handleCancelProductEdit = () => {
    setEditingProductId(null)
    setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
    setShowProductForm(false)
  }

  const handleAddMovement = (event) => {
    event.preventDefault()
    const description = newMovement.description.trim()
    const value = Number(newMovement.value) || 0
    if (!description || value <= 0) return

    const movement = {
      id: Date.now(),
      type: newMovement.type,
      category: newMovement.category,
      description,
      value,
      date: 'Hoje',
    }

    setMovements((current) => [movement, ...current])
    setNewMovement({ type: 'entrada', category: 'Vendas', description: '', value: '0' })
    setShowMovementModal(false)
    showSuccessMessage('Movimentação registrada com sucesso')
  }

  const openNewClient = () => {
    setEditingClientId(null)
    setNewClient({ name: '', phone: '', address: '' })
    setShowClientForm(true)
  }

  const openNewProduct = () => {
    setEditingProductId(null)
    setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
    setShowProductForm(true)
  }

  return (
    <AppShell activeTab={activeTab} onNavigate={setActiveTab}>
      {toastMessage && (
        <div className="toast-success" role="status">
          <span className="toast-icon"><Icon name="dashboard" size={17} /></span>
          {toastMessage}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <Dashboard totals={totals} orders={orders} currency={currency} onNewOrder={handleNewOrder} />
      )}

      {activeTab === 'orders' && (
        <Orders
          orders={filteredOrders}
          search={orderSearch}
          onSearchChange={setOrderSearch}
          currency={currency}
          onNewOrder={() => setShowOrderModal(true)}
          onFinalizeOrder={handleFinalizeOrder}
          onDeleteOrder={handleDeleteOrder}
        />
      )}

      {activeTab === 'clients' && (
        <Clients
          clients={filteredClients}
          search={clientSearch}
          sort={clientSort}
          onSearchChange={setClientSearch}
          onSortChange={setClientSort}
          onAdd={openNewClient}
          onEdit={handleEditClient}
          onDelete={handleDeleteClient}
        />
      )}

      {activeTab === 'products' && (
        <Products
          products={filteredProducts}
          search={productSearch}
          currency={currency}
          onSearchChange={setProductSearch}
          onAdd={openNewProduct}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
        />
      )}

      {activeTab === 'finance' && (
        <Finance
          totals={financialTotals}
          movements={movements}
          currency={currency}
          onAddMovement={() => setShowMovementModal(true)}
        />
      )}

      {showOrderModal && (
        <Modal title="Novo pedido" onClose={() => setShowOrderModal(false)}>
          <form className="form-stack" onSubmit={handleOrderSubmit}>
            <div className="form-grid two-columns">
              <label className="form-field">
                <span>Cliente</span>
                <select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo</span>
                <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                  <option value="Entrega">Entrega</option>
                  <option value="Retirada">Retirada</option>
                  <option value="Local">Consumo no local</option>
                </select>
              </label>

              <label className="form-field">
                <span>Quantidade</span>
                <input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
              </label>
            </div>

            <label className="form-field">
              <span>Produto</span>
              <select value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.category} · {product.name} {product.size ? `(${product.size})` : ''} · {currency(product.price)}
                  </option>
                ))}
              </select>
            </label>

            <div className="order-total-panel">
              <div><span>Valor unitário</span><strong>{currency(selectedProduct.price)}</strong></div>
              <div className="order-total-highlight"><span>Total do pedido</span><strong>{currency(selectedProduct.price * Number(form.quantity || 1))}</strong></div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setShowOrderModal(false)}>Cancelar</Button>
              <Button type="submit" icon="plus">Salvar pedido</Button>
            </div>
          </form>
        </Modal>
      )}

      {showClientForm && (
        <Modal title={editingClientId !== null ? 'Editar cliente' : 'Novo cliente'} onClose={handleCancelClientEdit}>
          <div className="form-stack">
            <label className="form-field">
              <span>Nome</span>
              <input type="text" placeholder="Ex: Maria Silva" value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="form-field">
              <span>Telefone</span>
              <input type="tel" placeholder="(11) 99999-9999" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))} />
            </label>
            <label className="form-field">
              <span>Endereço</span>
              <input type="text" placeholder="Bairro ou endereço" value={newClient.address} onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={handleCancelClientEdit}>Cancelar</Button>
              <Button type="button" onClick={editingClientId !== null ? handleSaveClient : handleAddClient}>
                {editingClientId !== null ? 'Salvar alterações' : 'Adicionar cliente'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showProductForm && (
        <Modal title={editingProductId !== null ? 'Editar produto' : 'Novo produto'} onClose={handleCancelProductEdit}>
          <div className="form-stack">
            <label className="form-field">
              <span>Nome do produto</span>
              <input type="text" placeholder="Ex: Marmita executiva" value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <div className="form-grid two-columns">
              <label className="form-field">
                <span>Categoria</span>
                <select value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))}>
                  <option value="Marmita">Marmita</option>
                  <option value="Bebida">Bebida</option>
                  <option value="Doce">Doce</option>
                  <option value="Adicional">Adicional</option>
                </select>
              </label>
              <label className="form-field">
                <span>Tamanho / unidade</span>
                <input type="text" placeholder="Ex: M, 600ml, Un" value={newProduct.size} onChange={(event) => setNewProduct((current) => ({ ...current, size: event.target.value }))} />
              </label>
            </div>
            <label className="form-field">
              <span>Preço</span>
              <input type="number" min="0" step="0.01" value={newProduct.price} onChange={(event) => setNewProduct((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={handleCancelProductEdit}>Cancelar</Button>
              <Button type="button" onClick={handleAddProduct}>{editingProductId !== null ? 'Salvar alterações' : 'Adicionar produto'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {showMovementModal && (
        <Modal title="Registrar movimento" onClose={() => setShowMovementModal(false)}>
          <form className="form-stack" onSubmit={handleAddMovement}>
            <div className="form-grid two-columns">
              <label className="form-field">
                <span>Tipo</span>
                <select value={newMovement.type} onChange={(event) => setNewMovement((current) => ({ ...current, type: event.target.value }))}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </label>
              <label className="form-field">
                <span>Categoria</span>
                <select value={newMovement.category} onChange={(event) => setNewMovement((current) => ({ ...current, category: event.target.value }))}>
                  <option value="Vendas">Vendas</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Insumos">Insumos</option>
                  <option value="Despesas">Despesas</option>
                  <option value="Outros">Outros</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Descrição</span>
              <input type="text" placeholder="Ex: Compra de arroz" value={newMovement.description} onChange={(event) => setNewMovement((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="form-field">
              <span>Valor</span>
              <input type="number" min="0" step="0.01" value={newMovement.value} onChange={(event) => setNewMovement((current) => ({ ...current, value: event.target.value }))} />
            </label>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setShowMovementModal(false)}>Cancelar</Button>
              <Button type="submit">Salvar movimento</Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}

export default App
