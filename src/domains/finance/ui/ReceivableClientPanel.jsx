import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import Button from '../../../shared/ui/Button.jsx'
import Icon from '../../../shared/ui/Icon.jsx'

const timingText = (group, formatOrderDate) => {
  const timing = group?.timing || {}
  if (timing.status === 'overdue') {
    const days = Number(timing.daysOverdue) || 0
    return `Atrasado há ${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  if (timing.status === 'today') return 'Pagamento esperado hoje'
  if (timing.status === 'upcoming') return `Previsto para ${formatOrderDate(timing.expectedDate || group?.earliestExpectedDate)}`
  return 'Pendente'
}

export default function ReceivableClientPanel({
  group,
  selectedOrderIds = [],
  currency,
  formatOrderDate,
  getOrderItemsSummary,
  onToggleOrder,
  onSelectAll,
  onDeselectAll,
  onReceive,
  onOpenClient,
  disabled = false,
}) {
  if (!group) return <div className="receivable-detail-empty">Selecione um cliente para ver os pedidos pendentes.</div>

  const selected = new Set(selectedOrderIds)
  const selectedEntries = group.entries.filter((entry) => selected.has(entry.order.id))
  const selectedTotal = selectedEntries.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0)
  const allSelected = group.entries.length > 0 && selectedEntries.length === group.entries.length

  return (
    <section className="receivables-client-panel">
      <header className="receivables-client-panel-heading">
        <span className="receivable-client-avatar">{group.label.charAt(0).toUpperCase()}</span>
        <div>
          <strong>{group.label}</strong>
          <span>{group.phone || (group.kind === 'single' ? 'Cliente avulso' : 'Telefone não informado')}</span>
        </div>
        {group.clientId && onOpenClient && (
          <button type="button" className="receivables-client-open" onClick={() => onOpenClient(group)}>
            Ver cliente
          </button>
        )}
      </header>

      <div className="receivables-client-panel-metrics">
        <div><span>Total pendente</span><strong>{currency(group.total)}</strong></div>
        <div><span>Pedidos</span><strong>{group.count}</strong></div>
      </div>

      <div className={`receivable-client-status receivable-client-status-${group.timing?.status || 'today'}`}>
        <Icon name={group.timing?.status === 'overdue' ? 'alert' : 'clock'} size={17} />
        <span>{timingText(group, formatOrderDate)}</span>
      </div>

      <div className="receivables-client-panel-toolbar">
        <strong>Pedidos pendentes</strong>
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : () => onSelectAll?.(group)}
          disabled={disabled || !group.entries.length}
        >
          {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      <div className="receivables-client-panel-orders">
        {group.entries.map((entry) => {
          const order = entry.order
          return (
            <label className="receivable-client-order-select" key={order.id}>
              <input
                type="checkbox"
                checked={selected.has(order.id)}
                disabled={disabled}
                onChange={() => onToggleOrder?.(order.id)}
                aria-label={`Selecionar pedido ${formatOrderDisplayNumber(order)} no valor de ${currency(entry.total)}`}
              />
              <span className="receivable-client-order-main">
                <strong>{formatOrderDisplayNumber(order)}</strong>
                <span>{getOrderItemsSummary(order)}</span>
                <small>{formatOrderDate(entry.expectedDate)}</small>
              </span>
              <strong className="receivable-client-order-amount">{currency(entry.total)}</strong>
            </label>
          )
        })}
      </div>

      <footer className="receivables-client-panel-footer">
        <div>
          <span>{selectedEntries.length} {selectedEntries.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}</span>
          <strong>{currency(selectedTotal)}</strong>
        </div>
        <Button
          type="button"
          onClick={() => onReceive?.(group)}
          disabled={disabled || selectedEntries.length === 0}
        >
          Receber selecionados
        </Button>
      </footer>
    </section>
  )
}
