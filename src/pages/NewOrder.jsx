import { useEffect, useMemo, useRef, useState } from 'react'
import { findClientDuplicates } from '../../shared/clientIdentity.js'
import { getBusinessDate } from '../../shared/finance.js'
import { validateCustomerIdentity } from '../../shared/orderCustomerIdentity.js'
import Button from '../components/Button'
import ClientDuplicateModal from '../components/ClientDuplicateModal'
import NewOrderCustomerStep from '../components/NewOrderCustomerStep'
import NewOrderProductsStep from '../components/NewOrderProductsStep'
import NewOrderReviewStep from '../components/NewOrderReviewStep'
import NewOrderStepIndicator from '../components/NewOrderStepIndicator'
import PageHeader from '../components/PageHeader'
import {
  addCartItem,
  buildOrderPayload,
  calculateOrderPreview,
  commitCartItemNote,
  decrementCartProduct,
  editCartItemNote,
  removeCartItem,
  updateCartItem,
} from '../utils/orderCart.js'
import { formatBRLCurrencyValue, formatPhone, parseBRLCurrencyInput } from '../utils/formFormatting.js'
import {
  NEW_ORDER_STEPS,
  canNavigateToNewOrderStep,
  createNewOrderDirtySnapshot,
  getFurthestReachedStep,
  getNewOrderStepAccess,
  getOrderItemCount,
  getOrderItemsSubtotal,
  isNewOrderDraftDirty,
} from '../utils/newOrderStepFlow.js'
import { businessDateTimeToIso, isFutureSameDaySchedule } from '../../shared/orderTiming.js'

const emptyAdjustment = () => ({ type: 'none', mode: 'fixed', value: formatBRLCurrencyValue(0), reason: '' })

function NewOrder({ clients, products, tables = [], initialType = 'Entrega', initialTableId = '', expectedTableTabId = '', currency, disabled, canManageClients = true, canAdjustOrders = true, onCancel, onCreateClient, onSubmit, onDraftDirtyChange }) {
  const initialStep = initialTableId ? NEW_ORDER_STEPS.PRODUCTS : NEW_ORDER_STEPS.CUSTOMER
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [maxReachedStep, setMaxReachedStep] = useState(initialStep)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [clientSearch, setClientSearch] = useState(clients[0]?.name ?? '')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [type, setType] = useState(initialTableId ? 'Local' : initialType)
  const [selectedTableId, setSelectedTableId] = useState(initialTableId)
  const [localClientId, setLocalClientId] = useState('')
  const [localClientSearch, setLocalClientSearch] = useState('')
  const [orderDate, setOrderDate] = useState(getBusinessDate())
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduledTime, setScheduledTime] = useState('')
  const [items, setItems] = useState([])
  const [deliveryFee, setDeliveryFee] = useState(() => formatBRLCurrencyValue(0))
  const [adjustment, setAdjustment] = useState(emptyAdjustment)
  const [quickClient, setQuickClient] = useState({ open: false, name: '', phone: '' })
  const [quickClientError, setQuickClientError] = useState('')
  const [duplicateClient, setDuplicateClient] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const initialDraftSnapshotRef = useRef(null)
  const stepContentRef = useRef(null)

  if (initialDraftSnapshotRef.current === null) {
    initialDraftSnapshotRef.current = createNewOrderDirtySnapshot({
      clientId,
      type,
      selectedTableId,
      localClientId,
      orderDate,
      scheduleMode,
      scheduledTime,
      items,
      deliveryFee,
      adjustment,
      quickClient,
    })
  }

  const draftDirty = isNewOrderDraftDirty({
    clientId,
    type,
    selectedTableId,
    localClientId,
    orderDate,
    scheduleMode,
    scheduledTime,
    items,
    deliveryFee,
    adjustment,
    quickClient,
  }, initialDraftSnapshotRef.current)

  useEffect(() => {
    onDraftDirtyChange?.(draftDirty)
  }, [draftDirty, onDraftDirtyChange])

  useEffect(() => () => {
    onDraftDirtyChange?.(false)
  }, [onDraftDirtyChange])

  useEffect(() => {
    stepContentRef.current?.focus()
  }, [currentStep])

  const activeClientId = type === 'Local' ? localClientId : clientId
  const activeClientSearch = type === 'Local' ? localClientSearch : clientSearch
  const filteredClients = useMemo(() => {
    const normalized = activeClientSearch.trim().toLowerCase()
    if (!normalized || clients.some((client) => client.id === activeClientId && client.name === activeClientSearch)) return clients
    return clients.filter((client) => client.name.toLowerCase().includes(normalized))
  }, [activeClientId, activeClientSearch, clients])

  const customerIdentity = type === 'Local'
    ? { type: 'table', tableId: selectedTableId, ...(localClientId ? { clientId: localClientId } : {}) }
    : { type: 'registered_client', clientId }
  const identityValidation = validateCustomerIdentity(type, customerIdentity)
  const selectedTable = tables.find((table) => table.isActive && table.id === selectedTableId) ?? null

  const draft = {
    clientId: activeClientId,
    customerIdentity,
    type,
    orderDate,
    items,
    deliveryFee: type === 'Entrega' ? deliveryFee : formatBRLCurrencyValue(0),
    adjustment,
    scheduledFor: scheduleMode === 'scheduled' ? businessDateTimeToIso(orderDate, scheduledTime) : null,
    expectedTableTabId,
  }
  const numericDraft = {
    ...draft,
    deliveryFee: type === 'Entrega' ? parseBRLCurrencyInput(deliveryFee) : 0,
    adjustment: {
      ...adjustment,
      value: adjustment.mode === 'fixed'
        ? parseBRLCurrencyInput(adjustment.value)
        : Math.max(0, Number(adjustment.value) || 0),
    },
  }
  const preview = calculateOrderPreview(numericDraft)
  const itemCount = getOrderItemCount(items)
  const scheduledFor = draft.scheduledFor
  const scheduleVisible = type !== 'Local' && orderDate === getBusinessDate()
  const scheduleValid = scheduleMode === 'now' || (scheduleVisible && isFutureSameDaySchedule({ type, orderDate, scheduledFor, now: new Date() }))
  const itemsSubtotal = getOrderItemsSubtotal(items)
  const selectedClient = clients.find((client) => client.id === clientId) ?? null
  const selectedLocalClient = clients.find((client) => client.id === localClientId) ?? null
  const customerSummary = type === 'Local'
    ? `${selectedTable?.name || 'Mesa'}${selectedLocalClient?.name ? ` · ${selectedLocalClient.name}` : ''}`
    : `${selectedClient?.name || 'Cliente'} · ${type}`
  const stepAccess = getNewOrderStepAccess({
    identityValid: identityValidation.ok,
    orderDate,
    itemCount,
    scheduleValid,
  })
  const canSubmit = Boolean(stepAccess.review)
  const canContinueCustomer = stepAccess.products

  const navigateStep = (targetStep) => {
    if (!canNavigateToNewOrderStep({
      targetStep,
      currentStep,
      maxReachedStep,
      access: stepAccess,
    })) return
    setCurrentStep(targetStep)
    setMaxReachedStep((current) => getFurthestReachedStep(current, targetStep))
  }

  const closeQuickClient = () => {
    setQuickClient({ open: false, name: '', phone: '' })
    setQuickClientError('')
    setDuplicateClient(null)
  }

  const changeType = (nextType) => {
    setType(nextType)
    setCheckoutError('')
    closeQuickClient()
    if (nextType === 'Local') { setScheduleMode('now'); setScheduledTime('') }
    if (nextType !== 'Entrega') setDeliveryFee(formatBRLCurrencyValue(0))
  }

  const changeOrderDate = (value) => {
    setOrderDate(value)
    if (value !== getBusinessDate()) { setScheduleMode('now'); setScheduledTime('') }
  }

  const selectTable = (tableId) => {
    setSelectedTableId(tableId)
    setCheckoutError('')
  }

  const handleAdjustmentChange = (patch) => {
    if (!canAdjustOrders) return false
    setAdjustment((current) => {
      if (patch.type === 'none') return emptyAdjustment()
      const next = { ...current, ...patch }
      if (patch.mode === 'fixed' && current.mode !== 'fixed') {
        next.value = formatBRLCurrencyValue(Number(current.value) || 0)
      }
      if (patch.mode === 'percentage' && current.mode !== 'percentage') {
        next.value = String(parseBRLCurrencyInput(current.value))
      }
      return next
    })
    return true
  }

  const handleClientSearchChange = (value) => {
    if (type === 'Local') {
      setLocalClientSearch(value)
      setLocalClientId('')
    } else {
      setClientSearch(value)
      setClientId('')
    }
    setClientPickerOpen(true)
  }

  const selectClient = (client) => {
    if (type === 'Local') {
      setLocalClientId(client.id)
      setLocalClientSearch(client.name)
    } else {
      setClientId(client.id)
      setClientSearch(client.name)
    }
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
    if (!canManageClients) return false
    const client = await onCreateClient({ name: quickClient.name, phone: quickClient.phone })
    if (!client) return false
    finishQuickClient(client)
    return true
  }

  const handleQuickClientSubmit = async (event) => {
    event.preventDefault()
    if (!canManageClients || disabled || !quickClient.name.trim()) return false
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
    if (!canManageClients) return false
    setDuplicateClient(null)
    return createQuickClient()
  }

  const toggleQuickClient = () => {
    if (!canManageClients) return false
    if (quickClient.open) {
      closeQuickClient()
      return true
    }
    setQuickClientError('')
    setDuplicateClient(null)
    setQuickClient((current) => ({ ...current, open: true }))
    return true
  }

  const updateQuickClient = (patch) => {
    setQuickClientError('')
    setQuickClient((current) => ({ ...current, ...patch }))
  }

  const handleQuickClientChange = (patch) => {
    updateQuickClient(patch.phone === undefined ? patch : { ...patch, phone: formatPhone(patch.phone) })
  }

  const save = async (paymentMethod) => {
    if (disabled || !canSubmit) return
    setCheckoutError('')
    const success = await onSubmit(buildOrderPayload(numericDraft, paymentMethod))
    if (!success) setCheckoutError('Não foi possível salvar a venda. Seus dados continuam aqui para tentar novamente.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Atendimento"
        title="Nova venda"
        description="Informe o atendimento, escolha os produtos e revise tudo antes de salvar."
        actions={<Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>Cancelar venda</Button>}
      />

      {checkoutError && <div className="new-order-error" role="alert">{checkoutError}</div>}

      <NewOrderStepIndicator
        currentStep={currentStep}
        maxReachedStep={maxReachedStep}
        access={stepAccess}
        onNavigate={navigateStep}
      />

      <div ref={stepContentRef} tabIndex="-1" className="new-order-step-content">
        {currentStep === NEW_ORDER_STEPS.CUSTOMER && (
          <NewOrderCustomerStep
            clients={clients}
            tables={tables}
            selectedTableId={selectedTableId}
            filteredClients={filteredClients}
            clientId={activeClientId}
            clientSearch={activeClientSearch}
            clientPickerOpen={clientPickerOpen}
            type={type}
            orderDate={orderDate}
            todayValue={getBusinessDate()}
            scheduleMode={scheduleMode}
            scheduledTime={scheduledTime}
            scheduleVisible={scheduleVisible}
            scheduleValid={scheduleValid}
            quickClient={quickClient}
            quickClientError={quickClientError}
            disabled={disabled}
            canManageClients={canManageClients}
            canContinue={canContinueCustomer}
            onTypeChange={changeType}
            onOrderDateChange={changeOrderDate}
            onScheduleModeChange={setScheduleMode}
            onScheduledTimeChange={setScheduledTime}
            onTableSelect={selectTable}
            onClientSearchChange={handleClientSearchChange}
            onClientFocus={() => setClientPickerOpen(true)}
            onClientBlur={handleClientPickerBlur}
            onClientSelect={selectClient}
            onQuickClientToggle={toggleQuickClient}
            onQuickClientChange={handleQuickClientChange}
            onQuickClientSubmit={handleQuickClientSubmit}
            onQuickClientCancel={closeQuickClient}
            onContinue={() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)}
          />
        )}

        {currentStep === NEW_ORDER_STEPS.PRODUCTS && (
          <NewOrderProductsStep
            products={products}
            items={items}
            currency={currency}
            disabled={disabled}
            customerSummary={customerSummary}
            itemCount={itemCount}
            subtotal={itemsSubtotal}
            onAdd={(product) => setItems((current) => addCartItem(current, product, ''))}
            onDecrease={(productId) => setItems((current) => decrementCartProduct(current, productId))}
            onBack={() => navigateStep(NEW_ORDER_STEPS.CUSTOMER)}
            onReview={() => navigateStep(NEW_ORDER_STEPS.REVIEW)}
          />
        )}

        {currentStep === NEW_ORDER_STEPS.REVIEW && (
          <NewOrderReviewStep
            customerSummary={customerSummary}
            itemCount={itemCount}
            disabled={disabled}
            canAdjustOrders={canAdjustOrders}
            onBack={() => navigateStep(NEW_ORDER_STEPS.PRODUCTS)}
            cartProps={{
              items,
              currency,
              disabled,
              onUpdate: (lineId, patch) => setItems((current) => updateCartItem(current, lineId, patch)),
              onNoteChange: (lineId, note) => setItems((current) => editCartItemNote(current, lineId, note)),
              onNoteCommit: (lineId) => setItems((current) => commitCartItemNote(current, lineId)),
              onRemove: (lineId) => setItems((current) => removeCartItem(current, lineId)),
            }}
            checkoutProps={{
              draft,
              preview,
              currency,
              disabled,
              canSubmit,
              onDeliveryFeeChange: setDeliveryFee,
              onAdjustmentChange: handleAdjustmentChange,
              onSavePending: () => save(),
              onSavePaid: (method) => save(method),
              allowImmediatePayment: type !== 'Local',
            }}
          />
        )}
      </div>

      {canManageClients && duplicateClient && (
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
