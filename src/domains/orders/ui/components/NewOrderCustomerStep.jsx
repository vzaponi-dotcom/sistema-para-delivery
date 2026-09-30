import Icon from '../../../../shared/ui/Icon'
import { OrderTiming } from './NewOrderContext'
import Button from '../../../../shared/ui/Button'
import { LocalTableSelector } from '../../../table-service/index.js'
import { formatScheduledTimeInput } from '../../../../shared/utils/formFormatting.js'
import { ORDER_TYPE_OPTIONS } from '../../domain/orderTypeOptions.js'

function NewOrderCustomerStep({
  customerSummary,
  contextProps,
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
  maxDateValue,
  scheduleMode,
  scheduledTime,
  scheduleVisible,
  scheduleValid,
  reservationMode = false,
  scheduleNowAllowed = true,
  scheduleOptionLabel = 'Agendado',
  scheduleFieldLabel = 'Quando preparar?',
  quickClient,
  quickClientError,
  disabled,
  canCreateClients = true,
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
  orderTypeOptions = ORDER_TYPE_OPTIONS,
}) {
  return (
    <div className="new-order-attendance-layout"><section className="surface-card new-order-customer-card new-order-step-card">
      <div className="section-heading">
        <div>

          <h2>Como será o atendimento?</h2><p>Defina o tipo de pedido, o cliente e o momento de preparar.</p>
        </div>
      </div>

      <div className="form-field">
        <span>Tipo do pedido</span>
        <div className="new-order-type-options" role="group" aria-label="Tipo do pedido">
          {orderTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={type === option.value ? 'new-order-type-option selected' : 'new-order-type-option'}
              aria-pressed={type === option.value}
              aria-label={option.label}
              onClick={() => onTypeChange(option.value)}
              disabled={disabled}
            >
              <Icon name={option.value === 'Local' ? 'table' : option.value === 'Entrega' ? 'delivery' : 'pickup'} size={20} />
              <span>{option.value === 'Local' ? 'No local' : option.label}<small>{option.value === 'Local' ? 'Consumo na mesa' : option.value === 'Entrega' ? 'No endereço do cliente' : 'Cliente retira no local'}</small></span>
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
            reservationMode={reservationMode}
          />
        </div>
      )}

      <>
          <div className="form-field new-order-client-picker" onBlur={onClientBlur}>
            <div className="new-order-client-label"><span>{type === 'Local' ? 'Vincular cliente cadastrado — opcional' : 'Cliente'}</span>          {canCreateClients && (
            <button type="button" className="new-order-quick-client-toggle" onClick={() => { if (canCreateClients) onQuickClientToggle?.() }} disabled={disabled}>
              + Novo cliente
            </button>
          )}</div>
            <div className="new-order-client-combobox">
              <input
                aria-label={type === 'Local' ? 'Cliente opcional' : 'Cliente'}
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



          {canCreateClients && quickClient.open && (
            <form className="new-order-quick-client" onSubmit={(event) => { if (!canCreateClients) { event.preventDefault(); return }; onQuickClientSubmit?.(event) }}>
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

      <div className="new-order-when-grid">
      <label className="form-field new-order-date-field">
        <span>Data do pedido</span>
        <input
          type="date"
          value={orderDate}
          max={maxDateValue || todayValue}
          onChange={(event) => onOrderDateChange(event.target.value)}
          disabled={disabled}
        />
      </label>

      {scheduleVisible && (
        <div className="form-field new-order-schedule-field">
          <span>{scheduleFieldLabel}</span>
          <div className="new-order-schedule-options" role="group" aria-label={scheduleFieldLabel}>
            <button
              type="button"
              className={scheduleMode === 'now' ? 'new-order-schedule-option new-order-type-option selected' : 'new-order-schedule-option new-order-type-option'}
              aria-pressed={scheduleMode === 'now'}
              onClick={() => onScheduleModeChange('now')}
              disabled={disabled || !scheduleNowAllowed}
            >Agora</button>
            <button
              type="button"
              className={scheduleMode === 'scheduled' ? 'new-order-schedule-option new-order-type-option selected' : 'new-order-schedule-option new-order-type-option'}
              aria-pressed={scheduleMode === 'scheduled'}
              onClick={() => onScheduleModeChange('scheduled')}
              disabled={disabled}
            >{scheduleOptionLabel === 'Agendado' ? <>Agendado</> : scheduleOptionLabel}</button>
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
              <small>{reservationMode ? 'Esse horário identifica a reserva da mesa.' : 'Esse horário é uma referência de atendimento.'}</small>
            </label>
          )}
        </div>
      )}

      </div>
      <div className="new-order-step-actions">
        <Button type="button" onClick={onContinue} disabled={disabled || !canContinue}>Escolher produtos →</Button>
      </div>
    </section><aside className="surface-card new-order-attendance-summary"><Icon name="orders" size={27} /><h3>Dados do atendimento</h3><dl><div><dt>Modalidade</dt><dd>{type === 'Local' ? 'Consumo no local' : type || 'A definir'}</dd></div><div><dt>{type === 'Local' ? 'Atendimento' : 'Cliente'}</dt><dd>{contextProps?.displayName || customerSummary || 'A definir'}</dd></div></dl><OrderTiming {...contextProps} /><p>Na próxima etapa, escolha os produtos. Você poderá revisar as quantidades e os valores antes de salvar.</p></aside></div>
  )
}

export default NewOrderCustomerStep
