import Button from './Button.jsx'
import Icon from './Icon.jsx'
import KitchenTicketNotes from './KitchenTicketNotes.jsx'
import StatusBadge from './StatusBadge.jsx'
import { buildKitchenItemSummary, buildKitchenTimingCopy } from '../utils/kitchenTicket.js'
import { getFinalActionLabel } from '../utils/orderWorkflow.js'
import { formatOrderDisplayNumber } from '../../shared/orderDisplayNumber.js'

const attendanceIcons = { Entrega: 'delivery', Retirada: 'pickup', Local: 'local' }
function KitchenTicket({ entry, now, disabled = false, highlighted = false, onDetails, onFinalize, onCancel }) {
  const order = entry.order
  const timing = buildKitchenTimingCopy(entry, now)
  const scheduled = entry.phase === 'scheduled'
  const status = scheduled ? 'Agendado' : 'Em preparo'
  const statusLabel = entry.isLate ? 'Fora do prazo' : (scheduled ? 'Agendado para preparo' : 'Em preparo')

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
      <Button type="button" variant="secondary" onClick={() => onDetails?.(order)} disabled={disabled}>Exibir detalhes</Button>
      {scheduled
        ? <Button type="button" variant="secondary" onClick={() => onCancel?.(order)} disabled={disabled}>Cancelar</Button>
        : <Button type="button" onClick={() => onFinalize?.(order)} disabled={disabled}>{getFinalActionLabel(order)}</Button>}
    </footer>
  </article>
}

export default KitchenTicket
