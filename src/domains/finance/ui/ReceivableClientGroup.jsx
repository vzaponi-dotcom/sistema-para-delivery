import { formatOrderDisplayNumber } from '../../../../shared/orderDisplayNumber.js'
import Icon from '../../../shared/ui/Icon.jsx'

const groupTimingLabel = (group, formatOrderDate) => {
  const timing = group?.timing || {}
  if (timing.status === 'overdue') {
    const days = Number(timing.daysOverdue) || 0
    return `Atrasado há ${days} ${days === 1 ? 'dia' : 'dias'}`
  }
  if (timing.status === 'today') return 'Pagamento esperado hoje'
  if (timing.status === 'upcoming') return `Previsto para ${formatOrderDate(timing.expectedDate || group?.earliestExpectedDate)}`
  return 'Pendente'
}

export default function ReceivableClientGroup({
  group,
  expanded = false,
  selectedOrderIds = [],
  currency,
  formatOrderDate,
  getOrderItemsSummary,
  onToggle,
  onToggleOrder,
  onSelectAll,
  disabled = false,
}) {
  if (!group) return null
  const selected = new Set(selectedOrderIds)
  const orderIds = group.orders.map((order) => order.id)
  const allSelected = orderIds.length > 0 && orderIds.every((id) => selected.has(id))

  return (
    <article className="receivable-client-card" data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        className="receivable-client-card-header"
        aria-expanded={expanded}
        onClick={() => onToggle?.(group)}
      >
        <span className="receivable-client-avatar">{group.label.charAt(0).toUpperCase()}</span>
        <span className="receivable-client-card-main">
          <strong>{group.label}</strong>
          <span>{group.phone || (group.kind === 'single' ? 'Cliente avulso' : 'Telefone não informado')}</span>
          <small className={`receivable-timing receivable-timing-${group.timing?.status || 'today'}`}>
            {groupTimingLabel(group, formatOrderDate)}
          </small>
        </span>
        <span className="receivable-client-card-summary">
          <strong>{currency(group.total)}</strong>
          <small>{group.count} {group.count === 1 ? 'pedido' : 'pedidos'}</small>
        </span>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} />
      </button>

      {expanded && (
        <div className="receivable-client-inline-orders">
          <div className="receivable-client-inline-toolbar">
            <span>{group.count} {group.count === 1 ? 'pedido pendente' : 'pedidos pendentes'}</span>
            <button
              type="button"
              onClick={() => onSelectAll?.(group)}
              disabled={disabled || !orderIds.length}
            >
              {allSelected ? 'Todos selecionados' : 'Selecionar todos'}
            </button>
          </div>
          <div className="receivable-client-orders-list">
            {group.entries.map((entry) => {
              const order = entry.order
              const checked = selected.has(order.id)
              return (
                <label className="receivable-client-order-select" key={order.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleOrder?.(order.id)}
                    aria-label={`Selecionar ${formatOrderDisplayNumber(order)} no valor de ${currency(entry.total)}`}
                  />
                  <span className="receivable-client-order-main">
                    <strong>{formatOrderDisplayNumber(order)}</strong>
                    <span>{getOrderItemsSummary(order)}</span>
                    <small>{groupTimingLabel(entry, formatOrderDate)}</small>
                  </span>
                  <strong className="receivable-client-order-amount">{currency(entry.total)}</strong>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}
