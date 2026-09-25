import Icon from '../shared/ui/Icon.jsx'
import {
  formatKitchenDisplayItemName,
  getKitchenCardContentMetrics,
  normalizeKitchenItemNote,
} from './kitchenDisplayContentLayout.js'

export const KITCHEN_DISPLAY_STATUS_LABELS = Object.freeze({
  new: 'NOVO PEDIDO', late: 'ATRASADO', 'near-limit': 'PRÓXIMO DO LIMITE', preparing: 'EM PREPARO', scheduled: 'AGENDADO',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const formatElapsed = (start, now) => {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - new Date(start).getTime()) / 60_000))
  if (elapsedMinutes < 60) return `${elapsedMinutes}min`
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`
}
const itemQuantity = (item) => Math.max(1, Math.trunc(Number(item?.quantity) || 1))

export function KitchenDisplayCard({ entry, now = new Date() }) {
  const { order, state, phase } = entry
  const items = Array.isArray(order.items) ? order.items : []
  const metrics = getKitchenCardContentMetrics(items)
  const twoColumns = items.length > 4
  const scheduled = phase === 'scheduled'
  const timing = scheduled ? timeFormatter.format(new Date(order.scheduledFor)) : formatElapsed(entry.operationalStartAt || order.createdAt, now)
  const typeIcon = order.type === 'Retirada' ? 'pickup' : order.type === 'Local' ? 'local' : 'delivery-bike'

  return <article
    className={`kds-card kds-card--${state} kds-card--content-${metrics.density}`}
    data-order-id={String(order.id)}
    data-highlighted={state === 'new'}
    data-item-count={items.length}
    data-layout-demand={metrics.layoutDemand}
  >
    <div className="kds-card__main">
      <h2 className="kds-card__customer">{order.client || 'Cliente não informado'}</h2>
      <span className="kds-card__timing">{scheduled && <span data-icon="clock"><Icon name="clock" size={24} /></span>}{timing}</span>
    </div>
    <div className="kds-card__status">
      <span className="kds-card__status-copy"><span className="kds-card__dot" />{KITCHEN_DISPLAY_STATUS_LABELS[state]}</span>
      <span className="kds-card__meta">
        <span className="kds-card__type"><Icon name={typeIcon} size={20} />{order.type || 'Pedido'}</span>
        <span className="kds-card__number">#{order.orderNumber || order.id}</span>
      </span>
    </div>
    <ul className={`kds-card__items${twoColumns ? ' is-two-columns' : ''}`}>
      {items.map((item, index) => {
        const note = normalizeKitchenItemNote(item)
        const displayName = formatKitchenDisplayItemName(item)
        return <li className={`kds-card__item${note ? ' has-note' : ''}`} key={`${displayName}-${index}`}>
          <div className="kds-card__item-line">
            <strong>{itemQuantity(item)}x</strong>
            <span className="kds-card__item-name">{displayName}</span>
          </div>
          {note && <p className="kds-card__item-note"><Icon name="note" size={14} /><span>{note}</span></p>}
        </li>
      })}
    </ul>
  </article>
}
