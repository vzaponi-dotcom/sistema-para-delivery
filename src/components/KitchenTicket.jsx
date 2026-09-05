import Button from './Button.jsx'
import Icon from './Icon.jsx'
import KitchenTicketNotes from './KitchenTicketNotes.jsx'
import StatusBadge from './StatusBadge.jsx'
import { buildKitchenItemSummary, buildKitchenTimingCopy } from '../utils/kitchenTicket.js'
import { getFinalActionLabel } from '../utils/orderWorkflow.js'

const attendanceIcons = { Entrega: 'package', Retirada: 'orders', Local: 'meal' }
const orderNumber = (id) => String(id ?? '').slice(-4)

function KitchenTicket({ entry, now, disabled = false, highlighted = false, onDetails, onFinalize, onCancel }) {
  const order = entry.order
  const timing = buildKitchenTimingCopy(entry, now)
  const scheduled = entry.phase === 'scheduled'

  return <article className={`kitchen-ticket${highlighted ? ' kitchen-ticket-highlighted' : ''}`} aria-label={`Pedido #${orderNumber(order.id)}`}>
    <header className="kitchen-ticket-header">
      <span className="kitchen-ticket-number">#{orderNumber(order.id)}</span>
      <StatusBadge status={scheduled ? 'Agendado' : 'Em preparo'} />
    </header>
    <div className="kitchen-ticket-customer"><strong>{order.client}</strong><span><Icon name={attendanceIcons[order.type] || 'orders'} size={16} />{order.type}</span></div>
    <p className="kitchen-ticket-items">{buildKitchenItemSummary(order)}</p>
    <KitchenTicketNotes order={order} />
    <div className="kitchen-ticket-timing"><strong>{timing.primary}</strong>{timing.secondary && <span>{timing.secondary}</span>}</div>
    <footer className="kitchen-ticket-actions">
      <Button type="button" variant="secondary" onClick={() => onDetails?.(order)} disabled={disabled}>Exibir detalhes</Button>
      {scheduled
        ? <Button type="button" variant="secondary" onClick={() => onCancel?.(order)} disabled={disabled}>Cancelar pedido</Button>
        : <Button type="button" onClick={() => onFinalize?.(order)} disabled={disabled}>{getFinalActionLabel(order)}</Button>}
    </footer>
  </article>
}

export default KitchenTicket
