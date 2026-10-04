import { getKitchenItemNotes } from '../../domain/kitchenTicket.js'
import Icon from '../../../../shared/ui/Icon.jsx'

function KitchenTicketNotes({ order, item }) {
  const notes = item ? getKitchenItemNotes({ items: [item] }) : getKitchenItemNotes(order)

  if (!notes.length) return null

  return <div className="kitchen-ticket-notes" aria-label="Observações dos itens">
    {notes.map((note) => <div className="kitchen-ticket-note" key={note.key} aria-label={note.text}>
      <Icon name="arrow-right" size={14} />
      <span>{item ? note.note : note.text}</span>
    </div>)}
  </div>
}

export default KitchenTicketNotes
