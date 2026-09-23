import Icon from '../shared/ui/Icon.jsx'

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
const cleanSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
const itemName = (item) => {
  const name = cleanSpaces(item?.name || 'Item')
  const size = cleanSpaces(item?.size)
  if (!size) return name
  const normalizedName = name.toLocaleLowerCase('pt-BR')
  const normalizedSize = size.toLocaleLowerCase('pt-BR')
  return normalizedName === normalizedSize || normalizedName.endsWith(` ${normalizedSize}`) ? name : `${name} ${size}`
}
const itemQuantity = (item) => Math.max(1, Math.trunc(Number(item?.quantity) || 1))
const normalizedNote = (item) => String(item?.note || '').trim().replace(/\s+/g, ' ')

const contentDensity = (items) => {
  const visualLines = items.reduce((total, item) => {
    const nameLines = Math.max(1, Math.ceil(itemName(item).length / 22))
    const note = normalizedNote(item)
    const noteLines = note ? Math.max(1, Math.ceil(note.length / 28)) : 0
    return total + nameLines + noteLines * .75
  }, 0)

  if (visualLines >= 10 || items.length >= 8) return 'dense'
  if (visualLines >= 5 || items.length >= 5) return 'compact'
  return 'comfortable'
}

export function KitchenDisplayCard({ entry, now = new Date() }) {
  const { order, state, phase } = entry
  const items = Array.isArray(order.items) ? order.items : []
  const density = contentDensity(items)
  const twoColumns = items.length > 4
  const scheduled = phase === 'scheduled'
  const timing = scheduled ? timeFormatter.format(new Date(order.scheduledFor)) : formatElapsed(entry.operationalStartAt || order.createdAt, now)
  const typeIcon = order.type === 'Retirada' ? 'pickup' : order.type === 'Local' ? 'local' : 'delivery-bike'

  return <article
    className={`kds-card kds-card--${state} kds-card--content-${density}`}
    data-order-id={String(order.id)}
    data-highlighted={state === 'new'}
    data-item-count={items.length}
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
        const note = normalizedNote(item)
        return <li className={`kds-card__item${note ? ' has-note' : ''}`} key={`${itemName(item)}-${index}`}>
          <div className="kds-card__item-line">
            <strong>{itemQuantity(item)}x</strong>
            <span className="kds-card__item-name">{itemName(item)}</span>
          </div>
          {note && <p className="kds-card__item-note"><Icon name="note" size={14} /><span>{note}</span></p>}
        </li>
      })}
    </ul>
  </article>
}
