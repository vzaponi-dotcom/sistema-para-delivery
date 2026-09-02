import Button from './Button'

function OrderCart({
  items,
  currency,
  disabled = false,
  onUpdate,
  onNoteChange,
  onNoteCommit,
  onRemove,
}) {
  return (
    <section className="surface-card new-order-cart">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Pedido</span>
          <h2>Carrinho</h2>
        </div>
        <span className="toolbar-count">{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(ns)</span>
      </div>

      <div className="new-order-cart-lines">
        {items.map((item) => (
          <article className="new-order-cart-line" key={item.lineId}>
            <div className="new-order-cart-quantity">
              <div className="new-order-quantity-control" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" onClick={() => onUpdate(item.lineId, { quantity: Number(item.quantity || 1) - 1 })} disabled={disabled}>−</button>
                <strong>{item.quantity}</strong>
                <button type="button" onClick={() => onUpdate(item.lineId, { quantity: Number(item.quantity || 1) + 1 })} disabled={disabled}>+</button>
              </div>
              <span>{currency(item.unitPrice)} cada</span>
            </div>

            <div className="new-order-cart-content">
              <div className="new-order-cart-line-heading">
                <strong>{item.name}</strong>
                <span>{[item.category, item.size].filter(Boolean).join(' · ')}</span>
              </div>

              <label className="form-field compact-field new-order-note-field">
                <span>Observação deste item</span>
                <textarea
                  rows="1"
                  maxLength={300}
                  value={item.note}
                  placeholder="Ex: sem cebola"
                  onChange={(event) => onNoteChange(item.lineId, event.target.value)}
                  onBlur={() => onNoteCommit(item.lineId)}
                  disabled={disabled}
                />
                <small className="form-hint">{item.note.length}/300 caracteres</small>
              </label>
            </div>

            <div className="new-order-cart-aside">
              <strong>{currency(Number(item.unitPrice || 0) * Number(item.quantity || 1))}</strong>
              <Button type="button" variant="secondary" onClick={() => onRemove(item.lineId)} disabled={disabled}>Remover</Button>
            </div>
          </article>
        ))}

        {!items.length && (
          <div className="empty-state compact">
            <strong>O carrinho está vazio</strong>
            <span>Escolha os produtos do pedido para começar a venda.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export default OrderCart
