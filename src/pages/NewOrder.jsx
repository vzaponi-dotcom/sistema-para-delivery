import { useMemo, useState } from 'react'
import { findClientDuplicates } from '../../shared/clientIdentity.js'
import { validateCustomerIdentity } from '../../shared/orderCustomerIdentity.js'
import Button from '../components/Button'
import ClientDuplicateModal from '../components/ClientDuplicateModal'
import OrderCart from '../components/OrderCart'
import OrderCheckoutSummary from '../components/OrderCheckoutSummary'
import OrderProductCatalog from '../components/OrderProductCatalog'
import PageHeader from '../components/PageHeader'
import SystemSelect from '../components/SystemSelect'
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
const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]
const LOCAL_IDENTITY_OPTIONS = [
  { value: 'guest_name', label: 'Nome' },
  { value: 'table', label: 'Mesa' },
  { value: 'registered_client', label: 'Cliente cadastrado' },
]

function NewOrder({ clients, products, tableTabs = [], currency, disabled, onCancel, onCreateClient, onSubmit }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [clientSearch, setClientSearch] = useState(clients[0]?.name ?? '')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [type, setType] = useState('Entrega')
  const [localIdentityType, setLocalIdentityType] = useState('guest_name')
  const [localIdentityValue, setLocalIdentityValue] = useState('')
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

  const customerIdentity = type === 'Local'
    ? (localIdentityType === 'registered_client'
        ? { type: 'registered_client', clientId }
        : { type: localIdentityType, value: localIdentityValue })
    : { type: 'registered_client', clientId }
  const identityValidation = validateCustomerIdentity(type, customerIdentity)
  const normalizedLocalTable = localIdentityType === 'table' ? localIdentityValue.trim().toUpperCase() : ''
  const openTableTab = normalizedLocalTable
    ? tableTabs.find((tab) => tab.status === 'open' && tab.tableIdentifier === normalizedLocalTable) ?? null
    : null

  const draft = {
    clientId,
    customerIdentity,
    type,
    orderDate,
    items,
    deliveryFee: type === 'Entrega' ? deliveryFee : 0,
    adjustment,
  }
  const preview = calculateOrderPreview(draft)
  const canSubmit = Boolean(identityValidation.ok && orderDate && items.length)
  const usesRegisteredClient = type !== 'Local' || localIdentityType === 'registered_client'

  const closeQuickClient = () => {
    setQuickClient({ open: false, name: '', phone: '' })
    setQuickClientError('')
    setDuplicateClient(null)
  }

  const changeType = (nextType) => {
    setType(nextType)
    setCheckoutError('')
    closeQuickClient()
    if (nextType !== 'Entrega') setDeliveryFee('0')
    if (nextType === 'Local') {
      setLocalIdentityType('guest_name')
      setLocalIdentityValue('')
    }
  }

  const changeLocalIdentityType = (nextType) => {
    setLocalIdentityType(nextType)
    setLocalIdentityValue('')
    setCheckoutError('')
    closeQuickClient()
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
    closeQuickClient()
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
  }

  const handleConfirmDuplicate = async () => {
    setDuplicateClient(null)
    await createQuickClient()
  }

  const toggleQuickClient = () => {
    if (quickClient.open) {
      closeQuickClient()
      return
    }
    setQuickClientError('')
    setDuplicateClient(null)
    setQuickClient((current) => ({ ...current, open: true }))
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

            <div className="form-grid two-columns new-order-operation-fields">
              <div className="form-field">
                <span>Tipo do pedido</span>
                <SystemSelect value={type} options={ORDER_TYPE_OPTIONS} onChange={changeType} disabled={disabled} label="Tipo do pedido" />
              </div>
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

            {type === 'Local' && (
              <div className="new-order-local-identity">
                <span className="product-detail-label">Identificar por</span>
                <div className="new-order-local-identity-options" role="group" aria-label="Identificação do consumo no local">
                  {LOCAL_IDENTITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={localIdentityType === option.value ? 'new-order-local-identity-option selected' : 'new-order-local-identity-option'}
                      aria-pressed={localIdentityType === option.value}
                      onClick={() => changeLocalIdentityType(option.value)}
                      disabled={disabled}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {localIdentityType === 'guest_name' && (
                  <label className="form-field">
                    <span>Nome</span>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Ex: João"
                      value={localIdentityValue}
                      onChange={(event) => setLocalIdentityValue(event.target.value)}
                      disabled={disabled}
                      autoComplete="off"
                    />
                  </label>
                )}

                {localIdentityType === 'table' && (
                  <label className="form-field">
                    <span>Mesa</span>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="Ex: 04 ou A-2"
                      value={localIdentityValue}
                      onChange={(event) => setLocalIdentityValue(event.target.value)}
                      disabled={disabled}
                      autoComplete="off"
                    />
                    <small>Use letras, números ou hífen.</small>
                    {openTableTab && (
                      <div className="new-order-table-tab-hint" role="status">
                        Mesa {openTableTab.tableIdentifier} · comanda aberta. Este pedido será adicionado automaticamente.
                      </div>
                    )}
                  </label>
                )}
              </div>
            )}

            {usesRegisteredClient && (
              <>
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
                        inputMode="tel"
                        value={quickClient.phone}
                        onChange={(event) => updateQuickClient({ phone: formatPhone(event.target.value) })}
                        placeholder="(11) 99999-9999"
                        autoComplete="off"
                      />
                    </label>
                    <div className="form-actions">
                      <Button type="button" variant="secondary" onClick={closeQuickClient} disabled={disabled}>Cancelar</Button>
                      <Button type="submit" disabled={disabled || !quickClient.name.trim()}>Adicionar cliente</Button>
                    </div>
                  </form>
                )}
              </>
            )}
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