import Button from '../../../../shared/ui/Button.jsx'
import Icon from '../../../../shared/ui/Icon.jsx'
import KitchenTicketNotes from './KitchenTicketNotes.jsx'
import StatusBadge from '../../../../shared/ui/StatusBadge.jsx'
import { buildKitchenItemSummary, buildKitchenTimingCopy } from '../../domain/kitchenTicket.js'
import { getFinalActionLabel } from '../../domain/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../../../../shared/orderDisplayNumber.js'

const attendanceIcons = { Entrega: 'delivery', Retirada: 'pickup', Local: 'local' }
function KitchenTicket({ entry, now, currentTiming, disabled = false, highlighted = false, onDetails, onFinalize, onCancel }) {
  const order = entry.order
  const timing = buildKitchenTimingCopy(entry, now, currentTiming)
  const scheduled = entry.phase === 'scheduled'
  const status = scheduled ? 'Agendado' : 'Em preparo'
  const statusLabel = entry.isLate ? 'Fora do prazo' : (scheduled ? 'Agendado para preparo' : 'Em preparo')
  const activeReservation = order.type === 'Local'
    && Boolean(order.tableReservationId)
    && order.tableReservationStatus === 'reserved'
  const cancelLabel = activeReservation ? 'Cancelar reserva' : 'Cancelar pedido'

  return <article className={`kitchen-ticket${highlighted ? ' kitchen-ticket-highlighted' : ''}`} aria-label={formatOrderDisplayNumber(order)}>
    <header className="kitchen-ticket-header">
      <strong className="kitchen-ticket-customer-name">{order.client || 'Cliente não identificado'}</strong>
      <StatusBadge status={status} label={statusLabel} />
    </header>
    <div className="kitchen-ticket-customer"><span><Icon name={attendanceIcons[order.type] || 'local'} size={16} />{order.type}</span><span className="kitchen-ticket-id">{formatOrderDisplayNumber(order)}</span></div>
    <p className="kitchen-ticket-items">{buildKitchenItemSummary(order)}</p>
    <KitchenTicketNotes order={order} />
    <div className="kitchen-ticket-timing"><strong>{timing.primary}</strong>{timing.secondary && <span>{timing.secondary}</span>}</div>
    <footer className="kitchen-ticket-actions">
      <Button type="button" variant="secondary" icon="note" onClick={() => onDetails?.(order)} disabled={disabled}>Exibir detalhes</Button>
      {!scheduled && onFinalize && <Button type="button" icon={order.type === 'Entrega' ? 'delivery' : 'check'} onClick={() => onFinalize(order)} disabled={disabled}>{getFinalActionLabel(order)}</Button>}
      {onCancel && <button type="button" className="kitchen-ticket-cancel-action" onClick={() => onCancel(order)} disabled={disabled}>{cancelLabel}</button>}
    </footer>
  </article>
}

export default KitchenTicket
