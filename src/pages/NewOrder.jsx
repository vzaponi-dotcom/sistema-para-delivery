import { useMemo, useState } from 'react'
import { findClientDuplicates } from '../../shared/clientIdentity.js'
import Button from '../components/Button'
import ClientDuplicateModal from '../components/ClientDuplicateModal'
import OrderCart from '../components/OrderCart'
import OrderCheckoutSummary from '../components/OrderCheckoutSummary'
import OrderProductCatalog from '../components/OrderProductCatalog'
import PageHeader from '../components/PageHeader'
import {
  addCartItem,
  buildOrderPayload,
  calculateOrderPreview,
  commitCartItemNote,
  editCartItemNote,
  removeCartItem,
  updateCartItem,
} from '../utils/orderCart.js'
import { formatPhone } from '../utils/formFormatting.js'
import { toLocalDateValue } from '../utils/orderWorkflow.js'

const emptyAdjustment = { type: 'none', mode: 'fixed', value: '0', reason: '' }

function NewOrder({ clients, products, currency, disabled, onCancel, onCreateClient, onSubmit }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [clientSearch, setClientSearch] = useState(clients[0]?.name ?? '')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [type, setType] = useState('Entrega')
  const [orderDate, setOrderDate] = useState(toLocalDateValue())
  const [items, setItems] = useState([])
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [adjustment, setAdjustment] = useState(emptyAdjustment)
  const [quickClient, setQuickClient] = useState({ open: false, name: '', phone: '' })
  const [quickClientError, setQuickClientError] = useState('')
  const [duplicateClient, setDuplicateClient] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')

  const filteredClients = useMemo(() => {
    const normalized = clientSearch.trim().toLowerCase()
    if (!normalized || clients.some((client) => client.id === clientId && client.name === clientSearch)) return clients
    return clients.filter((client) => client.name.toLowerCase().includes(normalized))
  }, [clientId, clientSearch, clients])

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

  const handleClientSearchChange = (value) => {
    setClientSearch(value)
    setClientId('')
    setClientPickerOpen(true)
  }

  const selectClient = (client) => {
    setClientId(client.id)
    setClientSearch(client.name)
    setClientPickerOpen(false)
  }

  const handleClientPickerBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setClientPickerOpen(false)
  }

  const finishQuickClient = (client) => {
    selectClient(client)
    setQuickClient({ open: false, name: '', phone: '' })
    setQuickClientError('')
  }

  const createQuickClient = async () => {
    const client = await onCreateClient({ name: quickClient.name, phone: quickClient.phone })
    if (!client) return
    finishQuickClient(client)
  }

  const handleQuickClientSubmit = async (event) => {
    event.preventDefault()
    if (disabled || !quickClient.name.trim()) return
    setQuickClientError('')

    const duplicate = findClientDuplicates(clients, quickClient)
    if (duplicate.phone) {
      setQuickClientError(`Telefone já cadastrado para ${duplicate.phone.name}. Selecione esse cliente na busca acima.`)
      return
    }
    if (duplicate.name) {
      setDuplicateClient(duplicate.name)
      return
    }

    await createQuickClient()
  }

  const handleUseExistingDuplicate = () => {
    if (!duplicateClient) return
    finishQuickClient(duplicateClient)
    setDuplicateClient(null)
  }

  const handleConfirmDuplicate = async () => {
    setDuplicateClient(null)
    await createQuickClient()
  }

  const toggleQuickClient = () => {
    setQuickClientError('')
    setDuplicateClient(null)
    setQuickClient((current) => ({ ...current, open: !current.open }))
  }

  const updateQuickClient = (patch) => {
    setQuickClientError('')
    setQuickClient((current) => ({ ...current, ...patch }))
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

            <div
              className="form-field new-order-client-picker"
              onBlur={handleClientPickerBlur}
            >
              <span>Cliente</span>
              <div className="new-order-client-combobox">
                <input
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={clientPickerOpen}
                  aria-controls="new-order-client-options"
                  placeholder="Digite o nome do cliente"
                  value={clientSearch}
                  onFocus={() => setClientPickerOpen(true)}
                  onChange={(event) => handleClientSearchChange(event.target.value)}
                  disabled={disabled || !clients.length}
                  autoComplete="off"
                />
                {clientPickerOpen && !disabled && (
                  <div id="new-order-client-options" className="new-order-client-options" role="listbox">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        role="option"
                        aria-selected={client.id === clientId}
                        className={client.id === clientId ? 'selected' : ''}
                        onClick={() => selectClient(client)}
                      >
                        {client.name}
                      </button>
                    ))}
                    {!filteredClients.length && (
                      <span className="new-order-client-empty">Nenhum cliente encontrado</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="new-order-quick-client-toggle"
              onClick={toggleQuickClient}
              disabled={disabled}
            >
              + Novo cliente
            </button>

            {quickClient.open && (
              <form className="new-order-quick-client" onSubmit={handleQuickClientSubmit}>
                {quickClientError && <div className="new-order-error" role="alert">{quickClientError}</div>}
                <label className="form-field">
                  <span>Nome</span>
                  <input
                    type="text"
                    value={quickClient.name}
                    onChange={(event) => updateQuickClient({ name: event.target.value })}
                    placeholder="Nome do cliente"
                    autoComplete="off"
                  />
                </label>
                <label className="form-field">
                  <span>Telefone</span>
                  <input
                    type="tel"
                    value={quickClient.phone}
                    onChange={(event) => updateQuickClient({ phone: formatPhone(event.target.value) })}
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
            items={items}
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
            onNoteChange={(lineId, note) => setItems((current) => editCartItemNote(current, lineId, note))}
            onNoteCommit={(lineId) => setItems((current) => commitCartItemNote(current, lineId))}
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

      {duplicateClient && (
        <ClientDuplicateModal
          client={duplicateClient}
          onCancel={() => setDuplicateClient(null)}
          onUseExisting={handleUseExistingDuplicate}
          onConfirm={handleConfirmDuplicate}
          disabled={disabled}
          cancelLabel="Cancelar"
          useExistingLabel="Usar cliente existente"
          confirmLabel="Cadastrar mesmo assim"
        />
      )}
    </>
  )
}

export default NewOrder