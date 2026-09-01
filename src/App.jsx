import { useEffect, useMemo, useState } from 'react'
import './App.css'

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

  if (!digits) {
    return ''
  }

  if (digits.length <= 2) {
    return `(${digits}`
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function App() {
  const [products, setProducts] = useState(() => readStorage(STORAGE_KEYS.products, initialProducts))
  const [clients, setClients] = useState(() => readStorage(STORAGE_KEYS.clients, initialClients))
  const [orders, setOrders] = useState(() => readStorage(STORAGE_KEYS.orders, initialOrders))
  const [movements, setMovements] = useState(() => readStorage(STORAGE_KEYS.movements, initialMovements))
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState({
    clientId: readStorage(STORAGE_KEYS.clients, initialClients)[0]?.id ?? 1,
    productId: readStorage(STORAGE_KEYS.products, initialProducts)[0]?.id ?? 1,
    type: 'Entrega',
    status: 'Pendente',
    quantity: 1,
  })
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    address: '',
  })
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [clientSort, setClientSort] = useState('name-asc')
  const [editingProductId, setEditingProductId] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    category: 'Marmita',
    size: 'P',
    name: 'Marmita',
    price: '32',
  })
  const [newMovement, setNewMovement] = useState({
    type: 'entrada',
    category: 'Vendas',
    description: '',
    value: '0',
  })
  const [toastMessage, setToastMessage] = useState('')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

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
    if (!clients.length) {
      return
    }

    const hasSelectedClient = clients.some((client) => client.id === Number(form.clientId))
    if (!hasSelectedClient) {
      setForm((current) => ({ ...current, clientId: clients[0].id }))
    }
  }, [clients, form.clientId])

  const selectedProduct = products.find((product) => product.id === Number(form.productId)) ?? products[0]

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

    return {
      entries,
      exits,
      balance: entries - exits,
    }
  }, [movements])

  const showSuccessMessage = (message = 'Ação salva com sucesso') => {
    setToastMessage(message)
  }

  const handleOrderSubmit = (event) => {
    event.preventDefault()

    const selectedClient = clients.find((client) => client.id === Number(form.clientId))

    if (!selectedClient) {
      return
    }

    const quantity = Number(form.quantity) || 1
    const total = selectedProduct.price * quantity

    const newOrder = {
      id: Date.now(),
      client: selectedClient.name,
      type: form.type,
      status: form.status,
      productName: selectedProduct.name,
      size: selectedProduct.size,
      quantity,
      total,
      date: 'Hoje',
    }

    setOrders((current) => [newOrder, ...current])
    setForm((current) => ({ ...current, quantity: 1, status: 'Pendente' }))
    setShowOrderModal(false)
    setActiveTab('orders')
    showSuccessMessage()
  }

  const handleNewOrder = () => {
    setActiveTab('orders')
    setShowOrderModal(true)
  }

  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      return
    }

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
    showSuccessMessage()
  }

  const handleEditClient = (client) => {
    setEditingClientId(client.id)
    setShowClientForm(true)
    setNewClient({
      name: client.name,
      phone: client.phone,
      address: client.address,
    })
  }

  const handleSaveClient = () => {
    if (!newClient.name.trim()) {
      return
    }

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
    showSuccessMessage()
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
      if (!normalizedSearch) {
        return true
      }

      return [client.name, client.phone, client.address]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })

    return [...filtered].sort((a, b) => {
      if (clientSort === 'name-desc') {
        return b.name.localeCompare(a.name)
      }

      return a.name.localeCompare(b.name)
    })
  }, [clientSearch, clientSort, clients])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase()

    return orders.filter((order) => {
      if (!normalizedSearch) {
        return true
      }

      return [order.client, order.type, order.size, order.date]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [orderSearch, orders])

  const handleDeleteOrder = (orderId) => {
    setOrders((current) => current.filter((order) => order.id !== orderId))
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return products
    }

    return products.filter((product) =>
      [product.name, product.category, product.size, String(product.price)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [productSearch, products])

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) {
      return
    }

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
    showSuccessMessage()
  }

  const handleEditProduct = (product) => {
    setEditingProductId(product.id)
    setShowProductForm(true)
    setNewProduct({
      category: product.category,
      size: product.size,
      name: product.name,
      price: String(product.price),
    })
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

    if (!description || value <= 0) {
      return
    }

    const movement = {
      id: Date.now(),
      type: newMovement.type,
      category: newMovement.category,
      description,
      value,
      date: 'Hoje',
    }

    setMovements((current) => [movement, ...current])
    setNewMovement({
      type: 'entrada',
      category: 'Vendas',
      description: '',
      value: '0',
    })
    setShowMovementModal(false)
    showSuccessMessage()
  }

  return (
    <div className="app-shell">
      <main className="main-panel">
        {toastMessage && <div className="toast-success">{toastMessage}</div>}

        {showOrderModal && (
          <div className="modal-backdrop" onClick={() => setShowOrderModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Novo pedido</h3>
                <button type="button" className="modal-close" onClick={() => setShowOrderModal(false)}>
                  ✕
                </button>
              </div>

              <form className="order-form" onSubmit={handleOrderSubmit}>
                <label>
                  Cliente
                  <select
                    value={form.clientId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, clientId: event.target.value }))
                    }
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tipo
                  <select
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                  >
                    <option value="Entrega">Entrega</option>
                    <option value="Retirada">Retirada</option>
                    <option value="Local">Consumo no local</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em preparo">Em preparo</option>
                    <option value="Pronto">Pronto</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                </label>

                <label>
                  Produto
                  <select
                    value={form.productId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, productId: event.target.value }))
                    }
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.category} • {product.name} {product.size ? `(${product.size})` : ''} • {currency(product.price)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quantity: event.target.value }))
                    }
                  />
                </label>

                <div className="price-box">
                  <span>Valor unitário</span>
                  <strong>{currency(selectedProduct.price)}</strong>
                </div>

                <div className="price-box total-box">
                  <span>Total do pedido</span>
                  <strong>{currency(selectedProduct.price * Number(form.quantity || 1))}</strong>
                </div>

                <button type="submit" className="primary-button full-width">
                  Salvar pedido
                </button>
              </form>
            </div>
          </div>
        )}

        {showClientForm && (
          <div className="modal-backdrop" onClick={handleCancelClientEdit}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingClientId !== null ? 'Editar cliente' : 'Novo cliente'}</h3>
                <button type="button" className="modal-close" onClick={handleCancelClientEdit}>
                  ✕
                </button>
              </div>

              <div className="android-form-grid">
                <input
                  type="text"
                  placeholder="Nome"
                  value={newClient.name}
                  onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))}
                />
                <input
                  type="text"
                  placeholder="Telefone"
                  value={newClient.phone}
                  onChange={(event) =>
                    setNewClient((current) => ({ ...current, phone: formatPhone(event.target.value) }))
                  }
                />
                <input
                  type="text"
                  placeholder="Endereço"
                  value={newClient.address}
                  onChange={(event) => setNewClient((current) => ({ ...current, address: event.target.value }))}
                />
              </div>

              <div className="android-form-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={editingClientId !== null ? handleSaveClient : handleAddClient}
                >
                  {editingClientId !== null ? 'Salvar' : 'Adicionar'}
                </button>

                <button type="button" className="secondary-button" onClick={handleCancelClientEdit}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showProductForm && (
          <div className="modal-backdrop" onClick={handleCancelProductEdit}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingProductId !== null ? 'Editar produto' : 'Novo produto'}</h3>
                <button type="button" className="modal-close" onClick={handleCancelProductEdit}>
                  ✕
                </button>
              </div>

              <div className="android-form-grid">
                <input
                  type="text"
                  placeholder="Nome do produto"
                  value={newProduct.name}
                  onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))}
                />
                <select
                  value={newProduct.category}
                  onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))}
                >
                  <option value="Marmita">Marmita</option>
                  <option value="Bebida">Bebida</option>
                  <option value="Doce">Doce</option>
                  <option value="Adicional">Adicional</option>
                </select>
                <input
                  type="text"
                  placeholder="Tamanho / unidade"
                  value={newProduct.size}
                  onChange={(event) => setNewProduct((current) => ({ ...current, size: event.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Preço"
                  value={newProduct.price}
                  onChange={(event) => setNewProduct((current) => ({ ...current, price: event.target.value }))}
                />
              </div>

              <div className="android-form-actions">
                <button type="button" className="primary-button" onClick={handleAddProduct}>
                  {editingProductId !== null ? 'Salvar' : 'Adicionar'}
                </button>
                <button type="button" className="secondary-button" onClick={handleCancelProductEdit}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showMovementModal && (
          <div className="modal-backdrop" onClick={() => setShowMovementModal(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Registrar movimento</h3>
                <button type="button" className="modal-close" onClick={() => setShowMovementModal(false)}>
                  ✕
                </button>
              </div>

              <form className="order-form" onSubmit={handleAddMovement}>
                <label>
                  Tipo
                  <select
                    value={newMovement.type}
                    onChange={(event) =>
                      setNewMovement((current) => ({ ...current, type: event.target.value }))
                    }
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </label>

                <label>
                  Categoria
                  <select
                    value={newMovement.category}
                    onChange={(event) =>
                      setNewMovement((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    <option value="Vendas">Vendas</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Insumos">Insumos</option>
                    <option value="Despesas">Despesas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </label>

                <label>
                  Descrição
                  <input
                    type="text"
                    placeholder="Ex: Compra de arroz"
                    value={newMovement.description}
                    onChange={(event) =>
                      setNewMovement((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Valor
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMovement.value}
                    onChange={(event) =>
                      setNewMovement((current) => ({ ...current, value: event.target.value }))
                    }
                  />
                </label>

                <button type="submit" className="primary-button full-width">
                  Salvar
                </button>
              </form>
            </div>
          </div>
        )}

        <header className="app-header">
          <div className="brand-box">
            <div className="brand-mark">A</div>
            <div className="brand-copy">
              <p className="eyebrow">Restaurante</p>
              <h1>Amor e Sabor</h1>
            </div>
          </div>

          <nav className="nav-menu" aria-label="Menu principal">
            <button
              type="button"
              className={activeTab === 'dashboard' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={activeTab === 'orders' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('orders')}
            >
              Pedidos
            </button>
            <button
              type="button"
              className={activeTab === 'clients' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('clients')}
            >
              Clientes
            </button>
            <button
              type="button"
              className={activeTab === 'products' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('products')}
            >
              Produtos
            </button>
            <button
              type="button"
              className={activeTab === 'finance' ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab('finance')}
            >
              Financeiro
            </button>
          </nav>
        </header>
        {activeTab === 'dashboard' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">Resumo do dia</p>
                <h2>Visão geral da operação</h2>
              </div>
              <button type="button" className="primary-button" onClick={handleNewOrder}>
                Novo pedido
              </button>
            </header>

            <section className="cards-grid">
              <article className="stat-card accent">
                <span>Faturamento</span>
                <strong>{currency(totals.revenue)}</strong>
                <small>Hoje</small>
              </article>
              <article className="stat-card">
                <span>Pedidos</span>
                <strong>{totals.totalOrders}</strong>
                <small>Total no período</small>
              </article>
              <article className="stat-card">
                <span>Média por pedido</span>
                <strong>{currency(totals.averageTicket)}</strong>
                <small>Ticket médio</small>
              </article>
              <article className="stat-card">
                <span>Marmitas vendidas</span>
                <strong>{totals.soldUnits}</strong>
                <small>Unidades</small>
              </article>
            </section>

            <section className="content-grid dashboard-grid">
              <div className="panel-block">
                <div className="panel-header">
                  <h3>Pedidos recentes</h3>
                </div>

                <div className="orders-list">
                  {orders.slice(0, 6).map((order) => (
                    <div key={order.id} className="order-item">
                      <div>
                        <strong>{order.client}</strong>
                        <p>
                          {order.type} • {order.size} • {order.quantity} unidade(s)
                        </p>
                      </div>
                      <div className="order-meta">
                        <span>{order.date}</span>
                        <span className={`status-badge status-${String(order.status || 'Pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                          {order.status || 'Pendente'}
                        </span>
                        <strong>{currency(order.total)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'orders' && (
          <section className="single-panel">
            <div className="panel-header">
              <h3>Pedidos</h3>
              <div className="panel-actions">
                <button type="button" className="primary-button" onClick={() => setShowOrderModal(true)}>
                  + Novo pedido
                </button>
                <button type="button" className="secondary-button" onClick={() => setActiveTab('dashboard')}>
                  Voltar ao dashboard
                </button>
              </div>
            </div>

            <div className="order-workflow">
              <div className="order-operations-panel">
                <div className="order-toolbar">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Buscar pedido"
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table className="order-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Tipo</th>
                        <th>Status</th>
                        <th>Marmita</th>
                        <th>Qtd.</th>
                        <th>Total</th>
                        <th>Data</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.client}</td>
                          <td>{order.type}</td>
                          <td>
                            <span className={`status-badge status-${String(order.status || 'Pendente').toLowerCase().replace(/\s+/g, '-')}`}>
                              {order.status || 'Pendente'}
                            </span>
                          </td>
                          <td>{order.size}</td>
                          <td>{order.quantity}</td>
                          <td>{currency(order.total)}</td>
                          <td>{order.date}</td>
                          <td>
                            <button type="button" className="table-action danger" onClick={() => handleDeleteOrder(order.id)}>
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'clients' && (
          <section className="single-panel client-panel-android">
            <div className="android-header">
              <div>
                <p className="eyebrow">Agenda</p>
                <h3>Clientes</h3>
              </div>
              <button
                type="button"
                className="primary-button compact-button"
                onClick={() => {
                  setEditingClientId(null)
                  setNewClient({ name: '', phone: '', address: '' })
                  setShowClientForm(true)
                }}
              >
                + Novo
              </button>
            </div>

            <div className="android-toolbar">
              <input
                type="text"
                className="search-input"
                placeholder="Buscar contato"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
              />

              <select
                className="sort-select"
                value={clientSort}
                onChange={(event) => setClientSort(event.target.value)}
              >
                <option value="name-asc">A-Z</option>
                <option value="name-desc">Z-A</option>
              </select>
            </div>

            <div className="android-client-list">
              {filteredClients.map((client) => (
                <div key={client.id} className="android-client-item">
                  <div className="avatar-pill">{client.name.charAt(0).toUpperCase()}</div>

                  <div className="android-client-main">
                    <strong>{client.name}</strong>
                    <span>{client.phone}</span>
                    <small>{client.address}</small>
                  </div>

                  <div className="android-client-actions">
                    <button
                      type="button"
                      className="mini-action edit"
                      aria-label={`Editar ${client.name}`}
                      onClick={() => handleEditClient(client)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="mini-action delete"
                      aria-label={`Excluir ${client.name}`}
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'products' && (
          <section className="single-panel">
            <div className="panel-header">
              <h3>Produtos e preços</h3>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setEditingProductId(null)
                  setNewProduct({ category: 'Marmita', size: 'P', name: '', price: '32' })
                  setShowProductForm(true)
                }}
              >
                Adicionar produto
              </button>
            </div>

            <div className="product-list-toolbar">
              <input
                type="text"
                className="search-input"
                placeholder="Buscar produto"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </div>

            <div className="product-list">
              {filteredProducts.map((product) => (
                <div key={product.id} className="product-row">
                  <div className="product-main">
                    <span className="product-tag">{product.category}</span>
                    <strong>{product.name}</strong>
                    <small>{product.size}</small>
                  </div>

                  <div className="product-price">
                    <strong>{currency(product.price)}</strong>
                  </div>

                  <div className="client-actions">
                    <button
                      type="button"
                      className="icon-button edit"
                      aria-label={`Editar ${product.name}`}
                      onClick={() => handleEditProduct(product)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="icon-button delete"
                      aria-label={`Excluir ${product.name}`}
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'finance' && (
          <section className="single-panel">
            <div className="panel-header">
              <h3>Financeiro</h3>
            </div>

            <div className="summary-grid">
              <article className="stat-card accent">
                <span>Entradas</span>
                <strong>{currency(financialTotals.entries)}</strong>
                <small>Receita total</small>
              </article>
              <article className="stat-card">
                <span>Saídas</span>
                <strong>{currency(financialTotals.exits)}</strong>
                <small>Despesas</small>
              </article>
              <article className="stat-card">
                <span>Saldo</span>
                <strong>{currency(financialTotals.balance)}</strong>
                <small>Lucro líquido</small>
              </article>
            </div>

            <div className="panel-header compact-panel-header">
              <h3>Registrar</h3>
              <button type="button" className="primary-button" onClick={() => setShowMovementModal(true)}>
                Novo movimento
              </button>
            </div>

            <div className="movement-list">
              {movements.map((movement) => (
                <div key={movement.id} className="movement-item">
                  <div>
                    <span className={movement.type === 'entrada' ? 'tag incoming' : 'tag outgoing'}>
                      {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                    <strong>{movement.description}</strong>
                    <p>
                      {movement.category} • {movement.date}
                    </p>
                  </div>
                  <strong className={movement.type === 'entrada' ? 'value positive' : 'value negative'}>
                    {movement.type === 'entrada' ? '+' : '-'}
                    {currency(movement.value)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
