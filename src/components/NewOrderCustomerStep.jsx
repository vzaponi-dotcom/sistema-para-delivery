import Button from './Button'
import LocalTableSelector from './LocalTableSelector'
import { formatScheduledTimeInput } from '../utils/formFormatting.js'

const ORDER_TYPE_OPTIONS = [
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Retirada', label: 'Retirada' },
  { value: 'Local', label: 'Consumo no local' },
]

function NewOrderCustomerStep({
  clients,
  tables,
  selectedTableId,
  filteredClients,
  clientId,
  clientSearch,
  clientPickerOpen,
  type,
  orderDate,
  todayValue,
  scheduleMode,
  scheduledTime,
  scheduleVisible,
  scheduleValid,
  quickClient,
  quickClientError,
  disabled,
  canManageClients = true,
  canContinue,
  onTypeChange,
  onOrderDateChange,
  onScheduleModeChange,
  onScheduledTimeChange,
  onTableSelect,
  onClientSearchChange,
  onClientFocus,
  onClientBlur,
  onClientSelect,
  onQuickClientToggle,
  onQuickClientChange,
  onQuickClientSubmit,
  onQuickClientCancel,
  onContinue,
}) {
  return (
    <section className="surface-card new-order-customer-card new-order-step-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Etapa 1</span>
          <h2>Cliente e atendimento</h2>
        </div>
      </div>

      <div className="form-field">
        <span>Tipo do pedido</span>
        <div className="new-order-type-options" role="group" aria-label="Tipo do pedido">
          {ORDER_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={type === option.value ? 'new-order-type-option selected' : 'new-order-type-option'}
              aria-pressed={type === option.value}
              onClick={() => onTypeChange(option.value)}
              disabled={disabled}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'Local' && (
        <div className="new-order-local-identity">
          <span className="product-detail-label">Selecione uma mesa</span>
          <LocalTableSelector
            tables={tables}
            selectedTableId={selectedTableId}
            onSelect={onTableSelect}
            disabled={disabled}
          />
        </div>
      )}

      <>
          <div className="form-field new-order-client-picker" onBlur={onClientBlur}>
            <span>{type === 'Local' ? 'Vincular cliente cadastrado — opcional' : 'Cliente'}</span>
            <div className="new-order-client-combobox">
              <input
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={clientPickerOpen}
                aria-controls="new-order-client-options"
                placeholder="Digite o nome do cliente"
                value={clientSearch}
                onFocus={onClientFocus}
                onChange={(event) => onClientSearchChange(event.target.value)}
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
                      onClick={() => onClientSelect(client)}
                    >
                      {client.name}
                    </button>
                  ))}
                  {!filteredClients.length && <span className="new-order-client-empty">Nenhum cliente encontrado</span>}
                </div>
              )}
            </div>
          </div>

          {canManageClients && (
            <button type="button" className="new-order-quick-client-toggle" onClick={() => { if (canManageClients) onQuickClientToggle?.() }} disabled={disabled}>
              + Novo cliente
            </button>
          )}

          {canManageClients && quickClient.open && (
            <form className="new-order-quick-client" onSubmit={(event) => { if (!canManageClients) { event.preventDefault(); return }; onQuickClientSubmit?.(event) }}>
              {quickClientError && <div className="new-order-error" role="alert">{quickClientError}</div>}
              <label className="form-field">
                <span>Nome</span>
                <input
                  type="text"
                  value={quickClient.name}
                  onChange={(event) => onQuickClientChange({ name: event.target.value })}
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
                  onChange={(event) => onQuickClientChange({ phone: event.target.value })}
                  placeholder="(11) 99999-9999"
                  autoComplete="off"
                />
              </label>
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={onQuickClientCancel} disabled={disabled}>Cancelar</Button>
                <Button type="submit" disabled={disabled || !quickClient.name.trim()}>Adicionar cliente</Button>
              </div>
            </form>
          )}
      </>

      <label className="form-field new-order-date-field">
        <span>Data do pedido</span>
        <input
          type="date"
          value={orderDate}
          max={todayValue}
          onChange={(event) => onOrderDateChange(event.target.value)}
          disabled={disabled}
        />
      </label>

      {scheduleVisible && (
        <div className="form-field new-order-schedule-field">
          <span>Quando preparar?</span>
          <div className="new-order-schedule-options" role="group" aria-label="Quando preparar">
            <button
              type="button"
              className={scheduleMode === 'now' ? 'new-order-schedule-option new-order-type-option selected' : 'new-order-schedule-option new-order-type-option'}
              aria-pressed={scheduleMode === 'now'}
              onClick={() => onScheduleModeChange('now')}
              disabled={disabled}
            >Agora</button>
            <button
              type="button"
              className={scheduleMode === 'scheduled' ? 'new-order-schedule-option new-order-type-option selected' : 'new-order-schedule-option new-order-type-option'}
              aria-pressed={scheduleMode === 'scheduled'}
              onClick={() => onScheduleModeChange('scheduled')}
              disabled={disabled}
            >Agendado</button>
          </div>
          {scheduleMode === 'scheduled' && (
            <label className="form-field">
              <span>Horário desejado pelo cliente</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                placeholder="HH:MM"
                autoComplete="off"
                value={scheduledTime}
                onChange={(event) => onScheduledTimeChange(formatScheduledTimeInput(event.target.value))}
                disabled={disabled}
                aria-invalid={!scheduleValid}
              />
              <small>Esse horário é uma referência de atendimento.</small>
            </label>
          )}
        </div>
      )}

      <div className="new-order-step-actions">
        <Button type="button" onClick={onContinue} disabled={disabled || !canContinue}>Continuar →</Button>
      </div>
    </section>
  )
}

export default NewOrderCustomerStep
