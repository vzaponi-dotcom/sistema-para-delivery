import { useMemo, useState } from 'react'
import Button from '../components/Button'
import OrderCart from '../components/OrderCart'
import OrderCheckoutSummary from '../components/OrderCheckoutSummary'
import OrderProductCatalog from '../components/OrderProductCatalog'
import PageHeader from '../components/PageHeader'
import { addCartItem, buildOrderPayload, calculateOrderPreview, removeCartItem, updateCartItem } from '../utils/orderCart.js'
import { toLocalDateValue } from '../utils/orderWorkflow.js'

const emptyAdjustment = { type: 'none', mode: 'fixed', value: '0', reason: '' }

function NewOrder({ clients, products, currency, disabled, onCancel, onCreateClient, onSubmit }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [clientSearch, setClientSearch] = useState('')
  const [type, setType] = useState('Entrega')
  const [orderDate, setOrderDate] = useState(toLocalDateValue())
  const [items, setItems] = useState([])
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [adjustment, setAdjustment] = useState(emptyAdjustment)
  const [quickClient, setQuickClient] = useState({ open: false, name: '', phone: '' })
  const [checkoutError, setCheckoutError] = useState('')

  const filteredClients = useMemo(() => {
    const normalized = clientSearch.trim().toLowerCase()
    if (!normalized) return clients
    return clients.filter((client) => [client.name, client.phone].join(' ').toLowerCase().includes(normalized))
  }, [clientSearch, clients])

  const draft = {
    clientId,
    type,
    orderDate,
    items,
    deliveryFee: type === 'Entrega' ? deliveryFee : 0,
    adjustment,
  }
  const preview = calculateOrderPreview(draft)
  const canSubmit = Boolean(clientId && orderDate && items.length)

  const changeType = (nextType) => {
    setType(nextType)
    if (nextType !== 'Entrega') setDeliveryFee('0')
  }

  const handleAdjustmentChange = (patch) => {
    setAdjustment((current) => {
      const next = { ...current, ...patch }
      if (patch.type === 'none') return emptyAdjustment
      return next
    })
  }

  const handleQuickClientSubmit = async (event) => {
    event.preventDefault()
    if (disabled || !quickClient.name.trim()) return
    const client = await onCreateClient({ name: quickClient.name, phone: quickClient.phone })
    if (!client) return
    setClientId(client.id)
    setClientSearch('')
    setQuickClient({ open: false, name: '', phone: '' })
  }

  const save = async (paymentMethod) => {
    if (disabled || !canSubmit) return
    setCheckoutError('')
    const success = await onSubmit(buildOrderPayload(draft, paymentMethod))
    if (!success) setCheckoutError('Não foi possível salvar a venda. Seus dados continuam aqui para tentar novamente.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Atendimento"
        title="Nova venda"
        description="Monte todo o pedido, confira o total e salve como pendente ou já recebido."
        actions={<Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>Cancelar</Button>}
      />

      {checkoutError && <div className="new-order-error" role="alert">{checkoutError}</div>}

      <div className="new-order-layout">
        <div className="new-order-main-column">
          <section className="surface-card new-order-customer-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Cliente e operação</span>
                <h2>Dados da venda</h2>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label className="form-field">
                <span>Buscar cliente</span>
                <input
                  type="search"
                  placeholder="Nome ou telefone"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Cliente</span>
                <select value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={disabled || !clients.length}>
                  {!clients.length && <option value="">Cadastre um cliente</option>}
                  {filteredClients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.phone ? ` · ${client.phone}` : ''}</option>)}
                  {clientId && !filteredClients.some((client) => client.id === clientId) && clients.find((client) => client.id === clientId) && (
                    <option value={clientId}>{clients.find((client) => client.id === clientId).name}</option>
                  )}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="new-order-quick-client-toggle"
              onClick={() => setQuickClient((current) => ({ ...current, open: !current.open }))}
              disabled={disabled}
            >
              + Novo cliente
            </button>

            {quickClient.open && (
              <form className="new-order-quick-client" onSubmit={handleQuickClientSubmit}>
                <label className="form-field">
                  <span>Nome</span>
                  <input
                    type="text"
                    value={quickClient.name}
                    onChange={(event) => setQuickClient((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nome do cliente"
                    autoComplete="off"
                  />
                </label>
                <label className="form-field">
                  <span>Telefone</span>
                  <input
                    type="tel"
                    value={quickClient.phone}
                    onChange={(event) => setQuickClient((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="(11) 99999-9999"
                    autoComplete="off"
                  />
                </label>
                <Button type="submit" disabled={disabled || !quickClient.name.trim()}>Adicionar cliente</Button>
              </form>
            )}

            <div className="form-grid two-columns new-order-operation-fields">
              <label className="form-field">
                <span>Tipo do pedido</span>
                <select value={type} onChange={(event) => changeType(event.target.value)} disabled={disabled}>
                  <option value="Entrega">Entrega</option>
                  <option value="Retirada">Retirada</option>
                  <option value="Local">Consumo no local</option>
                </select>
              </label>
              <label className="form-field">
                <span>Data do pedido</span>
                <input
                  type="date"
                  value={orderDate}
                  max={toLocalDateValue()}
                  onChange={(event) => setOrderDate(event.target.value)}
                  disabled={disabled}
                />
              </label>
            </div>
          </section>

          <OrderProductCatalog
            products={products}
            currency={currency}
            disabled={disabled}
            onAdd={(product) => setItems((current) => addCartItem(current, product, ''))}
          />
        </div>

        <div className="new-order-cart-column">
          <OrderCart
            items={items}
            currency={currency}
            disabled={disabled}
            onUpdate={(lineId, patch) => setItems((current) => updateCartItem(current, lineId, patch))}
            onRemove={(lineId) => setItems((current) => removeCartItem(current, lineId))}
          />
          <OrderCheckoutSummary
            draft={draft}
            preview={preview}
            currency={currency}
            disabled={disabled}
            canSubmit={canSubmit}
            onDeliveryFeeChange={setDeliveryFee}
            onAdjustmentChange={handleAdjustmentChange}
            onSavePending={() => save()}
            onSavePaid={(method) => save(method)}
          />
        </div>
      </div>
    </>
  )
}

export default NewOrder
