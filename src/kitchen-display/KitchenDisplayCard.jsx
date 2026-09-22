import Icon from '../shared/ui/Icon.jsx'

export const KITCHEN_DISPLAY_STATUS_LABELS = Object.freeze({
  new: 'NOVO PEDIDO', late: 'ATRASADO', 'near-limit': 'PRÓXIMO DO LIMITE', preparing: 'EM PREPARO', scheduled: 'AGENDADO',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const formatElapsed = (start, now) => {
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(start).getTime()) / 1000))
  const seconds = String(elapsed % 60).padStart(2, '0')
  const totalMinutes = Math.floor(elapsed / 60)
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  const hours = Math.floor(totalMinutes / 60)
  return hours ? `${hours}:${minutes}:${seconds}` : `${String(totalMinutes).padStart(2, '0')}:${seconds}`
}
const itemName = (item) => String(item?.name || 'Item').trim()
const itemQuantity = (item) => Math.max(1, Math.trunc(Number(item?.quantity) || 1))
const normalizedNote = (item) => String(item?.note || '').trim().replace(/\s+/g, ' ')

export function KitchenDisplayCard({ entry, now = new Date() }) {
  const { order, state, phase } = entry
  const items = Array.isArray(order.items) ? order.items : []
  const visibleItems = items.slice(0, 4)
  const hiddenItems = items.length - visibleItems.length
  const notes = items.map(normalizedNote).filter(Boolean)
  const visibleNotes = notes.slice(0, 2)
  const hiddenNotes = notes.length - visibleNotes.length
  const scheduled = phase === 'scheduled'
  const timing = scheduled ? timeFormatter.format(new Date(order.scheduledFor)) : formatElapsed(entry.operationalStartAt || order.createdAt, now)
  const typeIcon = order.type === 'Retirada' ? 'pickup' : order.type === 'Local' ? 'local' : 'delivery-bike'

  return <article className={`kds-card kds-card--${state}`} data-order-id={String(order.id)} data-highlighted={state === 'new'}>
    <h2 className="kds-card__customer">{order.client || 'Cliente não informado'}</h2>
    <div className="kds-card__status"><span className="kds-card__status-copy"><span className="kds-card__dot" />{KITCHEN_DISPLAY_STATUS_LABELS[state]}</span><span className="kds-card__number">#{order.orderNumber || order.id}</span></div>
    <div className="kds-card__main"><span className="kds-card__timing">{scheduled && <span data-icon="clock"><Icon name="clock" size={24} /></span>}{timing}</span></div>
    <div className="kds-card__body">
      <ul className="kds-card__items">
        {visibleItems.map((item, index) => <li key={`${itemName(item)}-${index}`}><strong>{itemQuantity(item)}x</strong><span>{itemName(item)}</span></li>)}
        {hiddenItems > 0 && <li className="kds-card__more">+ {hiddenItems} {hiddenItems === 1 ? 'item' : 'itens'}</li>}
      </ul>
      <span className="kds-card__type"><Icon name={typeIcon} size={23} />{order.type || 'Pedido'}</span>
    </div>
    <div className="kds-card__notes"><Icon name="note" size={20} /><div>{visibleNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)}{hiddenNotes > 0 && <p className="kds-card__more">+ {hiddenNotes} {hiddenNotes === 1 ? 'observação' : 'observações'}</p>}{notes.length === 0 && <p>Sem observações.</p>}</div></div>
  </article>
}
