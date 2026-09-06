import { getKitchenItemNotes } from '../utils/kitchenTicket.js'

function KitchenTicketNotes({ order }) {
  const notes = getKitchenItemNotes(order)

  if (!notes.length) return null

  return <div className="kitchen-ticket-notes" aria-label="Observações dos itens">
    {notes.map((note) => <div className="kitchen-ticket-note" key={note.key}>{note.text}</div>)}
  </div>
}

export default KitchenTicketNotes
